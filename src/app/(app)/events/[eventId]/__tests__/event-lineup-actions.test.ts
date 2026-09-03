import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { assignPlayerToLineupSlot, removePlayerFromLineupSlot, getEligibleEventMatchPlayersAction } from "../event-lineup-actions";

// Platform-integrity-programme Phase 16 (A-007/A-009 remainder): assignPlayerToLineupSlot
// previously only checked that the target player belonged to the organisation, then derived
// BASE_SQUAD/HELPER purely from squad membership — it never verified a "HELPER" assignment was
// actually backed by an approved EventMatchSupportAssignment. Any org player could be assigned
// to any match's lineup. Fixed by routing through assertEligibleEventMatchPlayer(), the same
// canonical check every other event match surface uses.
describe("assignPlayerToLineupSlot eligibility enforcement (A-007/A-009)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
        { name: "B", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 2, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
      ],
      playersPerTeam: 4,
      rotationPaths: [],
    });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createEventFixture() {
    const event = await testDb.event.create({
      data: {
        name: "Lineup Eligibility Test Cup",
        eventType: "CUP",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 40,
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });

    const squad1 = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
    });
    const squad2 = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad 2", intent: "BALANCED", targetSize: 7, generationOrder: 1, organisationId: fixture.organisationId },
    });

    const teamAId = fixture.teams["A"]!;
    const teamBId = fixture.teams["B"]!;
    const squad1Players = fixture.players.filter((p) => p.coreTeamId === teamAId);
    const squad2Players = fixture.players.filter((p) => p.coreTeamId === teamBId);
    const outsiderPlayerId = squad2Players[0]!.id;

    for (const p of squad1Players) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: "AVAILABLE", organisationId: fixture.organisationId },
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad1.id, eventId: event.id, playerId: p.id, source: "MANUAL", locked: false, organisationId: fixture.organisationId },
      });
    }
    for (const p of squad2Players) {
      await testDb.eventPlayerAvailability.create({
        data: { eventId: event.id, playerId: p.id, status: "AVAILABLE", organisationId: fixture.organisationId },
      });
      await testDb.eventSquadPlayer.create({
        data: { eventSquadId: squad2.id, eventId: event.id, playerId: p.id, source: "MANUAL", locked: false, organisationId: fixture.organisationId },
      });
    }

    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad1.id,
        category: "CUP",
        opponentName: "Opponent",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        organisationId: fixture.organisationId,
      },
    });

    const lineup = await testDb.eventMatchLineup.create({
      data: { eventMatchId: eventMatch.id, status: "DRAFT", organisationId: fixture.organisationId },
    });

    const slot = await testDb.eventMatchLineupAssignment.create({
      data: { lineupId: lineup.id, slotId: "gk", slotIndex: 0, slotLabel: "GK", organisationId: fixture.organisationId },
    });

    return { event, squad1, squad2, eventMatch, lineup, slot, squad1Players, squad2Players, outsiderPlayerId };
  }

  it("assigns a squad player as BASE_SQUAD", async () => {
    const { lineup, slot, squad1Players } = await createEventFixture();

    const assignment = await assignPlayerToLineupSlot(lineup.id, slot.id, squad1Players[0]!.id);

    expect(assignment.playerId).toBe(squad1Players[0]!.id);
    expect(assignment.source).toBe("BASE_SQUAD");
  });

  it("assigns a player with an approved support assignment as HELPER", async () => {
    const { squad2, eventMatch, lineup, slot, squad1: sourceSquad, outsiderPlayerId } = await createEventFixture();

    await testDb.eventMatchSupportAssignment.create({
      data: {
        eventMatchId: eventMatch.id,
        playerId: outsiderPlayerId,
        sourceEventSquadId: squad2.id,
        targetEventSquadId: sourceSquad.id,
        organisationId: fixture.organisationId,
      },
    });

    const assignment = await assignPlayerToLineupSlot(lineup.id, slot.id, outsiderPlayerId);

    expect(assignment.playerId).toBe(outsiderPlayerId);
    expect(assignment.source).toBe("HELPER");
  });

  it("rejects a player who is neither in the squad nor an approved helper", async () => {
    const { lineup, slot, outsiderPlayerId } = await createEventFixture();

    await expect(assignPlayerToLineupSlot(lineup.id, slot.id, outsiderPlayerId)).rejects.toThrow(
      "not in the squad and is not a support helper",
    );
  });
});

// ADR-0106 planning-parity completion: a GuestPlayer assigned to the match's squad must be
// selectable in lineup slots on the same terms as a Player, writing to guestPlayerId (never
// playerId) and never being rejected by a stale Player-only pre-check.
describe("assignPlayerToLineupSlot with GuestPlayer participants (ADR-0106 planning parity)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, {
      teams: [
        { name: "A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
      ],
      playersPerTeam: 4,
      rotationPaths: [],
    });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createGuestEventFixture() {
    const event = await testDb.event.create({
      data: {
        name: "Guest Lineup Parity Cup",
        eventType: "CUP",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 40,
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });

    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad 1", intent: "BALANCED", targetSize: 7, generationOrder: 0, organisationId: fixture.organisationId },
    });

    const guestPlayer = await testDb.guestPlayer.create({
      data: {
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Guest Olsen",
        sourceLabel: "Friend of the team",
      },
    });

    await testDb.eventPlayerAvailability.create({
      data: { eventId: event.id, guestPlayerId: guestPlayer.id, status: "AVAILABLE", organisationId: fixture.organisationId },
    });
    await testDb.eventSquadPlayer.create({
      data: { eventSquadId: squad.id, eventId: event.id, guestPlayerId: guestPlayer.id, source: "MANUAL", locked: false, organisationId: fixture.organisationId },
    });

    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Opponent",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        organisationId: fixture.organisationId,
      },
    });

    const lineup = await testDb.eventMatchLineup.create({
      data: { eventMatchId: eventMatch.id, status: "DRAFT", organisationId: fixture.organisationId },
    });

    const slot = await testDb.eventMatchLineupAssignment.create({
      data: { lineupId: lineup.id, slotId: "gk", slotIndex: 0, slotLabel: "GK", organisationId: fixture.organisationId },
    });

    return { event, squad, guestPlayer, eventMatch, lineup, slot };
  }

  it("assigns a squad-member GuestPlayer to a lineup slot, writing guestPlayerId not playerId", async () => {
    const { lineup, slot, guestPlayer } = await createGuestEventFixture();

    const assignment = await assignPlayerToLineupSlot(lineup.id, slot.id, guestPlayer.id, "GUEST_PLAYER");

    expect(assignment.guestPlayerId).toBe(guestPlayer.id);
    expect(assignment.playerId).toBeNull();
    expect(assignment.source).toBe("BASE_SQUAD");
  });

  it("removing a GuestPlayer from a slot nulls guestPlayerId", async () => {
    const { lineup, slot, guestPlayer } = await createGuestEventFixture();
    await assignPlayerToLineupSlot(lineup.id, slot.id, guestPlayer.id, "GUEST_PLAYER");

    const updated = await removePlayerFromLineupSlot(slot.id);

    expect(updated.guestPlayerId).toBeNull();
    expect(updated.playerId).toBeNull();
  });

  it("includes the GuestPlayer in the eligible participant pool for the match", async () => {
    const { eventMatch, guestPlayer } = await createGuestEventFixture();

    const eligible = await getEligibleEventMatchPlayersAction(eventMatch.id);

    const guestEntry = eligible.find((p) => p.participantId === guestPlayer.id);
    expect(guestEntry).toBeDefined();
    expect(guestEntry?.participantType).toBe("GUEST_PLAYER");
    expect(guestEntry?.source).toBe("squad");
  });
});
