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

function getOverviewValue(ws: ExcelJS.Worksheet, label: string): string | null {
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    if (String(row.getCell(1).value ?? '') === label) {
      return String(row.getCell(2).value ?? '');
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

  it('generates xlsx with expected sheets', async () => {
    const { event } = await createTestEvent();
    const { response, workbook } = await exportWorkbook(event.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const disposition = response.headers.get('Content-Disposition')!;
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.xlsx');
    expect(disposition).toContain('export-test-cup');

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain('Overview');
    expect(sheetNames).toContain('Squads');
    expect(sheetNames).toContain('Match plan');
    expect(sheetNames).toContain('Support plan');
    expect(sheetNames).toContain('Support load');
    expect(sheetNames).toContain('Conflicts');
  });

  it('overview sheet contains event name, game format, and duration', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Overview')!;
    expect(getOverviewValue(ws, 'Event')).toBe('Export Test Cup');
    expect(getOverviewValue(ws, 'Game format')).toBe('7-a-side');
    expect(getOverviewValue(ws, 'Match duration')).toBe('20 minutes');
    expect(getOverviewValue(ws, 'Type')).toBe('Cup');
  });

  it('match plan sheet contains matches with headers', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match plan')!;
    const headerRow = ws.getRow(1);
    const headers = (headerRow.values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Squad');
    expect(headers).toContain('Opponent');
    expect(headers).toContain('Start');
    expect(headers).toContain('End');

    expect(ws.rowCount - 1).toBeGreaterThanOrEqual(2);
  });

  it('support plan sheet includes helpers with conflict status', async () => {
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

    const ws = workbook.getWorksheet('Support plan')!;
    const headerRow = ws.getRow(1);
    const headers = (headerRow.values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Helper');
    expect(headers).toContain('Source squad');
    expect(headers).toContain('Planned role');
    expect(headers).toContain('Conflict');
  });

  it('support load sheet aggregates helpers', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
        plannedRole: 'General cover',
      },
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Support load')!;
    const headerRow = ws.getRow(1);
    const headers = (headerRow.values as (string | undefined)[]).map((v) => String(v ?? ''));
    expect(headers).toContain('Helper');
    expect(headers).toContain('Source squad');
    expect(headers).toContain('Support matches');
  });

  it('conflicts sheet shows no conflicts when support is valid', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Conflicts')!;
    const firstDataRow = ws.getRow(2);
    expect(String(firstDataRow.getCell(1).value ?? '')).toBe('No support conflicts');
  });

  it('handles missing match duration gracefully', async () => {
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

    const overviewWs = workbook.getWorksheet('Overview')!;
    expect(getOverviewValue(overviewWs, 'Match duration')).toBe('Not set');

    const matchPlanWs = workbook.getWorksheet('Match plan')!;
    const dataRows = matchPlanWs.getRows(2, matchPlanWs.rowCount - 1);
    expect(dataRows).toBeDefined();
    expect(dataRows!.length).toBeGreaterThanOrEqual(1);
    const endCellValue = String(dataRows![0].getCell(6).value ?? '');
    expect(endCellValue).toBe('Duration not set');
  });

  it('returns 404 for nonexistent event', async () => {
    const { GET } = await import('@/app/(app)/events/[eventId]/export/route');
    const request = new Request('http://localhost/events/nonexistent/export');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any, { params: Promise.resolve({ eventId: 'nonexistent' }) });

    expect(response.status).toBe(404);
  });

  it('includes cancelled match in match plan', async () => {
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

    const ws = workbook.getWorksheet('Match plan')!;
    const dataRows = ws.getRows(2, ws.rowCount - 1);
    expect(dataRows).toBeDefined();
    expect(dataRows!.length).toBeGreaterThanOrEqual(3);

    const cancelledRow = dataRows!.find((row) =>
      String(row.getCell(2).value ?? '') === 'Cancelled Opponent',
    );
    expect(cancelledRow).toBeDefined();
    expect(String(cancelledRow!.getCell(8).value ?? '')).toBe('Cancelled');
  });

  it('export uses friendly labels not enum values', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const overviewWs = workbook.getWorksheet('Overview')!;
    expect(getOverviewValue(overviewWs, 'Type')).toBe('Cup');
    expect(getOverviewValue(overviewWs, 'Game format')).toBe('7-a-side');
  });
});