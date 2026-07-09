import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from '@/test/test-db';
import ExcelJS from 'exceljs';

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock('@/lib/db', () => ({
  get db() { return getTestDb(); },
}));

vi.mock('@/lib/auth', () => ({
  requireCoachAccess: vi.fn().mockResolvedValue({ id: 'test-coach', email: 'coach@test.com' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

function getCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && 'text' in v) return (v as { text: string }).text;
      if (v && typeof v === 'object' && 'richText' in v) {
        return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
      }
      return String(v);
    }).join('');
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  }
  return String(value);
}

function getHeaderIndex(ws: ExcelJS.Worksheet, headerText: string): number {
  const headerRow = ws.getRow(1);
  let colIndex = 1;
  let found = false;
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = getCellText(cell);
    if (text === headerText) {
      colIndex = colNumber;
      found = true;
    }
  });
  return found ? colIndex : -1;
}

function findRowByCellContaining(ws: ExcelJS.Worksheet, colNumber: number, substring: string): ExcelJS.Row | null {
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const cellValue = getCellText(row.getCell(colNumber));
    if (cellValue.includes(substring)) {
      return row;
    }
  }
  return null;
}

describe('Event export route', () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 5 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createTestEvent() {
    const event = await testDb.event.create({
      data: {
        name: 'Export Test Cup',
        eventType: 'CUP',
        gameFormat: 'SEVEN_A_SIDE',
        matchDurationMinutes: 20,
        startsAt: new Date('2026-07-01T10:00:00Z'),
      },
    });

    const squad1 = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Blå',
        intent: 'COMPETITIVE',
        targetSize: 7,
        generationOrder: 1,
      },
    });

    const squad2 = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Rød',
        intent: 'BALANCED',
        targetSize: 7,
        generationOrder: 2,
      },
    });

    const blaTeamId = fixtureIds.teams['Bla']!;
    const hvitTeamId = fixtureIds.teams['Hvit']!;
    const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);
    const hvitPlayers = fixtureIds.players.filter((p) => p.coreTeamId === hvitTeamId);

    for (const p of blaPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' },
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad1.id, playerId: p.id, source: 'AUTO', locked: false },
      });
    }

    for (const p of hvitPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' },
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad2.id, playerId: p.id, source: 'AUTO', locked: false },
      });
    }

    const match1 = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad1.id,
        category: 'CUP',
        opponentName: 'Opponent A',
        startsAt: new Date('2026-07-01T10:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const match2 = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad2.id,
        category: 'CUP',
        opponentName: 'Opponent B',
        startsAt: new Date('2026-07-01T10:30:00Z'),
        status: 'SCHEDULED',
      },
    });

    return { event, squad1, squad2, match1, match2, blaPlayers, hvitPlayers };
  }

  async function exportWorkbook(eventId: string) {
    const { GET } = await import('@/app/(app)/events/[eventId]/export/route');
    const request = new Request(`http://localhost/events/${eventId}/export`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, { params: Promise.resolve({ eventId }) });
    const buffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return { response, workbook };
  }

  it('generates xlsx with Squads and Match call-out sheets', async () => {
    const { event } = await createTestEvent();
    const { response, workbook } = await exportWorkbook(event.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('spreadsheetml');

    const disposition = response.headers.get('Content-Disposition')!;
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.xlsx');
    expect(disposition).toContain('export-test-cup');

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain('Squads');
    expect(sheetNames).toContain('Match call-out');
    expect(sheetNames).not.toContain('Overview');
    expect(sheetNames).not.toContain('Support plan');
    expect(sheetNames).not.toContain('Support load');
    expect(sheetNames).not.toContain('Match plan');
  });

  it('Squads sheet contains each squad and player with correct columns', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Squads')!;
    const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Squad');
    expect(headers).toContain('Player');
    expect(headers).toContain('Primary position');
    expect(headers).toContain('GK');

    expect(headers).not.toContain('Intent');
    expect(headers).not.toContain('Selection reason');
    expect(headers).not.toContain('Rating');
    expect(headers).not.toContain('ID');

    expect(ws.rowCount - 1).toBeGreaterThanOrEqual(6);
  });

  it('Squads sheet does not include ratings or internal IDs', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Squads')!;
    const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).not.toContain('Overall');
    expect(headers).not.toContain('Rating');
    expect(headers).not.toContain('ID');
  });

  it('Match call-out sheet contains one row per match with required columns', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Date');
    expect(headers).toContain('Start');
    expect(headers).toContain('End');
    expect(headers).toContain('Squad');
    expect(headers).toContain('Opponent');
    expect(headers).toContain('Base squad players');
    expect(headers).toContain('Helpers');
    expect(headers).toContain('All involved players');
    expect(headers).toContain('Notes / conflicts');

    expect(ws.rowCount - 1).toBeGreaterThanOrEqual(2);
  });

  it('Match call-out includes base squad players and helpers with source squad', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
        plannedRole: 'Defender cover',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const helpersCol = getHeaderIndex(ws, 'Helpers');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();

    const helpersValue = getCellText(match2Row!.getCell(helpersCol));
    expect(helpersValue).toContain('from Blå');
    expect(helpersValue).toContain('Defender cover');
  });

  it('All involved players includes base squad and helpers', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const allInvolvedCol = getHeaderIndex(ws, 'All involved players');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();

    const allInvolved = getCellText(match2Row!.getCell(allInvolvedCol));
    expect(allInvolved).toContain('[helper from Blå]');
  });

  it('Match call-out shows None for helpers when no support', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const helpersCol = getHeaderIndex(ws, 'Helpers');
    const squadCol = getHeaderIndex(ws, 'Squad');

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const squadValue = getCellText(row.getCell(squadCol));
      if (!squadValue.trim()) continue;
      const helpers = getCellText(row.getCell(helpersCol));
      expect(helpers).toBe('None');
    }
  });

  it('Match call-out shows Duration not set note when event has no duration', async () => {
    const event = await testDb.event.create({
      data: {
        name: 'No Duration Cup',
        eventType: 'CUP',
        gameFormat: 'FIVE_A_SIDE',
        startsAt: new Date('2026-07-01T10:00:00Z'),
      },
    });

    const squad = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Team A',
        intent: 'BALANCED',
        targetSize: 5,
        generationOrder: 1,
      },
    });

    const blaTeamId = fixtureIds.teams['Bla']!;
    const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);

    for (const p of blaPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' },
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad.id, playerId: p.id, source: 'AUTO', locked: false },
      });
    }

    await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: 'CUP',
        opponentName: 'Test Opponent',
        startsAt: new Date('2026-07-01T10:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const notesCol = getHeaderIndex(ws, 'Notes / conflicts');

    const dataRow = ws.getRow(2);
    const notesValue = getCellText(dataRow.getCell(notesCol));
    expect(notesValue).toContain('Duration not set');
  });

  it('Cancelled match is clearly marked in status and notes', async () => {
    const { event, squad1 } = await createTestEvent();

    await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad1.id,
        category: 'CUP',
        opponentName: 'Cancelled Opponent',
        startsAt: new Date('2026-07-01T12:00:00Z'),
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: 'Weather',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const opponentCol = getHeaderIndex(ws, 'Opponent');
    const statusCol = getHeaderIndex(ws, 'Status');
    const notesCol = getHeaderIndex(ws, 'Notes / conflicts');

    const cancelledRow = findRowByCellContaining(ws, opponentCol, 'Cancelled Opponent');
    expect(cancelledRow).toBeDefined();

    const statusValue = getCellText(cancelledRow!.getCell(statusCol));
    expect(statusValue).toBe('Cancelled');

    const notesValue = getCellText(cancelledRow!.getCell(notesCol));
    expect(notesValue).toContain('Cancelled');
  });

  it('Conflicts sheet appears only when conflicts exist', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).not.toContain('Conflicts');
  });

  it('Conflicts sheet appears when support conflicts exist', async () => {
    const { event, squad1, squad2, match1, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
      },
    });

    await testDb.eventMatch.update({
      where: { id: match1.id },
      data: { startsAt: new Date('2026-07-01T10:15:00Z') },
    });

    const { workbook } = await exportWorkbook(event.id);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain('Conflicts');

    const ws = workbook.getWorksheet('Conflicts')!;
    const headerRow = ws.getRow(1);
    const headers = (headerRow.values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Helper');
    expect(headers).toContain('Source squad');
    expect(headers).toContain('Conflict reason');
    expect(headers).toContain('Match time');
  });

  it('returns 404 for nonexistent event', async () => {
    const { GET } = await import('@/app/(app)/events/[eventId]/export/route');
    const request = new Request('http://localhost/events/nonexistent/export');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, { params: Promise.resolve({ eventId: 'nonexistent' }) });

    expect(response.status).toBe(404);
  });

  it('does not include Overview, Support plan, or Support load sheets', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).not.toContain('Overview');
    expect(sheetNames).not.toContain('Support plan');
    expect(sheetNames).not.toContain('Support load');
  });

  it('Squads sheet does not include Intent column', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Squads')!;
    const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).not.toContain('Intent');
  });

  it('export uses friendly match status labels', async () => {
    const { event, squad1 } = await createTestEvent();

    await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad1.id,
        category: 'CUP',
        opponentName: 'Cancelled Team',
        startsAt: new Date('2026-07-01T12:00:00Z'),
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: 'Weather',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const statusCol = getHeaderIndex(ws, 'Status');
    const opponentCol = getHeaderIndex(ws, 'Opponent');

    const cancelledRow = findRowByCellContaining(ws, opponentCol, 'Cancelled Team');
    expect(cancelledRow).toBeDefined();
    const statusValue = getCellText(cancelledRow!.getCell(statusCol));
    expect(statusValue).toBe('Cancelled');
  });

  it('helper display includes source squad and role', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
        plannedRole: 'GK cover',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const helpersCol = getHeaderIndex(ws, 'Helpers');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();
    const helpersValue = getCellText(match2Row!.getCell(helpersCol));
    expect(helpersValue).toContain('(from Blå');
    expect(helpersValue).toContain('GK cover');
  });
});