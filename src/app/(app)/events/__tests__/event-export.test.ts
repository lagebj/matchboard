import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import type { FormationSlotRoleType } from '@/generated/prisma/client';
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from '@/test/test-db';
import ExcelJS from 'exceljs';
import { mockAuthContext } from '@/test/support/auth-mock';

const auth = mockAuthContext({ role: 'COACH' });

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock('@/lib/db', () => ({
  get db() { return getTestDb(); },
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
    auth.updateOrganisationId(fixtureIds.organisationId);
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
        organisationId: fixtureIds.organisationId,
        footballGroupId: fixtureIds.footballGroupId,
      },
    });

    const squad1 = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Blå',
        intent: 'COMPETITIVE',
        targetSize: 7,
        generationOrder: 1,
              organisationId: fixtureIds.organisationId,
},
    });

    const squad2 = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Rød',
        intent: 'BALANCED',
        targetSize: 7,
        generationOrder: 2,
              organisationId: fixtureIds.organisationId,
},
    });

    const blaTeamId = fixtureIds.teams['Bla']!;
    const hvitTeamId = fixtureIds.teams['Hvit']!;
    const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);
    const hvitPlayers = fixtureIds.players.filter((p) => p.coreTeamId === hvitTeamId);

    for (const p of blaPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' , organisationId: fixtureIds.organisationId},
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad1.id, eventId: event.id, playerId: p.id, source: 'AUTO', locked: false , organisationId: fixtureIds.organisationId},
      });
    }

    for (const p of hvitPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' , organisationId: fixtureIds.organisationId},
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad2.id, eventId: event.id, playerId: p.id, source: 'AUTO', locked: false , organisationId: fixtureIds.organisationId},
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
              organisationId: fixtureIds.organisationId,
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
              organisationId: fixtureIds.organisationId,
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
    expect(headers).toContain('Time');
    expect(headers).toContain('End');
    expect(headers).toContain('Squad');
    expect(headers).toContain('Opponent');
    expect(headers).toContain('Players');
    expect(headers).toContain('Notes');

    expect(ws.rowCount - 1).toBeGreaterThanOrEqual(2);
  });

  it('Match call-out includes helpers in Players column with source squad', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
        plannedRole: 'Defender cover',
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const playersCol = getHeaderIndex(ws, 'Players');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();

    const playersValue = getCellText(match2Row!.getCell(playersCol));
    expect(playersValue).toContain('from Blå');
    expect(playersValue).toContain('Helpers:');
  });

  it('Players column includes helpers with source squad marker', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const playersCol = getHeaderIndex(ws, 'Players');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();

    const playersValue = getCellText(match2Row!.getCell(playersCol));
    expect(playersValue).toContain('(from Blå)');
  });

  it('Match call-out shows Players as base names only when no support', async () => {
    const { event } = await createTestEvent();
    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const playersCol = getHeaderIndex(ws, 'Players');
    const squadCol = getHeaderIndex(ws, 'Squad');

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const squadValue = getCellText(row.getCell(squadCol));
      if (!squadValue.trim()) continue;
      const players = getCellText(row.getCell(playersCol));
      expect(players).not.toContain('Helpers');
    }
  });

  it('Match call-out shows No duration note when event has no duration', async () => {
    const event = await testDb.event.create({
      data: {
        name: 'No Duration Cup',
        eventType: 'CUP',
        gameFormat: 'FIVE_A_SIDE',
        startsAt: new Date('2026-07-01T10:00:00Z'),
        organisationId: fixtureIds.organisationId,
        footballGroupId: fixtureIds.footballGroupId,
      },
    });

    const squad = await testDb.eventSquad.create({
      data: {
        eventId: event.id,
        name: 'Team A',
        intent: 'BALANCED',
        targetSize: 5,
        generationOrder: 1,
              organisationId: fixtureIds.organisationId,
},
    });

    const blaTeamId = fixtureIds.teams['Bla']!;
    const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);

    for (const p of blaPlayers.slice(0, 3)) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: 'AVAILABLE' , organisationId: fixtureIds.organisationId},
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad.id, eventId: event.id, playerId: p.id, source: 'AUTO', locked: false , organisationId: fixtureIds.organisationId},
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
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const notesCol = getHeaderIndex(ws, 'Notes');

    const dataRow = ws.getRow(2);
    const notesValue = getCellText(dataRow.getCell(notesCol));
    expect(notesValue).toContain('No duration');
  });

  it('Cancelled match is clearly marked in notes and greyed out', async () => {
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
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const opponentCol = getHeaderIndex(ws, 'Opponent');
    const notesCol = getHeaderIndex(ws, 'Notes');

    const cancelledRow = findRowByCellContaining(ws, opponentCol, 'Cancelled Opponent');
    expect(cancelledRow).toBeDefined();

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
              organisationId: fixtureIds.organisationId,
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
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const opponentCol = getHeaderIndex(ws, 'Opponent');
    const notesCol = getHeaderIndex(ws, 'Notes');

    const cancelledRow = findRowByCellContaining(ws, opponentCol, 'Cancelled Team');
    expect(cancelledRow).toBeDefined();
    const notesValue = getCellText(cancelledRow!.getCell(notesCol));
    expect(notesValue).toContain('Cancelled');
  });

  it('helper display includes source squad in Players column', async () => {
    const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: match2.id,
        playerId: blaPlayers[0].id,
        sourceEventSquadId: squad1.id,
        targetEventSquadId: squad2.id,
        plannedRole: 'GK cover',
              organisationId: fixtureIds.organisationId,
},
    });

    const { workbook } = await exportWorkbook(event.id);

    const ws = workbook.getWorksheet('Match call-out')!;
    const squadCol = getHeaderIndex(ws, 'Squad');
    const playersCol = getHeaderIndex(ws, 'Players');

    const match2Row = findRowByCellContaining(ws, squadCol, 'Rød');
    expect(match2Row).toBeDefined();
    const playersValue = getCellText(match2Row!.getCell(playersCol));
    expect(playersValue).toContain('(from Blå)');
  });

  describe('Event Match Lineups sheet', () => {
    it('includes Event Match Lineups sheet when lineups exist', async () => {
      const { event, squad1 } = await createTestEvent();

      const blaTeamId = fixtureIds.teams['Bla']!;
      const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);

      const formation = await testDb.formation.create({
        data: {
          name: 'Test 7v7',
          gameFormat: 'SEVEN_A_SIDE',
          source: 'CUSTOM',
          isArchived: false,
          organisationId: fixtureIds.organisationId,
        },
      });

      const slotPositions: { gridX: number; gridY: number; label: string; shortLabel: string; roleType: FormationSlotRoleType; sortOrder: number }[] = [
        { gridX: 2, gridY: 5, label: 'GK', shortLabel: 'GK', roleType: 'GOALKEEPER' as FormationSlotRoleType, sortOrder: 0 },
        { gridX: 0, gridY: 4, label: 'LB', shortLabel: 'LB', roleType: 'DEFENDER' as FormationSlotRoleType, sortOrder: 1 },
        { gridX: 2, gridY: 4, label: 'CB', shortLabel: 'CB', roleType: 'DEFENDER' as FormationSlotRoleType, sortOrder: 2 },
        { gridX: 4, gridY: 4, label: 'RB', shortLabel: 'RB', roleType: 'DEFENDER' as FormationSlotRoleType, sortOrder: 3 },
        { gridX: 2, gridY: 2, label: 'CM', shortLabel: 'CM', roleType: 'MIDFIELDER' as FormationSlotRoleType, sortOrder: 4 },
        { gridX: 2, gridY: 1, label: 'AM', shortLabel: 'AM', roleType: 'ATTACKING_MIDFIELDER' as FormationSlotRoleType, sortOrder: 5 },
        { gridX: 2, gridY: 0, label: 'ST', shortLabel: 'ST', roleType: 'FORWARD' as FormationSlotRoleType, sortOrder: 6 },
      ];

      for (const slot of slotPositions) {
        await testDb.formationSlot.create({
          data: {
            formationId: formation.id,
            ...slot,
            acceptedPositionIds: [],
                      organisationId: fixtureIds.organisationId,
},
        });
      }

      const match = await testDb.eventMatch.findFirst({
        where: { eventId: event.id, eventSquadId: squad1.id },
      });

      const lineup = await testDb.eventMatchLineup.create({
        data: {
          eventMatchId: match!.id,
          formationId: formation.id,
          status: 'DRAFT',
                  organisationId: fixtureIds.organisationId,
},
      });

      const firstPlayer = blaPlayers[0];
      await testDb.eventMatchLineupAssignment.create({
        data: {
          lineupId: lineup.id,
          playerId: firstPlayer.id,
          slotId: slotPositions[0].label,
          slotIndex: 0,
          slotLabel: 'GK',
          roleType: 'GOALKEEPER',
          source: 'BASE_SQUAD',
                  organisationId: fixtureIds.organisationId,
},
      });

      const { workbook } = await exportWorkbook(event.id);

      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toContain('Event Match Lineups');
    });

    it('shows match header, formation, and assigned player in lineup export', async () => {
      const { event, squad1 } = await createTestEvent();

      const blaTeamId = fixtureIds.teams['Bla']!;
      const blaPlayers = fixtureIds.players.filter((p) => p.coreTeamId === blaTeamId);

      const formation = await testDb.formation.create({
        data: {
          name: 'Test 7v7 B',
          gameFormat: 'SEVEN_A_SIDE',
          source: 'CUSTOM',
          isArchived: false,
          organisationId: fixtureIds.organisationId,
        },
      });

      const slotPositions2: { gridX: number; gridY: number; label: string; shortLabel: string; roleType: FormationSlotRoleType; sortOrder: number }[] = [
        { gridX: 2, gridY: 5, label: 'GK', shortLabel: 'GK', roleType: 'GOALKEEPER' as FormationSlotRoleType, sortOrder: 0 },
        { gridX: 2, gridY: 2, label: 'CM', shortLabel: 'CM', roleType: 'MIDFIELDER' as FormationSlotRoleType, sortOrder: 1 },
      ];

      for (const slot of slotPositions2) {
        await testDb.formationSlot.create({
          data: {
            formationId: formation.id,
            ...slot,
            acceptedPositionIds: [],
                      organisationId: fixtureIds.organisationId,
},
        });
      }

      const match = await testDb.eventMatch.findFirst({
        where: { eventId: event.id, eventSquadId: squad1.id },
      });

      const lineup = await testDb.eventMatchLineup.create({
        data: {
          eventMatchId: match!.id,
          formationId: formation.id,
          status: 'DRAFT',
                  organisationId: fixtureIds.organisationId,
},
      });

      await testDb.eventMatchLineupAssignment.create({
        data: {
          lineupId: lineup.id,
          playerId: blaPlayers[0].id,
          slotId: 'GK',
          slotIndex: 0,
          slotLabel: 'GK',
          roleType: 'GOALKEEPER',
          source: 'BASE_SQUAD',
                  organisationId: fixtureIds.organisationId,
},
      });

      await testDb.eventMatchLineupAssignment.create({
        data: {
          lineupId: lineup.id,
          playerId: null,
          slotId: 'CM',
          slotIndex: 1,
          slotLabel: 'CM',
          roleType: 'MIDFIELDER',
          source: 'BASE_SQUAD',
                  organisationId: fixtureIds.organisationId,
},
      });

      const { workbook } = await exportWorkbook(event.id);
      const ws = workbook.getWorksheet('Event Match Lineups')!;

      let foundPlayerName = false;
      let foundFormation = false;
      let foundGK = false;

      for (let i = 1; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        for (let j = 1; j <= ws.columnCount; j++) {
          const cellText = getCellText(row.getCell(j));
          if (cellText.includes(blaPlayers[0].firstName)) foundPlayerName = true;
          if (cellText.includes('Test 7v7')) foundFormation = true;
          if (cellText === 'GK') foundGK = true;
        }
      }

      expect(foundPlayerName).toBe(true);
      expect(foundFormation).toBe(true);
      expect(foundGK).toBe(true);
    });

    it('does not include Event Match Lineups when no lineups exist', async () => {
      const { event } = await createTestEvent();
      const { workbook } = await exportWorkbook(event.id);

      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).not.toContain('Event Match Lineups');
    });

    it('shows helper player with helper marker in lineup', async () => {
      const { event, squad1, squad2, match2, blaPlayers } = await createTestEvent();

      await testDb.eventMatchSupportAssignment.create({
        data: {
          eventMatchId: match2.id,
          playerId: blaPlayers[0].id,
          sourceEventSquadId: squad1.id,
          targetEventSquadId: squad2.id,
          plannedRole: 'GK cover',
                  organisationId: fixtureIds.organisationId,
},
      });

      const formation = await testDb.formation.create({
        data: {
          name: 'Test 7v7 C',
          gameFormat: 'SEVEN_A_SIDE',
          source: 'CUSTOM',
          isArchived: false,
          organisationId: fixtureIds.organisationId,
        },
      });

      const slot = { gridX: 2, gridY: 5, label: 'GK', shortLabel: 'GK', roleType: 'GOALKEEPER' as FormationSlotRoleType, sortOrder: 0 };
      await testDb.formationSlot.create({
        data: { formationId: formation.id, ...slot, acceptedPositionIds: [] , organisationId: fixtureIds.organisationId},
      });

      const lineup = await testDb.eventMatchLineup.create({
        data: {
          eventMatchId: match2.id,
          formationId: formation.id,
          status: 'DRAFT',
                  organisationId: fixtureIds.organisationId,
},
      });

      await testDb.eventMatchLineupAssignment.create({
        data: {
          lineupId: lineup.id,
          playerId: blaPlayers[0].id,
          slotId: 'GK',
          slotIndex: 0,
          slotLabel: 'GK',
          roleType: 'GOALKEEPER',
          source: 'HELPER',
                  organisationId: fixtureIds.organisationId,
},
      });

      const { workbook } = await exportWorkbook(event.id);
      const ws = workbook.getWorksheet('Event Match Lineups')!;

      let foundHelper = false;
      for (let i = 1; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        for (let j = 1; j <= ws.columnCount; j++) {
          const cellText = getCellText(row.getCell(j));
          if (cellText.includes('helper') || cellText.includes('Helper')) {
            foundHelper = true;
          }
        }
      }

      expect(foundHelper).toBe(true);
    });
  });
});