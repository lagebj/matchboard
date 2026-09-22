import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildMatchInsightFacts } from "@/lib/matches/match-insights/build-match-insight-facts";
import type { CurrentPlanInput } from "@/lib/matches/match-insights/types";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;
let orgFilter: OrgFilterMode;

describe("match-insights/build-match-insight-facts", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
    orgFilter = {
      type: "org",
      filter: { organisationId: fixtureIds.organisationId },
      filterNullable: { organisationId: fixtureIds.organisationId },
      organisationId: fixtureIds.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.opponentSportingEvidence.deleteMany({});
    await testDb.opponentEncounterObservation.deleteMany({});
    await testDb.combinationEvidence.deleteMany({});
    await testDb.developmentThread.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
  });

  function planFor(overrides: Partial<CurrentPlanInput> & { squad: CurrentPlanInput["squad"] }): CurrentPlanInput {
    return {
      matchId: fixtureIds.matches["Bla"],
      teamId: fixtureIds.teams["Bla"],
      organisationId: fixtureIds.organisationId,
      leagueSeasonId: fixtureIds.leagueSeasonId,
      opponentTeamId: null,
      formation: "4-3-3",
      matchStartsAt: new Date("2026-10-15T10:00:00Z"),
      plannedRotations: [],
      ...overrides,
    };
  }

  it("returns no facts for players with no recorded history, and states no exact-opponent history explicitly", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const bundle = await buildMatchInsightFacts(
      planFor({ squad: [{ playerId: core1.id, role: "CORE", position: core1.primaryPosition }, { playerId: core2.id, role: "CORE", position: core2.primaryPosition }] }),
      orgFilter,
    );

    expect(bundle.opponentContext.exactOpponentHistoryAvailable).toBe(false);
    expect(bundle.opponentContext.previousEncounterCount).toBe(0);
    expect(bundle.playerSummaries.get(core1.id)?.season.appearances).toBe(0);
    // ATTRIBUTE_PROFILE is always emitted (per-player baseline fact); STARTING_PATTERN/GOAL_INVOLVEMENT are not, with zero history.
    const factTypes = bundle.facts.map((f) => f.type);
    expect(factTypes).toContain("ATTRIBUTE_PROFILE");
    expect(factTypes).not.toContain("STARTING_PATTERN");
    expect(factTypes).not.toContain("GOAL_INVOLVEMENT");
  });

  it("never includes another opponent's evidence when preparing against a specific exact opponent (tenant/opponent boundary)", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const otherMatchId = fixtureIds.matches["Hvit"];
    const otherMatch = await testDb.match.findUniqueOrThrow({ where: { id: otherMatchId }, select: { opponentTeamId: true } });
    const thisMatch = await testDb.match.findUniqueOrThrow({ where: { id: fixtureIds.matches["Bla"] }, select: { opponentTeamId: true } });
    const otherOpponentTeamId = otherMatch.opponentTeamId!;
    const thisOpponentTeamId = thisMatch.opponentTeamId!;

    // Evidence recorded against a *different* opponent must never leak into this match's context.
    await testDb.opponentSportingEvidence.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: otherMatchId,
        opponentTeamId: otherOpponentTeamId,
        occurredAt: new Date("2026-08-01T10:00:00Z"),
        goalsFor: 9,
        goalsAgainst: 0,
        participantCount: 11,
        ratedParticipantCount: 11,
        estimate: "5.0",
        formulaVersion: "v1",
      },
    });

    const bundle = await buildMatchInsightFacts(
      planFor({
        opponentTeamId: thisOpponentTeamId,
        squad: [{ playerId: core1.id, role: "CORE", position: core1.primaryPosition }, { playerId: core2.id, role: "CORE", position: core2.primaryPosition }],
      }),
      orgFilter,
    );

    expect(bundle.opponentContext.exactOpponentHistoryAvailable).toBe(false);
    expect(bundle.opponentContext.previousEncounterCount).toBe(0);
    expect(bundle.opponentContext.previousEncounters).toEqual([]);
    expect(bundle.facts.some((f) => f.type === "OPPONENT_ENCOUNTER" || f.type === "OPPONENT_OBSERVATION")).toBe(false);
  });

  it("surfaces exact-opponent previous-encounter facts, including bounded trusted text, when real evidence exists", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const blaMatch = await testDb.match.findUniqueOrThrow({ where: { id: fixtureIds.matches["Bla"] }, select: { opponentTeamId: true } });
    const opponentTeamId = blaMatch.opponentTeamId!;
    const priorMatchId = fixtureIds.matches["Bla"];

    // Seed a second, earlier match against the same opponent to act as the "previous encounter".
    const priorMatch = await testDb.match.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchRoundId: fixtureIds.matchRoundId,
        teamId: fixtureIds.teams["Bla"],
        opponent: "Huringen",
        opponentTeamId,
        startsAt: new Date("2026-05-12T10:00:00Z"),
        homeAway: "HOME",
        formation: "4-4-2",
        status: "SCHEDULED",
      },
    });

    await testDb.opponentSportingEvidence.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: priorMatch.id,
        opponentTeamId,
        occurredAt: priorMatch.startsAt,
        goalsFor: 2,
        goalsAgainst: 1,
        participantCount: 11,
        ratedParticipantCount: 11,
        estimate: "6.0",
        formulaVersion: "v1",
      },
    });

    await testDb.opponentEncounterObservation.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: priorMatch.id,
        opponentTeamId,
        overallEnvironment: "ACCEPTABLE",
        playingStyleTags: ["HIGH_PRESSING"],
        factualSummary: "Difficult playing centrally against their high press.",
      },
    });

    const bundle = await buildMatchInsightFacts(
      planFor({
        matchId: priorMatchId, // the *current* match being prepared for
        opponentTeamId,
        squad: [{ playerId: core1.id, role: "CORE", position: core1.primaryPosition }, { playerId: core2.id, role: "CORE", position: core2.primaryPosition }],
      }),
      orgFilter,
    );

    expect(bundle.opponentContext.exactOpponentHistoryAvailable).toBe(true);
    expect(bundle.opponentContext.previousEncounterCount).toBe(1);
    const encounter = bundle.opponentContext.previousEncounters[0];
    expect(encounter.goalsFor).toBe(2);
    expect(encounter.goalsAgainst).toBe(1);
    expect(encounter.trustedObservation?.text).toBe("Difficult playing centrally against their high press.");
    expect(encounter.trustedObservation?.source).toBe("OPPONENT_ENCOUNTER_SUMMARY");

    const encounterFact = bundle.facts.find((f) => f.type === "OPPONENT_ENCOUNTER");
    expect(encounterFact).toBeDefined();
    expect(encounterFact?.evidenceRefs).toEqual([`fact:opponent-encounter:${priorMatchId}`]);
  });

  it("detects a NEW_COMBINATION for two same-position CORE players with no recorded partnership evidence at all", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const bundle = await buildMatchInsightFacts(
      planFor({ squad: [{ playerId: core1.id, role: "CORE", position: "CB" }, { playerId: core2.id, role: "CORE", position: "CB" }] }),
      orgFilter,
    );

    const newCombinationFact = bundle.facts.find((f) => f.type === "NEW_COMBINATION");
    expect(newCombinationFact).toBeDefined();
    expect(new Set(newCombinationFact?.subjectRefs)).toEqual(new Set([core1.id, core2.id]));
  });

  it("does not flag a NEW_COMBINATION once real PARTNERSHIP evidence exists for the pair, even at INSUFFICIENT confidence", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    await testDb.combinationEvidence.create({
      data: {
        organisationId: fixtureIds.organisationId,
        matchId: fixtureIds.matches["Bla"],
        family: "PARTNERSHIP",
        subtype: "VERTICAL",
        playerIds: [core1.id, core2.id],
        positions: ["CB"],
        minutesTogether: 10,
        confidence: "INSUFFICIENT",
        leagueSeasonId: fixtureIds.leagueSeasonId,
      },
    });

    const bundle = await buildMatchInsightFacts(
      planFor({ squad: [{ playerId: core1.id, role: "CORE", position: "CB" }, { playerId: core2.id, role: "CORE", position: "CB" }] }),
      orgFilter,
    );

    expect(bundle.facts.some((f) => f.type === "NEW_COMBINATION")).toBe(false);
  });

  it("includes rotation-context subjects for planned rotation changes", async () => {
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const bundle = await buildMatchInsightFacts(
      planFor({
        squad: [{ playerId: core1.id, role: "CORE", position: core1.primaryPosition }],
        plannedRotations: [{ sequence: 1, outPlayerId: core1.id, inPlayerId: core2.id, outPosition: "CM", inPosition: "CM" }],
      }),
      orgFilter,
    );

    const rotationFact = bundle.facts.find((f) => f.type === "ROTATION_CONTEXT");
    expect(rotationFact).toBeDefined();
    expect(rotationFact?.subjectRefs).toEqual([core1.id, core2.id]);
  });
});
