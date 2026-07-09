import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import {
  formatEventMatchStatus,
  formatGoalkeeperAbility,
  formatPlayerName,
} from '@/lib/formatters/event-labels';
import { safeEventExportFilename } from '@/lib/formatters/event-export-filename';
import { checkSupportConflicts, type SupportAssignmentWithConflict } from '@/lib/events/event-match-support';

type SquadPlayer = {
  playerId: string;
  player: {
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string | null;
  };
};

type EventSquadData = {
  id: string;
  name: string;
  generationOrder: number;
  players: SquadPlayer[];
};

type SupportAssignment = {
  id: string;
  eventMatchId: string;
  playerId: string;
  sourceEventSquadId: string;
  targetEventSquadId: string;
  plannedRole: string | null;
  note: string | null;
  player: { id: string; firstName: string; lastName: string | null };
  sourceEventSquad: { id: string; name: string };
  targetEventSquad: { id: string; name: string };
};

type EventMatchData = {
  id: string;
  eventSquadId: string;
  category: string;
  opponentName: string;
  startsAt: Date;
  location: string | null;
  status: string;
  cancelledAt: Date | null;
  eventSquad: { id: string; name: string };
  supportAssignments: SupportAssignment[];
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  await requireCoachAccess();
  const { eventId } = await params;

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      squads: {
        include: {
          players: {
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryPosition: true,
                  secondaryPosition: true,
                  tertiaryPosition: true,
                  goalkeeperAbility: true,
                },
              },
            },
            orderBy: { lineupOrder: 'asc' },
          },
        },
        orderBy: { generationOrder: 'asc' },
      },
      players: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const eventMatches: EventMatchData[] = await db.eventMatch.findMany({
    where: { eventId },
    include: {
      eventSquad: { select: { id: true, name: true } },
      supportAssignments: {
        include: {
          player: { select: { id: true, firstName: true, lastName: true } },
          sourceEventSquad: { select: { id: true, name: true } },
          targetEventSquad: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ startsAt: 'asc' }, { eventSquadId: 'asc' }],
  });

  const matchDurationMinutes = event.matchDurationMinutes ?? 0;

  const allEventMatches = eventMatches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    startsAt: m.startsAt,
    status: m.status,
  }));

  const eventSquads = event.squads.map((s) => ({
    id: s.id,
    name: s.name,
    players: s.players.map((p) => ({ playerId: p.playerId })),
  }));

  const playerAvailability = event.players.map((ep) => ({
    playerId: ep.playerId,
    status: ep.status,
  }));

  const playerNames = new Map<string, { firstName: string; lastName: string | null }>();
  const squadNames = new Map<string, string>();
  for (const s of event.squads) {
    squadNames.set(s.id, s.name);
    for (const p of s.players) {
      playerNames.set(p.playerId, { firstName: p.player.firstName, lastName: p.player.lastName });
    }
  }
  for (const ep of event.players) {
    playerNames.set(ep.playerId, { firstName: ep.player.firstName, lastName: ep.player.lastName });
  }

  const supportConflictData = checkSupportConflicts({
    assignments: eventMatches.flatMap((m) =>
      m.supportAssignments.map((a) => ({
        id: a.id,
        eventMatchId: a.eventMatchId,
        playerId: a.playerId,
        sourceEventSquadId: a.sourceEventSquadId,
        targetEventSquadId: a.targetEventSquadId,
        plannedRole: a.plannedRole,
        note: a.note,
      })),
    ),
    allEventMatches,
    matchDurationMinutes,
    eventSquads,
    playerEventAvailability: playerAvailability,
    playerNames,
    squadNames,
  });

  const squadPlayerMap = new Map<string, SquadPlayer[]>();
  for (const squad of event.squads) {
    squadPlayerMap.set(squad.id, squad.players);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matchboard';
  workbook.created = new Date();

  buildSquadsSheet(workbook, event.squads);
  buildMatchCallOutSheet(workbook, eventMatches, matchDurationMinutes, squadPlayerMap, supportConflictData);
  buildConflictsSheet(workbook, supportConflictData, eventMatches, matchDurationMinutes);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = safeEventExportFilename(event.name, event.startsAt);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-offencedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  const row = ws.addRow(headers);
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i];
  });
}

function formatHelperDisplay(
  assignments: SupportAssignment[],
  conflictData: SupportAssignmentWithConflict[],
): string {
  if (assignments.length === 0) return 'None';

  return assignments
    .map((a) => {
      const name = formatPlayerName(a.player.firstName, a.player.lastName);
      const source = a.sourceEventSquad.name;
      const role = a.plannedRole ? `, ${a.plannedRole}` : '';
      const conflict = conflictData.find((c) => c.id === a.id);
      const conflictMark = conflict?.isConflict ? ' — conflict' : '';
      return `${name} (from ${source}${role})${conflictMark}`;
    })
    .join('\n');
}

function formatAllInvolvedPlayers(
  squadPlayers: SquadPlayer[],
  assignments: SupportAssignment[],
  conflictData: SupportAssignmentWithConflict[],
): string {
  const baseNames = squadPlayers.map((p) =>
    formatPlayerName(p.player.firstName, p.player.lastName),
  );

  const helperNames = assignments.map((a) => {
    const name = formatPlayerName(a.player.firstName, a.player.lastName);
    const source = a.sourceEventSquad.name;
    const conflict = conflictData.find((c) => c.id === a.id);
    const conflictMark = conflict?.isConflict ? ' — conflict' : '';
    return `${name} [helper from ${source}]${conflictMark}`;
  });

  return [...baseNames, ...helperNames].join('\n');
}

function buildSquadsSheet(
  workbook: ExcelJS.Workbook,
  squads: EventSquadData[],
) {
  const ws = workbook.addWorksheet('Squads');
  const headers = ['Squad', 'Player', 'Primary position', 'Secondary position', 'Tertiary position', 'GK'];
  const widths = [18, 24, 16, 16, 16, 10];
  addHeaderRow(ws, headers, widths);

  for (const squad of squads) {
    for (let i = 0; i < squad.players.length; i++) {
      const p = squad.players[i];
      ws.addRow([
        i === 0 ? squad.name : '',
        formatPlayerName(p.player.firstName, p.player.lastName),
        p.player.primaryPosition ?? '—',
        p.player.secondaryPosition ?? '—',
        p.player.tertiaryPosition ?? '—',
        formatGoalkeeperAbility(p.player.goalkeeperAbility),
      ]);
    }
    if (squad !== squads[squads.length - 1]) {
      ws.addRow([]);
    }
  }

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 10;
}

function buildMatchCallOutSheet(
  workbook: ExcelJS.Workbook,
  eventMatches: EventMatchData[],
  matchDurationMinutes: number,
  squadPlayerMap: Map<string, SquadPlayer[]>,
  conflictData: SupportAssignmentWithConflict[],
) {
  const ws = workbook.addWorksheet('Match call-out');
  const headers = [
    'Date', 'Start', 'End', 'Squad', 'Opponent', 'Location / pitch',
    'Category', 'Status',
    'Base squad players', 'Helpers', 'All involved players',
    'Notes / conflicts',
  ];
  const widths = [12, 8, 8, 18, 22, 18, 10, 12, 45, 35, 55, 40];
  addHeaderRow(ws, headers, widths);

  for (const m of eventMatches) {
    const endTime = matchDurationMinutes > 0
      ? new Date(m.startsAt.getTime() + matchDurationMinutes * 60 * 1000)
      : null;

    const matchConflicts = conflictData.filter((c) => c.eventMatchId === m.id);
    const squadPlayers = squadPlayerMap.get(m.eventSquadId) ?? [];

    const baseSquadNames = squadPlayers
      .map((p) => formatPlayerName(p.player.firstName, p.player.lastName))
      .join('\n') || 'None';

    const helpersDisplay = formatHelperDisplay(m.supportAssignments, matchConflicts);

    const allInvolved = formatAllInvolvedPlayers(squadPlayers, m.supportAssignments, matchConflicts);

    const notes: string[] = [];
    if (m.status === 'CANCELLED') {
      notes.push('Cancelled');
    }
    if (!endTime) {
      notes.push('Duration not set');
    }
    for (const c of matchConflicts.filter((c) => c.isConflict)) {
      const conflictEntry = conflictData.find((d) => d.id === c.id);
      const playerName = conflictEntry
        ? formatPlayerName(conflictEntry.firstName, conflictEntry.lastName)
        : 'Unknown player';
      notes.push(`${playerName}: ${c.conflictReason ?? 'Conflict'}`);
    }
    const notesText = notes.length > 0 ? notes.join('\n') : 'OK';

    const row = ws.addRow([
      formatDate(m.startsAt),
      formatTime(m.startsAt),
      endTime ? formatTime(endTime) : '—',
      m.eventSquad.name,
      m.opponentName,
      m.location ?? '—',
      m.category,
      formatEventMatchStatus(m.status),
      baseSquadNames,
      helpersDisplay,
      allInvolved,
      notesText,
    ]);

    row.eachCell((cell, colNumber) => {
      if (colNumber >= 9 && colNumber <= 12) {
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
    });
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 10;
  ws.getColumn(8).width = 12;
  ws.getColumn(9).width = 45;
  ws.getColumn(10).width = 35;
  ws.getColumn(11).width = 55;
  ws.getColumn(12).width = 40;
}

function buildConflictsSheet(
  workbook: ExcelJS.Workbook,
  supportConflictData: SupportAssignmentWithConflict[],
  eventMatches: EventMatchData[],
  matchDurationMinutes: number,
) {
  const conflicts = supportConflictData.filter((c) => c.isConflict);

  if (conflicts.length === 0) return;

  const ws = workbook.addWorksheet('Conflicts');
  const headers = ['Match time', 'Target squad', 'Opponent', 'Helper', 'Source squad', 'Conflict reason'];
  const widths = [14, 18, 22, 24, 18, 30];
  addHeaderRow(ws, headers, widths);

  for (const c of conflicts) {
    const match = eventMatches.find((m) => m.id === c.eventMatchId);
    const matchTime = match ? formatTime(match.startsAt) : '—';
    const endTime = match && matchDurationMinutes > 0
      ? formatTime(new Date(match.startsAt.getTime() + matchDurationMinutes * 60 * 1000))
      : null;
    const matchTimeDisplay = endTime ? `${matchTime}–${endTime}` : matchTime;

    ws.addRow([
      matchTimeDisplay,
      match?.eventSquad.name ?? '—',
      match?.opponentName ?? '—',
      formatPlayerName(c.firstName, c.lastName),
      c.sourceEventSquadName,
      c.conflictReason ?? '—',
    ]);
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 24;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 30;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}