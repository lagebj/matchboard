import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { logDataExport } from '@/lib/security/audit-log';
import {
  formatGoalkeeperAbility,
  formatPlayerName,
} from '@/lib/formatters/event-labels';
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import { safeEventExportFilename } from '@/lib/formatters/event-export-filename';
import { checkSupportConflicts, resolveMatchWindow, type SupportAssignmentWithConflict } from '@/lib/events/event-match-support';
import { getEffectiveEventSquadMatchTiming, type EventSquadMatchTiming } from '@/lib/events/event-types';
import { computeLineupRating, formatStarRating } from '@/lib/events/event-lineup-rating';

type SquadPlayer = {
  playerId: string | null;
  guestPlayerId: string | null;
  assignedRoleType: string | null;
  player: {
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string | null;
  } | null;
  guestPlayer: { id: string; name: string; sourceLabel: string | null } | null;
};

// ADR-0106: displayable name for a squad row that may be a real Player or a GuestPlayer, per
// AGENTS.md's "GuestPlayers MUST appear in contextual Match/Event/Round reports and exports".
function squadPlayerDisplayName(sp: SquadPlayer): string {
  if (sp.player) return formatPlayerName(sp.player.firstName, sp.player.lastName);
  if (sp.guestPlayer) return sp.guestPlayer.sourceLabel ? `${sp.guestPlayer.name} (Guest — ${sp.guestPlayer.sourceLabel})` : `${sp.guestPlayer.name} (Guest)`;
  return '—';
}

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

type PostMatchReportData = {
  id: string;
  eventMatchId: string;
  status: string;
  ourScore: number | null;
  opponentScore: number | null;
  playerReports: {
    playerId: string;
    attendanceStatus: string;
    minutesPlayed: number | null;
    role: string | null;
    note: string | null;
    player: { id: string; firstName: string; lastName: string | null };
  }[];
  goalEvents: {
    playerId: string | null;
    minute: number | null;
    type: string;
    note: string | null;
    scorer: { id: string; firstName: string; lastName: string | null } | null;
  }[];
  assistEvents: {
    playerId: string;
    type: string;
    assist: { id: string; firstName: string; lastName: string | null } | null;
  }[];
  eventMatch: {
    id: string;
    opponentName: string;
    eventSquadId: string;
    eventSquad: { id: string; name: string };
  };
};

function roleGroup(roleType: string | null): string {
  if (!roleType) return 'Other';
  switch (roleType) {
    case 'GOALKEEPER': return 'GK';
    case 'DEFENDER':
    case 'DEFENSIVE_MIDFIELDER': return 'DEF';
    case 'MIDFIELDER': return 'MID';
    case 'ATTACKING_MIDFIELDER':
    case 'FORWARD': return 'ATT';
    default: return 'Other';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const { eventId } = await params;

  logDataExport(ctx.email || "unknown", "xlsx", "coach", "success");

  const event = await db.event.findUnique({
    where: { id: eventId, ...ctx.orgFilter.filter },
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
              guestPlayer: {
                select: { id: true, name: true, sourceLabel: true },
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

  const isFinalized = event.status === 'FINALIZED';

  const rawEventMatches = await db.eventMatch.findMany({
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

  // ADR-0106: EventMatchSupportAssignment.playerId/player are now nullable (a GuestPlayer helper
  // assignment uses guestPlayerId instead). GuestPlayer-aware Event Match helpers in the Excel
  // export are a later, separate change; filtered to Player-backed rows as a no-op today (no
  // write path produces a guest row yet).
  const eventMatches: EventMatchData[] = rawEventMatches.map((m) => ({
    ...m,
    supportAssignments: m.supportAssignments.filter(
      (a): a is typeof a & { playerId: string; player: NonNullable<typeof a.player> } =>
        a.playerId !== null && a.player !== null,
    ),
  }));

  const timingBySquadId = new Map(
    event.squads.map((s) => [s.id, getEffectiveEventSquadMatchTiming(event, s)] as const),
  );

  const allEventMatches = eventMatches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    startsAt: m.startsAt,
    status: m.status,
  }));

  // ADR-0106: EventSquadPlayer.playerId/player are now nullable (a GuestPlayer assignment uses
  // guestPlayerId instead). The Excel export includes both -- squadPlayerDisplayName() resolves
  // either shape for display. Support-helper conflict checking (checkSupportConflicts below)
  // remains Player-only by design (Event Match helper assignment for GuestPlayers is a
  // documented, separate scope boundary -- see AGENTS.md), so its own inputs (eventSquads,
  // playerNames) stay filtered to Player-backed rows.
  const squadsWithPlayers: EventSquadData[] = event.squads.map((s) => ({
    id: s.id,
    name: s.name,
    generationOrder: s.generationOrder,
    players: s.players.filter((p) => p.player !== null || p.guestPlayer !== null),
  }));

  const playerBackedSquadRows = squadsWithPlayers.flatMap((s) =>
    s.players.filter(
      (p): p is typeof p & { playerId: string; player: NonNullable<typeof p.player> } =>
        p.playerId !== null && p.player !== null,
    ),
  );

  const playersWithPlayer = event.players.filter(
    (ep): ep is typeof ep & { playerId: string; player: NonNullable<typeof ep.player> } =>
      ep.playerId !== null && ep.player !== null,
  );

  const eventSquads = squadsWithPlayers.map((s) => ({
    id: s.id,
    name: s.name,
    players: s.players
      .filter((p): p is typeof p & { playerId: string } => p.playerId !== null)
      .map((p) => ({ playerId: p.playerId })),
  }));

  const playerAvailability = playersWithPlayer.map((ep) => ({
    playerId: ep.playerId,
    status: ep.status,
  }));

  const playerNames = new Map<string, { firstName: string; lastName: string | null }>();
  const squadNames = new Map<string, string>();
  for (const s of squadsWithPlayers) {
    squadNames.set(s.id, s.name);
  }
  for (const p of playerBackedSquadRows) {
    playerNames.set(p.playerId, { firstName: p.player.firstName, lastName: p.player.lastName });
  }
  for (const ep of playersWithPlayer) {
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
    timingBySquadId,
    eventSquads,
    playerEventAvailability: playerAvailability,
    playerNames,
    squadNames,
  });

  const squadPlayerMap = new Map<string, SquadPlayer[]>();
  for (const squad of squadsWithPlayers) {
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
          location: true,
          eventSquadId: true,
          eventSquad: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { eventMatch: { startsAt: 'asc' } },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matchboard';
  workbook.created = new Date();

  buildSquadsSheet(workbook, squadsWithPlayers);
  buildMatchCallOutSheet(workbook, eventMatches, timingBySquadId, squadPlayerMap, supportConflictData);
  buildConflictsSheet(workbook, supportConflictData, eventMatches, timingBySquadId);
  buildLineupsSheet(workbook, lineupData, eventMatches, squadsWithPlayers);

  if (isFinalized) {
    const postMatchReports = await db.eventPostMatchReport.findMany({
      where: { eventMatch: { eventId } },
      include: {
        playerReports: {
          include: {
            player: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        goalEvents: {
          include: {
            scorer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assistEvents: {
          include: {
            assist: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        eventMatch: {
          select: {
            id: true,
            opponentName: true,
            eventSquadId: true,
            eventSquad: { select: { id: true, name: true } },
          },
        },
      },
    });

    buildPlannedVsActualSheet(workbook, squadsWithPlayers, eventMatches, postMatchReports as unknown as PostMatchReportData[]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = safeEventExportFilename(event.name, event.startsAt);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  const row = ws.addRow(headers);
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i];
  });
}

function addSectionHeader(ws: ExcelJS.Worksheet, text: string, colSpan: number) {
  const row = ws.addRow([text]);
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  cell.alignment = { vertical: 'middle' };
  row.height = 22;
  if (colSpan > 1) {
    ws.mergeCells(row.number, 1, row.number, colSpan);
  }
}

function addMatchMetaRow(ws: ExcelJS.Worksheet, label: string, value: string, colSpan: number) {
  const row = ws.addRow([label, value]);
  row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
  row.getCell(2).font = { size: 10 };
  if (colSpan > 2) {
    ws.mergeCells(row.number, 2, row.number, colSpan);
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
        squadPlayerDisplayName(p),
        p.player?.primaryPosition ?? '—',
        p.player?.secondaryPosition ?? '—',
        p.player?.tertiaryPosition ?? '—',
        p.player ? formatGoalkeeperAbility(p.player.goalkeeperAbility) : '—',
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
  timingBySquadId: Map<string, EventSquadMatchTiming>,
  squadPlayerMap: Map<string, SquadPlayer[]>,
  conflictData: SupportAssignmentWithConflict[],
) {
  const ws = workbook.addWorksheet('Match call-out');

  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  const headers = ['Time', 'End', 'Squad', 'Opponent', 'Pitch', 'Players', 'Notes'];
  const widths = [10, 8, 16, 22, 14, 55, 30];
  addHeaderRow(ws, headers, widths);

  for (const m of eventMatches) {
    const window = resolveMatchWindow(m, timingBySquadId);
    const endTime = window ? window.endsAt : null;

    const squadPlayers = squadPlayerMap.get(m.eventSquadId) ?? [];
    const playerList = squadPlayers.map(squadPlayerDisplayName).join(', ');

    const helperNames = m.supportAssignments.length > 0
      ? m.supportAssignments.map((a) => {
          const name = formatPlayerName(a.player.firstName, a.player.lastName);
          const conflict = conflictData.find((c) => c.id === a.id);
          const conflictMark = conflict?.isConflict ? ' \u26A0' : '';
          return `${name} (from ${a.sourceEventSquad.name})${conflictMark}`;
        }).join(', ')
      : '';

    const allPlayers = helperNames ? `${playerList} | Helpers: ${helperNames}` : playerList;

    const notes: string[] = [];
    if (m.status === 'CANCELLED') notes.push('Cancelled');
    if (!endTime) notes.push('No duration');
    const matchConflicts = conflictData.filter((c) => c.eventMatchId === m.id && c.isConflict);
    for (const c of matchConflicts) {
      const playerName = conflictData.find((d) => d.id === c.id);
      notes.push(`${playerName ? formatPlayerName(playerName.firstName, playerName.lastName) : 'Player'}: conflict`);
    }

    const row = ws.addRow([
      formatTime(m.startsAt),
      endTime ? formatTime(endTime) : '—',
      m.eventSquad.name,
      m.opponentName,
      m.location ?? '',
      allPlayers || 'None',
      notes.length > 0 ? notes.join(', ') : '',
    ]);

    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'top', wrapText: colNumber >= 6 };
      cell.font = { size: 10 };
    });

    if (m.status === 'CANCELLED') {
      row.eachCell((cell) => {
        cell.font = { size: 10, color: { argb: 'FF9CA3AF' } };
      });
    }
  }

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 55;
  ws.getColumn(7).width = 30;
}

function buildConflictsSheet(
  workbook: ExcelJS.Workbook,
  supportConflictData: SupportAssignmentWithConflict[],
  eventMatches: EventMatchData[],
  timingBySquadId: Map<string, EventSquadMatchTiming>,
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
    const window = match ? resolveMatchWindow(match, timingBySquadId) : null;
    const endTime = window ? formatTime(window.endsAt) : null;
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
    location: string | null;
    eventSquadId: string;
    eventSquad: { id: string; name: string };
  };
};

function buildLineupsSheet(
  workbook: ExcelJS.Workbook,
  lineupData: LineupData[],
  eventMatches: EventMatchData[],
  eventSquads: EventSquadData[],
) {
  if (lineupData.length === 0) {
    for (const m of eventMatches) {
      const matchLineup = lineupData.find((l) => l.eventMatchId === m.id);
      if (!matchLineup) continue;
    }
    if (lineupData.length === 0 && eventMatches.every((m) => !lineupData.find((l) => l.eventMatchId === m.id))) {
      return;
    }
  }

  const ws = workbook.addWorksheet('Event Match Lineups');

  ws.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  const squadMap = new Map(eventSquads.map((s) => [s.id, s]));

  const matchHelperMap = new Map<string, SupportAssignment[]>();
  for (const m of eventMatches) {
    matchHelperMap.set(m.id, m.supportAssignments);
  }

  let firstSheet = true;

  for (const lineup of lineupData) {
    const match = lineup.eventMatch;
    const formation = lineup.formation;
    const formationSlots = formation?.slots ?? [];
    const totalSlots = formationSlots.length || lineup.assignments.length;
    const assignedSlots = lineup.assignments.filter((a) => a.playerId !== null);
    const starters = assignedSlots
      .filter((a) => a.player)
      .map((a) => ({ overallLevel: getPlayerOverallRating(a.player!).value }));

    const rating = computeLineupRating(starters, totalSlots);
    const isComplete = assignedSlots.length >= totalSlots;

    if (!firstSheet) {
      ws.addRow([]);
    }
    firstSheet = false;

    addSectionHeader(ws, `${match.eventSquad.name} vs ${match.opponentName}`, 5);

    const timeStr = formatTime(match.startsAt);
    const dateStr = formatDate(match.startsAt);
    const locationStr = match.location ? ` · ${match.location}` : '';
    addMatchMetaRow(ws, 'Time', `${dateStr} ${timeStr}${locationStr}`, 5);

    if (formation) {
      addMatchMetaRow(ws, 'Formation', formation.name, 5);
    }

    if (rating.averageRating !== null) {
      const stars = formatStarRating(rating.starRating) || '';
      const provLabel = rating.isProvisional ? ' · provisional' : '';
      const ratingRow = ws.addRow([
        'Rating',
        `${rating.averageRating.toFixed(1)} ${stars} · ${rating.ratedStarterCount}/${rating.totalSlots} rated${provLabel}`,
      ]);
      ratingRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
      ratingRow.getCell(2).font = { size: 10 };
    } else if (totalSlots > 0) {
      const ratingRow = ws.addRow(['Rating', `${assignedSlots.length}/${totalSlots} starters · Not rated`]);
      ratingRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
      ratingRow.getCell(2).font = { size: 10 };
    }

    if (!isComplete && totalSlots > 0) {
      const missingRoles = lineup.assignments
        .filter((a) => !a.playerId)
        .map((a) => a.slotLabel ?? a.roleType ?? '?')
        .join(', ');
      const warnRow = ws.addRow(['Missing', missingRoles]);
      warnRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFEF4444' } };
      warnRow.getCell(2).font = { size: 10, color: { argb: 'FFEF4444' } };
    }

    ws.addRow([]);

    if (formationSlots.length > 0 || lineup.assignments.length > 0) {
      const groups = new Map<string, { label: string; players: string[] }>();
      const groupOrder = ['GK', 'DEF', 'MID', 'ATT', 'Other'];

      for (const groupKey of groupOrder) {
        groups.set(groupKey, { label: groupKey, players: [] });
      }

      for (const assignment of lineup.assignments) {
        const group = roleGroup(assignment.roleType);
        const player = assignment.player;
        const playerName = player ? formatPlayerName(player.firstName, player.lastName) : '—';
        const slotLabel = assignment.slotLabel ?? '—';
        const isHelper = assignment.source === 'HELPER';
        const display = player ? `${playerName} (${slotLabel}${isHelper ? ', helper' : ''})` : `— (${slotLabel})`;
        groups.get(group)!.players.push(display);
      }

      for (const groupKey of groupOrder) {
        const g = groups.get(groupKey)!;
        if (g.players.length === 0) continue;
        const roleRow = ws.addRow([g.label, g.players.join(' · ')]);
        roleRow.getCell(1).font = { bold: true, size: 10 };
        roleRow.getCell(2).font = { size: 10 };
        roleRow.eachCell((cell) => {
          cell.alignment = { vertical: 'top' };
        });
      }
    } else if (!formation) {
      const noLineupRow = ws.addRow(['', 'No starting line-up planned']);
      noLineupRow.getCell(2).font = { size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
    }

    const starterIds = new Set(assignedSlots.map((a) => a.playerId).filter(Boolean));

    const matchHelpers = matchHelperMap.get(match.id) ?? [];

    const squad = squadMap.get(match.eventSquadId);

    const subPlayers: string[] = [];
    const processedSubIds = new Set<string>();

    for (const sp of (squad?.players ?? [])) {
      const participantId = sp.playerId ?? sp.guestPlayerId;
      if (!participantId) continue;
      if (!starterIds.has(participantId) && !processedSubIds.has(participantId)) {
        subPlayers.push(squadPlayerDisplayName(sp));
        processedSubIds.add(participantId);
      }
    }
    for (const h of matchHelpers) {
      if (!starterIds.has(h.playerId) && !processedSubIds.has(h.playerId)) {
        subPlayers.push(`${formatPlayerName(h.player.firstName, h.player.lastName)} (helper from ${h.sourceEventSquad.name})`);
        processedSubIds.add(h.playerId);
      }
    }

    if (subPlayers.length > 0) {
      ws.addRow([]);
      const subRow = ws.addRow(['Subs', subPlayers.join(' · ')]);
      subRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
      subRow.getCell(2).font = { size: 10 };
      subRow.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    }
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 60;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
}

function buildPlannedVsActualSheet(
  workbook: ExcelJS.Workbook,
  squads: EventSquadData[],
  matches: EventMatchData[],
  postMatchReports: PostMatchReportData[],
): void {
  const ws = workbook.addWorksheet('Planned vs Actual');

  const headers = [
    'Squad', 'Player', 'Planned role', 'Actual attendance', 'Minutes played',
    'Actual role', 'Goals', 'Assists', 'Match', 'Result',
  ];
  addHeaderRow(ws, headers, [14, 22, 14, 16, 14, 14, 8, 8, 22, 10]);

  for (const squad of squads) {
    for (const sp of squad.players) {
      // ADR-0106: a GuestPlayer squad row is displayed here for completeness, but never matches
      // any postMatchReports row below (evidence/stats pipelines are Player-only by construction
      // -- see AGENTS.md's statistics/evidence isolation guarantee) -- it correctly falls through
      // to the "no matching report" branch with blank actual/goals/assists.
      const playerName = squadPlayerDisplayName(sp);

      const plannedRole = sp.assignedRoleType
        ? roleGroup(sp.assignedRoleType)
        : 'Squad';

      const matchingReports = postMatchReports.filter((r) =>
        r.eventMatch.eventSquadId === squad.id,
      );

      for (const report of matchingReports) {
        const playerReport = report.playerReports.find((pr) => pr.playerId === sp.playerId);

        const actualAttendance = playerReport
          ? (playerReport.attendanceStatus === 'PRESENT' ? 'Present'
             : playerReport.attendanceStatus === 'NO_SHOW' ? 'No show'
             : playerReport.attendanceStatus === 'LATE' ? 'Late'
             : playerReport.attendanceStatus)
          : '';

        const minutesPlayed = playerReport?.minutesPlayed?.toString() ?? '';
        const actualRole = playerReport?.role ?? '';

        const goals = report.goalEvents.filter(
          (g) => g.playerId === sp.playerId,
        ).length;

        const assists = report.assistEvents.filter(
          (a) => a.playerId === sp.playerId,
        ).length;

        const matchLabel = report.eventMatch.eventSquad.name + ' vs ' + report.eventMatch.opponentName;

        let result = '';
        if (report.ourScore !== null && report.opponentScore !== null) {
          if (report.ourScore > report.opponentScore) result = 'Won';
          else if (report.ourScore < report.opponentScore) result = 'Lost';
          else result = 'Drawn';
        }

        ws.addRow([
          squad.name,
          playerName,
          plannedRole,
          actualAttendance,
          minutesPlayed,
          actualRole,
          goals,
          assists,
          matchLabel,
          result,
        ]);
      }

      if (matchingReports.length === 0) {
        ws.addRow([
          squad.name,
          playerName,
          plannedRole,
          '',
          '',
          '',
          0,
          0,
          '',
          '',
        ]);
      }
    }
  }

  for (const report of postMatchReports) {
    for (const pr of report.playerReports) {
      const isPlanned = squads.some((s) =>
        s.players.some((sp) => sp.playerId === pr.playerId),
      );
      if (isPlanned) continue;

      const playerName = formatPlayerName(pr.player.firstName, pr.player.lastName);
      const actualAttendance = pr.attendanceStatus === 'PRESENT' ? 'Present'
        : pr.attendanceStatus === 'NO_SHOW' ? 'No show'
        : pr.attendanceStatus === 'LATE' ? 'Late'
        : pr.attendanceStatus;

      const goals = report.goalEvents.filter(
        (g) => g.playerId === pr.playerId,
      ).length;

      const assists = report.assistEvents.filter(
        (a) => a.playerId === pr.playerId,
      ).length;

      const matchLabel = report.eventMatch.eventSquad.name + ' vs ' + report.eventMatch.opponentName;

      let result = '';
      if (report.ourScore !== null && report.opponentScore !== null) {
        if (report.ourScore > report.opponentScore) result = 'Won';
        else if (report.ourScore < report.opponentScore) result = 'Lost';
        else result = 'Drawn';
      }

      ws.addRow([
        report.eventMatch.eventSquad.name,
        playerName,
        'Unplanned',
        actualAttendance,
        pr.minutesPlayed?.toString() ?? '',
        pr.role ?? '',
        goals,
        assists,
        matchLabel,
        result,
      ]);
    }
  }
}