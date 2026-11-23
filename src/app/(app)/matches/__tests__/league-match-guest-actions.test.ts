import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import {
  addLeagueMatchGuestAction,
  removeLeagueMatchGuestAction,
  getLeagueMatchGuestsAction,
  getLeagueMatchGuestCandidatesAction,
  createAndAddMatchGuestAction,
} from "../league-match-guest-actions";
import { getLiveMatchPreMatchPackageAction } from "../[matchId]/live/live-actions";
import { getEffectiveLeagueMatchRoster } from "@/lib/matches/match-helper-eligibility";

/**
 * League Match guest-player actions (ADR-0106, ADR-0151). Mirrors
 * `match-helper-actions.test.ts`'s shape — the parallel write path for GuestPlayer, since
 * `LeagueMatchGuestAssignment` is guest-only by construction exactly like
 * `MatchHelperAssignment` is player-only by construction. This file did not previously exist
 * (Gate C W3, register C08, closed the gap): building C08-D against the real
 * `AddPlayerDialog`/guest actions surfaced that the cancelled-match guard
 * `assertLeagueMatchHelperEligible()` applies to real-Player helpers was entirely absent for
 * GuestPlayer assignment — fixed in `league-match-guest-actions.ts` alongside this coverage.
 */
describe("League Match guest-player actions (ADR-0106, ADR-0151)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    auth.updateOrganisationId(fixture.organisationId);
    auth.mockRequireMutationRole.mockImplementation(() => {});
    auth.mockRequireMatchGroupAccess.mockResolvedValue(null);
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.leagueMatchGuestAssignment.deleteMany({});
    await testDb.leagueRoundParticipant.deleteMany({});
    await testDb.guestPlayer.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.match.updateMany({ data: { status: "SCHEDULED" } });
  });

  async function createGuest(name = "Visiting Guest") {
    return testDb.guestPlayer.create({
      data: { organisationId: fixture.organisationId, footballGroupId: fixture.footballGroupId, name },
    });
  }

  it("rejects an unregistered guest when skipRoundRegistration is not set", async () => {
    const guest = await createGuest();

    const result = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not registered/i);
  });

  it("ADR-0151: skipRoundRegistration auto-registers an emergency guest and assigns them", async () => {
    const guest = await createGuest();

    const result = await addLeagueMatchGuestAction({
      matchId: fixture.matches.Hvit!,
      guestPlayerId: guest.id,
      skipRoundRegistration: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const participant = await testDb.leagueRoundParticipant.findFirst({
      where: { matchRoundId: fixture.matchRoundId, guestPlayerId: guest.id },
    });
    expect(participant).not.toBeNull();

    const guests = await getLeagueMatchGuestsAction(fixture.matches.Hvit!);
    expect(guests.some((g) => g.guestPlayerId === guest.id)).toBe(true);
  });

  it("createAndAddMatchGuestAction creates a new GuestPlayer and assigns them without a Round Board visit", async () => {
    const result = await createAndAddMatchGuestAction({
      matchId: fixture.matches.Hvit!,
      name: "Walk-on Guest",
      sourceLabel: "Opponent club",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const guestPlayer = await testDb.guestPlayer.findUnique({ where: { id: result.guestPlayerId } });
    expect(guestPlayer).not.toBeNull();
    expect(guestPlayer!.footballGroupId).toBe(fixture.footballGroupId);

    // No permanent roster membership: a GuestPlayer is never a Player row (ADR-0106).
    const asPlayer = await testDb.player.findUnique({ where: { id: result.guestPlayerId } });
    expect(asPlayer).toBeNull();
  });

  it("duplicate add fails safely", async () => {
    const guest = await createGuest();
    const first = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });
    expect(first.success).toBe(true);

    const second = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already assigned/i);
  });

  it("appears in the match's effective roster, tagged as a guest, without touching the planned Selection", async () => {
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await testDb.selection.create({
      data: { matchId: fixture.matches.Hvit!, matchRoundId: fixture.matchRoundId, playerId: teamBPlayer.id, role: "CORE", status: "FINALIZED", organisationId: fixture.organisationId },
    });
    const guest = await createGuest("Pre-match Guest");

    const added = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });
    expect(added.success).toBe(true);

    const roster = await getEffectiveLeagueMatchRoster(fixture.matches.Hvit!, {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    });
    const guestEntry = roster.find((p) => p.guestPlayerId === guest.id);
    expect(guestEntry).toBeDefined();
    expect(guestEntry!.source).toBe("guest");

    const plannedSelection = await testDb.selection.findFirst({ where: { playerId: teamBPlayer.id, matchId: fixture.matches.Hvit! } });
    expect(plannedSelection).not.toBeNull();
  });

  /**
   * Gate C W3 (register C08-D) finding, disclosed rather than fixed in this wave: unlike
   * `getEffectiveLeagueMatchRoster()` above, `getLiveMatchPreMatchPackageAction()`'s squad
   * (`live-actions.ts`) only ever maps planned `Selection` rows and `MatchHelperAssignment` rows
   * — `LeagueMatchGuestAssignment` is never included, even though `LiveMatchEvent` already has
   * `guestPlayerId`/`secondaryGuestPlayerId` columns anticipating guest scorer/assist support.
   * `live-match-client.tsx`'s entire event-recording flow is built around a required
   * `playerId: string` throughout (scorer/assist/rotation/position pickers), so wiring guests in
   * is a real client-wide capability addition, not a smallest-safe-seam fix — out of scope for
   * this wave; filed as https://github.com/lagebj/matchboard/issues/842 (see
   * docs/ui-lab/gate-c-w3-candidates/BLOCKERS.md).
   */
  it("DISCLOSED GAP: a guest does not yet appear in the live pre-match package squad (cannot be selected for a live event)", async () => {
    const guest = await createGuest("Live Package Gap Guest");
    const added = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });
    expect(added.success).toBe(true);

    const pkg = await getLiveMatchPreMatchPackageAction(fixture.matches.Hvit!);
    expect(pkg.success).toBe(true);
    if (!pkg.success) return;

    expect(pkg.data.squad.some((p) => "guestPlayerId" in p && p.guestPlayerId === guest.id)).toBe(false);
  });

  it("removal is refused once the guest has recorded live match events", async () => {
    const guest = await createGuest();
    const added = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });
    expect(added.success).toBe(true);
    if (!added.success) return;

    const session = await testDb.liveMatchSession.create({
      data: { matchId: fixture.matches.Hvit!, coachId: "test-user-id", organisationId: fixture.organisationId, status: "ACTIVE" },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: fixture.matches.Hvit!,
        sessionId: session.id,
        eventType: "SCORER_SET",
        guestPlayerId: guest.id,
        organisationId: fixture.organisationId,
      },
    });

    const removed = await removeLeagueMatchGuestAction(added.assignmentId);
    expect(removed.success).toBe(false);
    if (removed.success) return;
    expect(removed.error).toMatch(/live match events/i);
  });

  it("a match in another organisation cannot receive a guest (tenant isolation)", async () => {
    const guest = await createGuest();
    auth.updateOrganisationId("some-other-org-id");

    const result = await addLeagueMatchGuestAction({ matchId: fixture.matches.Hvit!, guestPlayerId: guest.id, skipRoundRegistration: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found|access denied/i);
    auth.updateOrganisationId(fixture.organisationId);
  });

  it("rejects adding a guest (both paths) to a cancelled match — mirrors the real-Player helper guard", async () => {
    const guest = await createGuest();
    await testDb.match.update({ where: { id: fixture.matches.Hvit! }, data: { status: "CANCELLED" } });

    const emergencyResult = await addLeagueMatchGuestAction({
      matchId: fixture.matches.Hvit!,
      guestPlayerId: guest.id,
      skipRoundRegistration: true,
    });
    expect(emergencyResult.success).toBe(false);
    if (!emergencyResult.success) expect(emergencyResult.error).toMatch(/cancelled/i);

    const createResult = await createAndAddMatchGuestAction({ matchId: fixture.matches.Hvit!, name: "Should Not Be Added" });
    expect(createResult.success).toBe(false);
    if (!createResult.success) expect(createResult.error).toMatch(/cancelled/i);

    await testDb.match.update({ where: { id: fixture.matches.Hvit! }, data: { status: "SCHEDULED" } });
  });

  it("getLeagueMatchGuestCandidatesAction includes unassigned group guests without requiring a prior round registration", async () => {
    const guest = await createGuest("Unregistered Group Guest");

    const candidates = await getLeagueMatchGuestCandidatesAction(fixture.matches.Hvit!);
    expect(candidates.some((c) => c.guestPlayerId === guest.id)).toBe(true);
  });
});
