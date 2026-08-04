import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from '@/test/test-db';
import type { TestFixtureIds } from '@/test/test-db';

vi.mock('@/lib/auth', () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthorizationError';
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn().mockResolvedValue({ id: 'test-coach', email: 'coach@test.com' }) };
});

vi.mock('@/lib/auth/actor-context', () => {
  const makeCtx = () => ({
    userId: 'test-coach',
    email: 'coach@test.com',
    membershipId: 'mem-test',
    organisationId: 'org-test',
    organisationSlug: 'test-org',
    role: 'COACH',
    delegatedTeamIds: null,
    orgFilter: { type: 'all' as const },
  });
  return {
    requireActorContext: vi.fn().mockResolvedValue(makeCtx()),
    requireMutationRole: vi.fn(),
    canMutate: vi.fn().mockReturnValue(true),
    canAdmin: vi.fn().mockReturnValue(false),
    canOwn: vi.fn().mockReturnValue(false),
    hasTeamAccess: vi.fn().mockReturnValue(true),
    requireTeamAccess: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  get db() { return getTestDb(); },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  createEventMatchAction,
  updateEventMatchAction,
  cancelEventMatchAction,
  reopenEventMatchAction,
  deleteEventMatchAction,
  listEventMatchesAction,
} from '../event-match-actions';
import {
  seedEventMatchReportAction,
  completeEventMatchReportAction,
  reopenEventMatchReportAction,
  updateEventMatchResultAction,
  updateEventPlayerAttendanceAction,
  addEventGoalAction,
  removeEventGoalAction,
  addEventAssistAction,
  removeEventAssistAction,
} from '../event-post-match-actions';

describe('Event match CRUD actions', () => {
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);

    const event = await testDb.event.create({
      data: {
        name: 'Test Cup Event',
        eventType: 'CUP',
        startsAt: new Date('2026-08-01'),
        gameFormat: 'SEVEN_A_SIDE',
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        squads: {
          create: { name: 'Competitive Squad', intent: 'COMPETITIVE', targetSize: 7, generationOrder: 0 },
        },
      },
      include: { squads: true },
    });
    eventId = event.id;
    squadId = event.squads[0]!.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('createEventMatchAction', () => {
    it('creates an event match with CUP category', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Test Opponent');
      formData.set('startsAt', '2026-08-01T10:00');
      formData.set('category', 'CUP');

      const match = await createEventMatchAction(formData);
      expect(match.opponentName).toBe('Test Opponent');
      expect(match.category).toBe('CUP');
      expect(match.status).toBe('SCHEDULED');
    });

    it('rejects LEAGUE category for event matches', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'League Match Attempt');
      formData.set('startsAt', '2026-08-02T10:00');
      formData.set('category', 'LEAGUE');

      await expect(createEventMatchAction(formData)).rejects.toThrow('Event matches cannot use LEAGUE category');
    });

    it('defaults category based on event type when invalid category given', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Default Category');
      formData.set('startsAt', '2026-08-03T10:00');
      formData.set('category', 'INVALID');

      const match = await createEventMatchAction(formData);
      expect(match.category).toBe('CUP');
    });

    it('stores opponent name snapshot without creating entity when no opponentTeamId provided', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'New Opponent Team');
      formData.set('startsAt', '2026-08-05T10:00');
      formData.set('category', 'CUP');

      const match = await createEventMatchAction(formData);
      expect(match.opponentName).toBe('New Opponent Team');
      expect(match.opponentTeamId).toBeNull();
    });

    it('links to existing opponent team when opponentTeamId is provided', async () => {
      const existing = await testDb.opponentTeam.create({
        data: { displayName: 'Existing FC', normalizedName: 'existing fc', organisationId: 'org-test' },
      });

      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Existing FC');
      formData.set('opponentTeamId', existing.id);
      formData.set('startsAt', '2026-08-06T10:00');
      formData.set('category', 'CUP');

      const match = await createEventMatchAction(formData);
      expect(match.opponentName).toBe('Existing FC');
      expect(match.opponentTeamId).toBe(existing.id);
    });

    it('rejects nonexistent opponentTeamId', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Ghost');
      formData.set('opponentTeamId', 'nonexistent-id');
      formData.set('startsAt', '2026-08-07T10:00');
      formData.set('category', 'CUP');

      await expect(createEventMatchAction(formData)).rejects.toThrow('Opponent team not found');
    });
  });

  describe('cancel and reopen', () => {
    let matchId: string;

    beforeAll(async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Cancel Test');
      formData.set('startsAt', '2026-08-04T10:00');
      formData.set('category', 'CUP');
      const match = await createEventMatchAction(formData);
      matchId = match.id;
    });

    it('cancels a scheduled match', async () => {
      const result = await cancelEventMatchAction(matchId, 'Weather');
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledReason).toBe('Weather');
    });

    it('reopens a cancelled match', async () => {
      const result = await reopenEventMatchAction(matchId);
      expect(result.status).toBe('SCHEDULED');
      expect(result.cancelledReason).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes a scheduled match', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Delete Test');
      formData.set('startsAt', '2026-08-05T10:00');
      formData.set('category', 'OTHER');
      const match = await createEventMatchAction(formData);

      const result = await deleteEventMatchAction(match.id);
      expect(result.success).toBe(true);
    });
  });

  describe('listEventMatchesAction', () => {
    it('returns matches for an event', async () => {
      const matches = await listEventMatchesAction(eventId);
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateEventMatchAction', () => {
    let updateEventId: string;
    let updateSquad1Id: string;
    let updateSquad2Id: string;
    let updateMatchId: string;

    beforeAll(async () => {
      const event = await testDb.event.create({
        data: {
          name: 'Update Test Event',
          eventType: 'CUP',
          startsAt: new Date('2026-10-01'),
          gameFormat: 'SEVEN_A_SIDE',
          matchDurationMinutes: 25,
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: [
              { name: 'Red Team', intent: 'COMPETITIVE', targetSize: 7, generationOrder: 0 },
              { name: 'Blue Team', intent: 'BALANCED', targetSize: 7, generationOrder: 1 },
            ],
          },
        },
        include: { squads: true },
      });
      updateEventId = event.id;
      updateSquad1Id = event.squads[0]!.id;
      updateSquad2Id = event.squads[1]!.id;

      const formData = new FormData();
      formData.set('eventId', updateEventId);
      formData.set('eventSquadId', updateSquad1Id);
      formData.set('opponentName', 'Original Opponent');
      formData.set('startsAt', '2026-10-01T10:00');
      formData.set('category', 'CUP');
      const match = await createEventMatchAction(formData);
      updateMatchId = match.id;
    });

    it('updates opponent name', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        opponentName: 'Updated Opponent',
      });
      expect(updated.opponentName).toBe('Updated Opponent');
    });

    it('updates startsAt', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        startsAt: '2026-10-01T12:00',
      });
      expect(new Date(updated.startsAt).getHours()).toBe(12);
    });

    it('updates category', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        category: 'OTHER',
      });
      expect(updated.category).toBe('OTHER');
    });

    it('updates location', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        location: 'Home pitch',
      });
      expect(updated.location).toBe('Home pitch');
    });

    it('updates notes', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        notes: 'Important match notes',
      });
      expect(updated.notes).toBe('Important match notes');
    });

    it('updates eventSquadId to another squad in same event', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        eventSquadId: updateSquad2Id,
      });
      expect(updated.eventSquadId).toBe(updateSquad2Id);
    });

    it('rejects eventSquadId from another event', async () => {
      const otherEvent = await testDb.event.create({
        data: {
          name: 'Other Event',
          eventType: 'CUP',
          startsAt: new Date('2026-11-01'),
          gameFormat: 'SEVEN_A_SIDE',
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: { name: 'Other Squad', intent: 'BALANCED', targetSize: 7, generationOrder: 0 },
          },
        },
        include: { squads: true },
      });
      const otherSquadId = otherEvent.squads[0]!.id;

      await expect(
        updateEventMatchAction(updateMatchId, { eventSquadId: otherSquadId }),
      ).rejects.toThrow('same event');
    });

    it('rejects invalid category', async () => {
      await expect(
        updateEventMatchAction(updateMatchId, { category: 'LEAGUE' }),
      ).rejects.toThrow('CUP or OTHER');
    });

    it('rejects updating match that does not exist', async () => {
      await expect(
        updateEventMatchAction('nonexistent-id', { opponentName: 'Test' }),
      ).rejects.toThrow('not found');
    });

    it('stores opponent name snapshot without creating entity when updating opponent name', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        opponentName: 'Brand New Opponent FC',
      });
      expect(updated.opponentName).toBe('Brand New Opponent FC');
      expect(updated.opponentTeamId).toBeNull();
    });

    it('links to existing opponent team when updating with opponentTeamId', async () => {
      const existing = await testDb.opponentTeam.create({
        data: { displayName: 'Linked FC', normalizedName: 'linked fc', organisationId: 'org-test' },
      });

      const updated = await updateEventMatchAction(updateMatchId, {
        opponentName: 'Linked FC',
        opponentTeamId: existing.id,
      });
      expect(updated.opponentName).toBe('Linked FC');
      expect(updated.opponentTeamId).toBe(existing.id);
    });

    it('clears opponentTeamId when updating with null opponentTeamId', async () => {
      const updated = await updateEventMatchAction(updateMatchId, {
        opponentName: 'Unlinked Opponent',
        opponentTeamId: null,
      });
      expect(updated.opponentName).toBe('Unlinked Opponent');
      expect(updated.opponentTeamId).toBeNull();
    });
  });
});

describe('Event post-match report actions', () => {
  let eventId: string;
  let squadId: string;
  let matchId: string;
  let player1Id: string;
  let player2Id: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    player1Id = fixture.players[0]!.id;
    player2Id = fixture.players[1]!.id;

    const event = await testDb.event.create({
      data: {
        name: 'Report Test Cup',
        eventType: 'CUP',
        startsAt: new Date('2026-09-01'),
        gameFormat: 'SEVEN_A_SIDE',
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        squads: {
          create: {
            name: 'Test Squad',
            intent: 'BALANCED',
            targetSize: 7,
            generationOrder: 0,
          },
        },
      },
      include: { squads: true },
    });
    eventId = event.id;
    squadId = event.squads[0]!.id;

    await testDb.eventSquadPlayer.createMany({
      data: [
        { eventSquadId: squadId, eventId: event.id, playerId: player1Id, source: 'MANUAL', locked: false , organisationId: 'org-test'},
        { eventSquadId: squadId, eventId: event.id, playerId: player2Id, source: 'MANUAL', locked: false , organisationId: 'org-test'},
      ],
    });

    const formData = new FormData();
    formData.set('eventId', eventId);
    formData.set('eventSquadId', squadId);
    formData.set('opponentName', 'Report Opponent');
    formData.set('startsAt', '2026-09-01T10:00');
    formData.set('category', 'CUP');
    const match = await createEventMatchAction(formData);
    matchId = match.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('seedEventMatchReportAction', () => {
    it('creates a draft report seeded from squad players', async () => {
      const report = await seedEventMatchReportAction(matchId);
      expect(report.status).toBe('DRAFT');
      expect(report.playerReports).toHaveLength(2);
    });

    it('rejects seeding for a cancelled match', async () => {
      const formData = new FormData();
      formData.set('eventId', eventId);
      formData.set('eventSquadId', squadId);
      formData.set('opponentName', 'Cancelled Match');
      formData.set('startsAt', '2026-09-02T10:00');
      formData.set('category', 'CUP');
      const cancelledMatch = await createEventMatchAction(formData);
      await cancelEventMatchAction(cancelledMatch.id);

      await expect(seedEventMatchReportAction(cancelledMatch.id)).rejects.toThrow();
    });

    it('rejects duplicate report', async () => {
      await expect(seedEventMatchReportAction(matchId)).rejects.toThrow('already exists');
    });
  });

  describe('updateEventMatchResultAction', () => {
    let reportId: string;

    beforeAll(async () => {
      const report = await testDb.eventPostMatchReport.findFirstOrThrow({ where: { eventMatchId: matchId } });
      reportId = report.id;
    });

    it('updates score', async () => {
      const updated = await updateEventMatchResultAction(reportId, { ourScore: 3, opponentScore: 1 });
      expect(updated.ourScore).toBe(3);
      expect(updated.opponentScore).toBe(1);
    });

    it('rejects update on locked report', async () => {
      const playerReports = await testDb.eventPostMatchPlayer.findMany({ where: { reportId } });
      for (const pr of playerReports) {
        await updateEventPlayerAttendanceAction(pr.id, 'PRESENT');
      }
      await completeEventMatchReportAction(reportId);
      await expect(updateEventMatchResultAction(reportId, { ourScore: 5 })).rejects.toThrow('locked');
    });
  });

  describe('attendance, goals, assists', () => {
    let attendanceReportId: string;
    let attendanceMatchId: string;

    beforeAll(async () => {
      const event = await testDb.event.create({
        data: {
          name: 'Attendance Test Cup',
          eventType: 'CUP',
          startsAt: new Date('2026-09-15'),
          gameFormat: 'SEVEN_A_SIDE',
          organisationId: fixture.organisationId,
          footballGroupId: fixture.footballGroupId,
          squads: {
            create: {
              name: 'Attendance Squad',
              intent: 'BALANCED',
              targetSize: 7,
              generationOrder: 0,
            },
          },
        },
        include: { squads: true },
      });
      const squad = event.squads[0];

      await testDb.eventSquadPlayer.createMany({
        data: [
          { eventSquadId: squad!.id, eventId: event.id, playerId: player1Id, source: 'MANUAL', locked: false , organisationId: 'org-test'},
          { eventSquadId: squad!.id, eventId: event.id, playerId: player2Id, source: 'MANUAL', locked: false , organisationId: 'org-test'},
        ],
      });

      const formData = new FormData();
      formData.set('eventId', event.id);
      formData.set('eventSquadId', squad!.id);
      formData.set('opponentName', 'Attendance Opponent');
      formData.set('startsAt', '2026-09-15T10:00');
      formData.set('category', 'CUP');
      const match = await createEventMatchAction(formData);
      attendanceMatchId = match.id;

      const report = await seedEventMatchReportAction(attendanceMatchId);
      attendanceReportId = report.id;
    });

    it('updates player attendance', async () => {
      const playerReport = await testDb.eventPostMatchPlayer.findFirstOrThrow({
        where: { reportId: attendanceReportId, playerId: player1Id },
      });
      const updated = await updateEventPlayerAttendanceAction(playerReport.id, 'PRESENT');
      expect(updated.attendanceStatus).toBe('PRESENT');
    });

    it('adds a goal', async () => {
      const goal = await addEventGoalAction(attendanceReportId, {
        playerId: player1Id,
        minute: 12,
        type: 'NORMAL',
      });
      expect(goal.playerId).toBe(player1Id);
      expect(goal.minute).toBe(12);
    });

    it('removes a goal', async () => {
      const goal = await addEventGoalAction(attendanceReportId, {
        playerId: player2Id,
        minute: 25,
        type: 'PENALTY',
      });
      const result = await removeEventGoalAction(goal.id);
      expect(result.success).toBe(true);
    });

    it('adds an assist', async () => {
      const assist = await addEventAssistAction(attendanceReportId, {
        playerId: player2Id,
      });
      expect(assist.playerId).toBe(player2Id);
    });

    it('removes an assist', async () => {
      const assist = await addEventAssistAction(attendanceReportId, {
        playerId: player1Id,
      });
      const result = await removeEventAssistAction(assist.id);
      expect(result.success).toBe(true);
    });

    it('completes a report when all attendance is set', async () => {
      const playerReport2 = await testDb.eventPostMatchPlayer.findFirstOrThrow({
        where: { reportId: attendanceReportId, playerId: player2Id },
      });
      await updateEventPlayerAttendanceAction(playerReport2.id, 'PRESENT');

      const completed = await completeEventMatchReportAction(attendanceReportId);
      expect(completed.status).toBe('LOCKED');
    });

    it('reopens a completed report', async () => {
      const reopened = await reopenEventMatchReportAction(attendanceReportId, 'DRAFT');
      expect(reopened.status).toBe('DRAFT');
    });
  });
});