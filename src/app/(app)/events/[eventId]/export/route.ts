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
import { computeLineupRating } from '@/lib/events/event-lineup-rating';

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

  const lineupData = await db.eventMatchLineup.findMany({
    where: {
      eventMatch: { eventId },
    },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: 'asc' } } } },
      assignments: {
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
              ballControl: true,
              passing: true,
              firstTouch: true,
              oneVOneAttacking: true,
              positioning: true,
              oneVOneDefending: true,
              decisionMaking: true,
              effort: true,
              teamplay: true,
              concentration: true,
              speed: true,
              strength: true,
            },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
      eventMatch: {
        select: {
          id: true,
          opponentName: true,
          startsAt: true,
          eventSquadId: true,
          eventSquad: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { eventMatch: { startsAt: 'asc' } },
  });

  const helperPlayerIds = new Set<string>();
  for (const m of eventMatches) {
    for (const a of m.supportAssignments) {
      helperPlayerIds.add(a.playerId);
    }
  }

  const squadPlayerIdSet = new Map<string, Set<string>>();
  for (const squad of event.squads) {
    const ids = new Set(squad.players.map((p) => p.playerId));
    squadPlayerIdSet.set(squad.id, ids);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matchboard';
  workbook.created = new Date();

  buildSquadsSheet(workbook, event.squads);
  buildMatchCallOutSheet(workbook, eventMatches, matchDurationMinutes, squadPlayerMap, supportConflictData);
  buildConflictsSheet(workbook, supportConflictData, eventMatches, matchDurationMinutes);
  buildLineupsSheet(workbook, lineupData, eventMatches, helperPlayerIds, squadPlayerIdSet);

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

type LineupData = {
  id: string;
  eventMatchId: string;
  formationId: string | null;
  status: string;
  formation: {
    id: string;
    name: string;
    gameFormat: string;
    slots: { id: string; roleType: string; label: string; shortLabel: string; gridX: number; gridY: number; sortOrder: number }[];
  } | null;
  assignments: {
    id: string;
    playerId: string | null;
    slotId: string | null;
    slotIndex: number | null;
    slotLabel: string | null;
    roleType: string | null;
    source: string;
    player: {
      id: string;
      firstName: string;
      lastName: string | null;
      primaryPosition: string | null;
      secondaryPosition: string | null;
      tertiaryPosition: string | null;
      goalkeeperAbility: string;
      ballControl: number | null;
      passing: number | null;
      firstTouch: number | null;
      oneVOneAttacking: number | null;
      positioning: number | null;
      oneVOneDefending: number | null;
      decisionMaking: number | null;
      effort: number | null;
      teamplay: number | null;
      concentration: number | null;
      speed: number | null;
      strength: number | null;
    } | null;
  }[];
  eventMatch: {
    id: string;
    opponentName: string;
    startsAt: Date;
    eventSquadId: string;
    eventSquad: { id: string; name: string };
  };
};

function buildLineupsSheet(
  workbook: ExcelJS.Workbook,
  lineupData: LineupData[],
  eventMatches: EventMatchData[],
  helperPlayerIds: Set<string>,
  squadPlayerIdSet: Map<string, Set<string>>,
) {
  if (lineupData.length === 0) return;

  const ws = workbook.addWorksheet('Event Match Lineups');
  const headers = [
    'Event squad', 'Opponent', 'Match date', 'Match time',
    'Formation', 'Slot', 'Role',
    'Player', 'Primary position', 'GK',
    'Helper?', 'Source', 'Lineup rating', 'Star rating',
    'Rated starters', 'Total starters', 'Total slots', 'Provisional?',
    'Complete?',
  ];
  const widths = [16, 20, 12, 8, 18, 10, 18, 24, 16, 8, 8, 10, 14, 10, 14, 14, 12, 12, 10];
  addHeaderRow(ws, headers, widths);

  for (const lineup of lineupData) {
    const match = lineup.eventMatch;
    const formation = lineup.formation;
    const formationSlots = formation?.slots ?? [];
    const totalSlots = formationSlots.length || lineup.assignments.length;
    const assignedSlots = lineup.assignments.filter((a) => a.playerId !== null);
    const starters = assignedSlots
      .filter((a) => a.player)
      .map((a) => {
        const p = a.player!;
        const attrs: Record<string, number | null> = {
          ballControl: p.ballControl,
          passing: p.passing,
          firstTouch: p.firstTouch,
          oneVOneAttacking: p.oneVOneAttacking,
          positioning: p.positioning,
          oneVOneDefending: p.oneVOneDefending,
          decisionMaking: p.decisionMaking,
          effort: p.effort,
          teamplay: p.teamplay,
          concentration: p.concentration,
          speed: p.speed,
          strength: p.strength,
        };
        const values = Object.values(attrs).filter((v): v is number => v != null);
        const avg = values.length > 0 ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;
        return { overallLevel: avg };
      });

    const rating = computeLineupRating(starters, totalSlots);
    const isComplete = assignedSlots.length >= totalSlots;

    const slotIdToSlot = new Map(formationSlots.map((s) => [s.id, s]));

    if (lineup.assignments.length === 0 && !formation) {
      ws.addRow([
        match.eventSquad.name, match.opponentName, formatDate(match.startsAt), formatTime(match.startsAt),
        'No lineup saved', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '',
      ]);
      continue;
    }

    const ratingNum = rating.averageRating !== null ? rating.averageRating : 'Not rated';
    const starStr = rating.averageRating !== null ? '★'.repeat(Math.floor(rating.starRating)) + (rating.starRating % 1 >= 0.5 ? '½' : '') : '';
    const ratingLabel = rating.averageRating !== null
      ? `${rating.averageRating.toFixed(1)} · ${rating.ratedStarterCount}/${rating.totalSlots} rated`
      : 'Not rated';

    for (const assignment of lineup.assignments) {
      const formationSlot = assignment.slotId ? slotIdToSlot.get(assignment.slotId) : null;
      const slotLabel = assignment.slotLabel ?? formationSlot?.label ?? formationSlot?.roleType ?? '—';
      const roleLabel = assignment.roleType ?? formationSlot?.roleType ?? '—';

      const player = assignment.player;
      const playerName = player ? formatPlayerName(player.firstName, player.lastName) : '';
      const primaryPos = player?.primaryPosition ?? '';
      const gk = player ? formatGoalkeeperAbility(player.goalkeeperAbility) : '';

      const isHelper = assignment.playerId ? helperPlayerIds.has(assignment.playerId) : false;
      const source = assignment.source === 'HELPER' ? 'Helper' : 'Squad';

      const firstRowForMatch = assignment === lineup.assignments[0];
      const ratingValue = firstRowForMatch ? ratingNum : '';
      const starValue = firstRowForMatch ? starStr : '';
      const ratedCount = firstRowForMatch ? `${rating.ratedStarterCount}/${rating.totalSlots}` : '';
      const starterCount = firstRowForMatch ? assignedSlots.length : '';
      const slotCount = firstRowForMatch ? totalSlots : '';
      const provLabel = firstRowForMatch ? (rating.isProvisional ? 'Yes' : 'No') : '';
      const completeLabel = firstRowForMatch ? (isComplete ? 'Yes' : 'No') : '';

      ws.addRow([
        match.eventSquad.name,
        match.opponentName,
        formatDate(match.startsAt),
        formatTime(match.startsAt),
        formation?.name ?? '—',
        slotLabel,
        roleLabel,
        playerName || 'Unassigned',
        primaryPos,
        gk,
        isHelper ? 'Yes' : (assignment.playerId ? 'No' : ''),
        source,
        ratingValue,
        starValue,
        ratedCount,
        starterCount,
        slotCount,
        provLabel,
        completeLabel,
      ]);
    }
  }
}