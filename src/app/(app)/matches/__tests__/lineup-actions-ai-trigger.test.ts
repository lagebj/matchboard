import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient, FormationSlotRoleType } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { mockTriggerAiCapability } = vi.hoisted(() => ({
  mockTriggerAiCapability: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/jobs/triggers", () => ({
  triggerAiCapability: mockTriggerAiCapability,
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { createLineupFromFormation } from "@/lib/lineups/lineup-domain";
import { assignPlayerToSlot, removePlayerFromSlot, changeMatchLineupFormation } from "../lineup-actions";

function orgFilter(organisationId: string): OrgFilterMode {
  return {
    type: "org",
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

async function makeFormation(name: string, slots: Array<{ gridX: number; gridY: number; roleType: FormationSlotRoleType }>) {
  return testDb.formation.create({
    data: {
      organisationId: fixture.organisationId,
      name,
      gameFormat: "SEVEN_A_SIDE",
      source: "SYSTEM",
      slots: {
        create: slots.map((s, i) => ({
          organisationId: fixture.organisationId,
          gridX: s.gridX,
          gridY: s.gridY,
          label: `Slot ${i}`,
          shortLabel: `S${i}`,
          roleType: s.roleType,
          acceptedPositionIds: [],
          sortOrder: i,
        })),
      },
    },
    include: { slots: true },
  });
}

/**
 * Regression coverage for a live-production bug (docs/adr/0148 History): editing the starting
 * line-up through the Tactics/formation surface (`MatchLineup`/`MatchLineupAssignment`) never
 * enqueued a `lineup_review` job at all -- only the Round Board's `Selection`-role editing did
 * (`draft-selection-actions.ts`). A coach swapping a player on this page saw no AI Advisor
 * reaction whatsoever, silently, because `lineup-actions.ts` never called
 * `triggerAiCapability`. These tests assert the fix: every plan-changing mutation here now
 * triggers `LINEUP_REVIEW` for the affected match, exactly like the Round Board does.
 */
describe("lineup-actions.ts AI Advisor lineup_review trigger (ADR-0148 regression)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 4 });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    auth.updateOrganisationId(fixture.organisationId);
    mockTriggerAiCapability.mockClear();
    await testDb.matchLineupAssignment.deleteMany({});
    await testDb.matchLineup.deleteMany({});
    await testDb.formationSlot.deleteMany({});
    await testDb.formation.deleteMany({});
    // Planning must still be open (kickoff in the future) for lineup-actions.ts's
    // requirePlanningEditable() guard, unlike the fixture's default (already-past) match dates.
    await testDb.match.updateMany({ data: { startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  });

  it("assignPlayerToSlot triggers lineup_review for the match", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const formation = await makeFormation("4-2-1", [{ gridX: 0, gridY: 0, roleType: "GOALKEEPER" }]);
    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formation.id, orgFilter: orgFilter(fixture.organisationId) });
    const assignment = lineup.assignments[0]!;

    await assignPlayerToSlot(assignment.id, player.id);

    expect(mockTriggerAiCapability).toHaveBeenCalledTimes(1);
    expect(mockTriggerAiCapability).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: fixture.organisationId, capability: "LINEUP_REVIEW", scopeType: "MATCH", scopeId: matchId }),
    );
  });

  it("removePlayerFromSlot triggers lineup_review for the match", async () => {
    const matchId = fixture.matches.Hvit!;
    const teamId = fixture.teams.Hvit!;
    const player = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    const formation = await makeFormation("4-2-1 remove", [{ gridX: 0, gridY: 0, roleType: "GOALKEEPER" }]);
    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formation.id, orgFilter: orgFilter(fixture.organisationId) });
    const assignment = lineup.assignments[0]!;
    await assignPlayerToSlot(assignment.id, player.id);
    mockTriggerAiCapability.mockClear();

    await removePlayerFromSlot(assignment.id);

    expect(mockTriggerAiCapability).toHaveBeenCalledTimes(1);
    expect(mockTriggerAiCapability).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: fixture.organisationId, capability: "LINEUP_REVIEW", scopeType: "MATCH", scopeId: matchId }),
    );
  });

  it("changeMatchLineupFormation triggers lineup_review for the match", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const formationA = await makeFormation("Switch A", [{ gridX: 0, gridY: 0, roleType: "GOALKEEPER" }]);
    const formationB = await makeFormation("Switch B", [{ gridX: 1, gridY: 1, roleType: "DEFENDER" }]);
    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: orgFilter(fixture.organisationId) });
    mockTriggerAiCapability.mockClear();

    await changeMatchLineupFormation(lineup.id, formationB.id);

    expect(mockTriggerAiCapability).toHaveBeenCalledTimes(1);
    expect(mockTriggerAiCapability).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: fixture.organisationId, capability: "LINEUP_REVIEW", scopeType: "MATCH", scopeId: matchId }),
    );
  });
});
