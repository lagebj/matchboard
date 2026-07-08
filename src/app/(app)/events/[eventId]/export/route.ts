import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { formatGameFormat } from '@/lib/formatters/game-format';
import { MATCH_CATEGORY_LABELS } from '@/lib/stats/match-category';
import {
  formatEventType,
  formatEventSquadIntent,
  formatEventPlayerStatus,
  formatEventMatchStatus,
  formatGoalkeeperAbility,
  formatPlayerName,
} from '@/lib/formatters/event-labels';
import { safeEventExportFilename } from '@/lib/formatters/event-export-filename';
import { getEventMatchWindow } from '@/lib/events/event-match-time';
import { checkSupportConflicts } from '@/lib/events/event-match-support';

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
              primaryPosition: true,
              secondaryPosition: true,
              tertiaryPosition: true,
              goalkeeperAbility: true,
              coreTeamId: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const eventMatches = await db.eventMatch.findMany({
    where: { eventId },
    include: {
      eventSquad: { select: { id: true, name: true } },
      postMatchReport: {
        select: {
          id: true,
          status: true,
          ourScore: true,
          opponentScore: true,
        },
      },
      supportAssignments: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          sourceEventSquad: { select: { id: true, name: true } },
          targetEventSquad: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { startsAt: 'asc' },
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matchboard';
  workbook.created = new Date();

  buildOverviewSheet(workbook, event, eventMatches, supportConflictData, matchDurationMinutes);
  buildSquadsSheet(workbook, event);
  buildMatchPlanSheet(workbook, eventMatches, matchDurationMinutes, supportConflictData, playerNames, squadNames);
  buildSupportPlanSheet(workbook, eventMatches, matchDurationMinutes, supportConflictData, playerNames, squadNames);
  buildSupportLoadSheet(workbook, supportConflictData, playerNames, squadNames);
  buildConflictsSheet(workbook, supportConflictData, playerNames, squadNames, eventMatches, matchDurationMinutes);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = safeEventExportFilename(event.name, event.startsAt);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers);
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 0;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.max(maxLen + 2, 10);
  });
}

function buildOverviewSheet(
  workbook: ExcelJS.Workbook,
  event: {
    name: string;
    eventType: string;
    gameFormat: string;
    startsAt: Date;
    endsAt: Date | null;
    matchDurationMinutes: number | null;
    squads: unknown[];
  },
  eventMatches: { status: string; supportAssignments: unknown[] }[],
  supportConflictData: { isConflict: boolean }[],
  matchDurationMinutes: number,
) {
  const ws = workbook.addWorksheet('Overview');
  const conflictCount = supportConflictData.filter((d) => d.isConflict).length;
  const completedMatches = eventMatches.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'CANCELLED',
  ).length;

  const data: [string, string][] = [
    ['Event', event.name],
    ['Type', formatEventType(event.eventType)],
    ['Game format', formatGameFormat(event.gameFormat)],
    ['Date', formatDate(event.startsAt)],
    ['End date', event.endsAt ? formatDate(event.endsAt) : '—'],
    ['Match duration', event.matchDurationMinutes ? `${event.matchDurationMinutes} minutes` : 'Not set'],
    ['Squads', String(event.squads.length)],
    ['Matches', String(eventMatches.length)],
    ['Planned helpers', String(eventMatches.reduce((sum, m) => sum + m.supportAssignments.length, 0))],
    ['Support conflicts', String(conflictCount)],
    ['Exported', formatDateTime(new Date())],
  ];

  addHeaderRow(ws, ['Property', 'Value']);
  for (const [label, value] of data) {
    ws.addRow([label, value]);
  }
  autoWidth(ws);
}

function buildSquadsSheet(
  workbook: ExcelJS.Workbook,
  event: {
    squads: {
      name: string;
      intent: string;
      players: {
        player: {
          firstName: string;
          lastName: string | null;
          primaryPosition: string | null;
          secondaryPosition: string | null;
          tertiaryPosition: string | null;
          goalkeeperAbility: string | null;
        };
      }[];
    }[];
  },
) {
  const ws = workbook.addWorksheet('Squads');
  addHeaderRow(ws, [
    'Squad',
    'Intent',
    'Player',
    'Primary position',
    'Secondary position',
    'Tertiary position',
    'Goalkeeper ability',
  ]);

  for (const squad of event.squads) {
    for (const p of squad.players) {
      ws.addRow([
        squad.name,
        formatEventSquadIntent(squad.intent),
        formatPlayerName(p.player.firstName, p.player.lastName),
        p.player.primaryPosition ?? '—',
        p.player.secondaryPosition ?? '—',
        p.player.tertiaryPosition ?? '—',
        formatGoalkeeperAbility(p.player.goalkeeperAbility),
      ]);
    }
  }
  autoWidth(ws);
}

function buildMatchPlanSheet(
  workbook: ExcelJS.Workbook,
  eventMatches: {
    id: string;
    category: string;
    opponentName: string;
    startsAt: Date;
    location: string | null;
    status: string;
    cancelledAt: Date | null;
    eventSquad: { id: string; name: string };
    postMatchReport: {
      id: string;
      status: string;
      ourScore: number | null;
      opponentScore: number | null;
    } | null;
    supportAssignments: {
      playerId: string;
      player: { firstName: string; lastName: string | null };
      sourceEventSquadId: string;
      sourceEventSquad: { id: string; name: string };
      plannedRole: string | null;
    }[];
  }[],
  matchDurationMinutes: number,
  supportConflictData: {
    eventMatchId: string;
    playerId: string;
    isConflict: boolean;
  }[],
  playerNames: Map<string, { firstName: string; lastName: string | null }>,
  squadNames: Map<string, string>,
) {
  const ws = workbook.addWorksheet('Match plan');
  addHeaderRow(ws, [
    'Squad',
    'Opponent',
    'Category',
    'Date',
    'Start',
    'End',
    'Location',
    'Status',
    'Score',
    'Report',
    'Planned helpers',
    'Helper source squads',
    'Conflict count',
  ]);

  for (const m of eventMatches) {
    const endTime = matchDurationMinutes > 0
      ? new Date(m.startsAt.getTime() + matchDurationMinutes * 60 * 1000)
      : null;

    const matchConflicts = supportConflictData.filter((c) => c.eventMatchId === m.id);
    const conflictCount = matchConflicts.filter((c) => c.isConflict).length;

    const helperNames = m.supportAssignments.map((a) =>
      formatPlayerName(a.player.firstName, a.player.lastName),
    );
    const sourceSquadNames = m.supportAssignments.map((a) => a.sourceEventSquad.name);

    const score = m.postMatchReport?.ourScore !== null && m.postMatchReport?.ourScore !== undefined
      ? `${m.postMatchReport.ourScore}-${m.postMatchReport.opponentScore}`
      : '—';

    const reportStatus = m.postMatchReport
      ? (MATCH_CATEGORY_LABELS as Record<string, string>)[m.postMatchReport.status] ?? m.postMatchReport.status
      : '—';

    ws.addRow([
      m.eventSquad.name,
      m.opponentName,
      (MATCH_CATEGORY_LABELS as Record<string, string>)[m.category] ?? m.category,
      formatDate(m.startsAt),
      formatTime(m.startsAt),
      endTime ? formatTime(endTime) : 'Duration not set',
      m.location ?? '—',
      formatEventMatchStatus(m.status),
      score,
      reportStatus,
      helperNames.length > 0 ? helperNames.join(', ') : 'None',
      sourceSquadNames.length > 0 ? sourceSquadNames.join(', ') : '—',
      conflictCount,
    ]);
  }
  autoWidth(ws);
}

function buildSupportPlanSheet(
  workbook: ExcelJS.Workbook,
  eventMatches: {
    id: string;
    category: string;
    opponentName: string;
    startsAt: Date;
    status: string;
    eventSquad: { id: string; name: string };
    supportAssignments: {
      id: string;
      playerId: string;
      player: { firstName: string; lastName: string | null };
      sourceEventSquadId: string;
      sourceEventSquad: { id: string; name: string };
      plannedRole: string | null;
      note: string | null;
    }[];
  }[],
  matchDurationMinutes: number,
  supportConflictData: {
    id: string;
    eventMatchId: string;
    playerId: string;
    firstName: string;
    lastName: string | null;
    sourceEventSquadName: string;
    isConflict: boolean;
    conflictReason: string | null;
    plannedRole: string | null;
    note: string | null;
  }[],
  playerNames: Map<string, { firstName: string; lastName: string | null }>,
  squadNames: Map<string, string>,
) {
  const ws = workbook.addWorksheet('Support plan');
  addHeaderRow(ws, [
    'Match start',
    'Match end',
    'Target squad',
    'Opponent',
    'Helper',
    'Source squad',
    'Planned role',
    'Note',
    'Conflict',
    'Conflict reason',
  ]);

  for (const m of eventMatches) {
    const endTime = matchDurationMinutes > 0
      ? new Date(m.startsAt.getTime() + matchDurationMinutes * 60 * 1000)
      : null;

    for (const a of m.supportAssignments) {
      const conflict = supportConflictData.find((c) => c.id === a.id);
      ws.addRow([
        formatTime(m.startsAt),
        endTime ? formatTime(endTime) : 'Duration not set',
        m.eventSquad.name,
        m.opponentName,
        formatPlayerName(a.player.firstName, a.player.lastName),
        a.sourceEventSquad.name,
        a.plannedRole ?? '—',
        a.note ?? '—',
        conflict?.isConflict ? 'Conflict' : 'OK',
        conflict?.conflictReason ?? '—',
      ]);
    }
  }
  autoWidth(ws);
}

function buildSupportLoadSheet(
  workbook: ExcelJS.Workbook,
  supportConflictData: {
    playerId: string;
    firstName: string;
    lastName: string | null;
    sourceEventSquadName: string;
    isConflict: boolean;
  }[],
  playerNames: Map<string, { firstName: string; lastName: string | null }>,
  squadNames: Map<string, string>,
) {
  const ws = workbook.addWorksheet('Support load');

  const helperMap = new Map<string, {
    name: string;
    sourceSquad: string;
    matchCount: number;
    conflictCount: number;
  }>();

  for (const a of supportConflictData) {
    const existing = helperMap.get(a.playerId);
    if (existing) {
      existing.matchCount++;
      if (a.isConflict) existing.conflictCount++;
    } else {
      helperMap.set(a.playerId, {
        name: formatPlayerName(a.firstName, a.lastName),
        sourceSquad: a.sourceEventSquadName,
        matchCount: 1,
        conflictCount: a.isConflict ? 1 : 0,
      });
    }
  }

  addHeaderRow(ws, [
    'Helper',
    'Source squad',
    'Support matches',
    'Conflict count',
  ]);

  for (const [, info] of helperMap) {
    ws.addRow([
      info.name,
      info.sourceSquad,
      info.matchCount,
      info.conflictCount,
    ]);
  }
  autoWidth(ws);
}

function buildConflictsSheet(
  workbook: ExcelJS.Workbook,
  supportConflictData: {
    eventMatchId: string;
    playerId: string;
    firstName: string;
    lastName: string | null;
    sourceEventSquadName: string;
    isConflict: boolean;
    conflictReason: string | null;
  }[],
  playerNames: Map<string, { firstName: string; lastName: string | null }>,
  squadNames: Map<string, string>,
  eventMatches: {
    id: string;
    opponentName: string;
    startsAt: Date;
    eventSquad: { name: string };
  }[],
  matchDurationMinutes: number,
) {
  const ws = workbook.addWorksheet('Conflicts');
  const conflicts = supportConflictData.filter((c) => c.isConflict);

  if (conflicts.length === 0) {
    addHeaderRow(ws, ['Status']);
    ws.addRow(['No support conflicts']);
    autoWidth(ws);
    return;
  }

  addHeaderRow(ws, [
    'Match start',
    'Target squad',
    'Opponent',
    'Helper',
    'Source squad',
    'Conflict reason',
  ]);

  for (const c of conflicts) {
    const match = eventMatches.find((m) => m.id === c.eventMatchId);
    ws.addRow([
      match ? formatTime(match.startsAt) : '—',
      match?.eventSquad.name ?? '—',
      match?.opponentName ?? '—',
      formatPlayerName(c.firstName, c.lastName),
      c.sourceEventSquadName,
      c.conflictReason ?? '—',
    ]);
  }
  autoWidth(ws);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}