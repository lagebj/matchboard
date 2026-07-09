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
import { computeLineupRating, formatStarRating } from '@/lib/events/event-lineup-rating';

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

const ROLE_ORDER = ['GOALKEEPER', 'DEFENDER', 'DEFENSIVE_MIDFIELDER', 'MIDFIELDER', 'ATTACKING_MIDFIELDER', 'FORWARD', 'FREE'] as const;

const ROLE_SHORT: Record<string, string> = {
  GOALKEEPER: 'GK',
  DEFENDER: 'DEF',
  DEFENSIVE_MIDFIELDER: 'DM',
  MIDFIELDER: 'MID',
  ATTACKING_MIDFIELDER: 'AM',
  FORWARD: 'ATT',
  FREE: 'Flex',
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

  buildSquadsSheet(workbook, event.squads);
  buildMatchCallOutSheet(workbook, eventMatches, matchDurationMinutes, squadPlayerMap, supportConflictData);
  buildConflictsSheet(workbook, supportConflictData, eventMatches, matchDurationMinutes);
  buildLineupsSheet(workbook, lineupData, eventMatches, event.squads);

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

function formatPlayerList(players: { firstName: string; lastName: string | null }[]): string {
  return players.map((p) => formatPlayerName(p.firstName, p.lastName)).join(' · ') || 'None';
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
    const endTime = matchDurationMinutes > 0
      ? new Date(m.startsAt.getTime() + matchDurationMinutes * 60 * 1000)
      : null;

    const squadPlayers = squadPlayerMap.get(m.eventSquadId) ?? [];
    const playerList = squadPlayers.map((p) =>
      formatPlayerName(p.player.firstName, p.player.lastName),
    ).join(', ');

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

function computeOverallLevel(player: {
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
} | null): number | null {
  if (!player) return null;
  const values = [
    player.ballControl, player.passing, player.firstTouch, player.oneVOneAttacking,
    player.positioning, player.oneVOneDefending, player.decisionMaking,
    player.effort, player.teamplay, player.concentration, player.speed, player.strength,
  ].filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

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
      .map((a) => ({ overallLevel: computeOverallLevel(a.player) }));

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
      const noLineupRow = ws.addRow(['', 'No starting lineup planned']);
      noLineupRow.getCell(2).font = { size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
    }

    const starterIds = new Set(assignedSlots.map((a) => a.playerId).filter(Boolean));

    const matchHelpers = matchHelperMap.get(match.id) ?? [];
    const helperIdsInSquad = new Set(matchHelpers.map((h) => h.playerId));

    const squad = squadMap.get(match.eventSquadId);
    const squadPlayerIds = new Set((squad?.players ?? []).map((p) => p.playerId));

    const subPlayers: string[] = [];
    const processedSubIds = new Set<string>();

    for (const sp of (squad?.players ?? [])) {
      if (!starterIds.has(sp.playerId) && !processedSubIds.has(sp.playerId)) {
        subPlayers.push(formatPlayerName(sp.player.firstName, sp.player.lastName));
        processedSubIds.add(sp.playerId);
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