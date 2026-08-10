import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { requireActorContext } from '@/lib/auth/actor-context';
import { logDataExport } from '@/lib/security/audit-log';
import { getPlayerOverallRating } from '@/lib/ratings/player-rating';

const INVALID_SHEET_NAME_CHARS = /[\\*?/:[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  let sanitized = name.replace(INVALID_SHEET_NAME_CHARS, '').substring(0, MAX_SHEET_NAME_LENGTH);
  if (!sanitized) sanitized = 'Sheet';
  let candidate = sanitized;
  let counter = 1;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${sanitized.substring(0, MAX_SHEET_NAME_LENGTH - String(counter).length - 1)}-${counter}`;
    counter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function safeFilename(name: string): string {
  return (name || 'teams')
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/[øö]/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireActorContext(orgSlug);
  const url = new URL(request.url);
  const leagueSeasonId = url.searchParams.get('leagueSeasonId');

  const leagueSeason = leagueSeasonId
    ? await db.leagueSeason.findFirst({
        where: { id: leagueSeasonId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : await db.leagueSeason.findFirst({
        where: { ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, startDate: true, endDate: true },
      });

  if (!leagueSeason) {
    return NextResponse.json({ error: 'No league season found' }, { status: 404 });
  }

  const teams = await db.team.findMany({
    where: {
      ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}),
      archivedAt: null,
    },
    include: {
      corePlayers: {
        where: { active: true, removedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          shirtNumber: true,
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
          coreTeamId: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      },
      formations: {
        where: { isArchived: false, source: 'CUSTOM' },
        select: { id: true, name: true, gameFormat: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      bestLineup: {
        include: {
          formation: { select: { id: true, name: true, gameFormat: true } },
          assignments: {
            include: {
              player: { select: { id: true, firstName: true, lastName: true, primaryPosition: true } },
            },
          },
        },
      },
      group: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matchboard';
  workbook.created = new Date();

  const usedSheetNames = new Set<string>();

  buildSummarySheet(workbook, teams, leagueSeason, usedSheetNames);

  for (const team of teams) {
    buildTeamSheet(workbook, team, usedSheetNames);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `matchboard-teams-${safeFilename(leagueSeason.name)}.xlsx`;

  await logDataExport(ctx.userId, 'teams_export', 'coach', 'success');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  teams: Array<{
    id: string;
    name: string;
    corePlayers: Array<{
      id: string;
      firstName: string;
      lastName: string | null;
      shirtNumber: number | null;
      primaryPosition: string;
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
      coreTeamId: string | null;
    }>;
    formations: Array<{ name: string; gameFormat: string }>;
    group: { name: string };
    bestLineup: { formationId: string | null; formation: { name: string } | null } | null;
  }>,
  leagueSeason: { id: string; name: string; startDate: Date; endDate: Date },
  usedSheetNames: Set<string>,
) {
  const sheetName = sanitizeSheetName('Summary', usedSheetNames);
  const ws = workbook.addWorksheet(sheetName);

  addSectionHeader(ws, `Teams — ${leagueSeason.name}`, 7);

  const emptyRow = ws.addRow([]);
  emptyRow.height = 8;

  addHeaderRow(
    ws,
    ['Team', 'Group', 'Formation', 'Core players', 'Avg rating', 'Best lineup formation', 'Best lineup set'],
    [22, 18, 18, 14, 12, 22, 14],
  );

  for (const team of teams) {
    const ratings = team.corePlayers.map((p) => getPlayerOverallRating({
      ballControl: p.ballControl as number | null,
      passing: p.passing as number | null,
      firstTouch: p.firstTouch as number | null,
      oneVOneAttacking: p.oneVOneAttacking as number | null,
      positioning: p.positioning as number | null,
      oneVOneDefending: p.oneVOneDefending as number | null,
      decisionMaking: p.decisionMaking as number | null,
      effort: p.effort as number | null,
      teamplay: p.teamplay as number | null,
      concentration: p.concentration as number | null,
      speed: p.speed as number | null,
      strength: p.strength as number | null,
    }));
    const validRatings = ratings.filter((r) => r.value !== null);
    const avgRating = validRatings.length > 0
      ? (validRatings.reduce((sum, r) => sum + (r.value ?? 0), 0) / validRatings.length).toFixed(1)
      : 'Not rated';

    ws.addRow([
      team.name,
      team.group?.name ?? '',
      team.formations[0]?.name ?? '—',
      team.corePlayers.length,
      avgRating,
      team.bestLineup?.formation?.name ?? '—',
      team.bestLineup?.formationId ? 'Yes' : 'No',
    ]);
  }
}

function buildTeamSheet(
  workbook: ExcelJS.Workbook,
  team: {
    id: string;
    name: string;
    corePlayers: Array<{
      id: string;
      firstName: string;
      lastName: string | null;
      shirtNumber: number | null;
      primaryPosition: string;
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
      coreTeamId: string | null;
    }>;
    bestLineup: {
      formationId: string | null;
      formation: { id: string; name: string; gameFormat: string } | null;
      assignments: Array<{
        slotId: string;
        playerId: string | null;
        locked: boolean;
        player: { id: string; firstName: string; lastName: string | null; primaryPosition: string } | null;
      }> | null;
    } | null;
  },
  usedSheetNames: Set<string>,
) {
  const sheetName = sanitizeSheetName(team.name, usedSheetNames);
  const ws = workbook.addWorksheet(sheetName);

  addSectionHeader(ws, team.name, 7);

  const emptyRow = ws.addRow([]);
  emptyRow.height = 8;

  addSectionHeader(ws, 'Core players', 7);
  addHeaderRow(
    ws,
    ['Player', 'Shirt #', 'Primary position', 'Secondary position', 'Tertiary position', 'GK ability', 'Overall rating'],
    [24, 10, 16, 16, 16, 14, 14],
  );

  for (const player of team.corePlayers) {
    const rating = getPlayerOverallRating(player);
    ws.addRow([
      `${player.firstName}${player.lastName ? ' ' + player.lastName : ''}`,
      player.shirtNumber ?? '',
      player.primaryPosition,
      player.secondaryPosition ?? '',
      player.tertiaryPosition ?? '',
      player.goalkeeperAbility,
      rating.displayValue,
    ]);
  }

  if (team.bestLineup && team.bestLineup.formationId && team.bestLineup.assignments) {
    const emptyRow2 = ws.addRow([]);
    emptyRow2.height = 8;

    addSectionHeader(ws, `Best lineup — ${team.bestLineup.formation?.name ?? 'Unknown formation'}`, 5);
    addHeaderRow(
      ws,
      ['Position', 'Role', 'Player', 'Locked', 'Player position'],
      [16, 14, 24, 10, 16],
    );

    const assignedSlots = team.bestLineup.assignments
      .filter((a) => a.playerId)
      .sort((a, b) => {
        const slotA = a.slotId;
        const slotB = b.slotId;
        return slotA.localeCompare(slotB);
      });

    for (const assignment of assignedSlots) {
      ws.addRow([
        assignment.slotId,
        '',
        assignment.player ? `${assignment.player.firstName}${assignment.player.lastName ? ' ' + assignment.player.lastName : ''}` : '',
        assignment.locked ? 'Yes' : 'No',
        assignment.player?.primaryPosition ?? '',
      ]);
    }
  } else {
    const emptyRow2 = ws.addRow([]);
    emptyRow2.height = 8;
    addSectionHeader(ws, 'Best lineup', 5);
    const noLineupRow = ws.addRow(['No best lineup configured']);
    noLineupRow.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 14;
}