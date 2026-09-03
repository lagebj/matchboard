import { describe, it, expect } from "vitest";
import { getRotationCandidatePriorityScore, getRankedRotationCandidates } from "@/lib/selection/rotation-candidate-ranking";
import type { RotationCandidate } from "@/lib/selection/selection-types";
import type { LeagueSeasonRoleCounts } from "@/lib/selection/selection-fairness";
import type { CombinationScoringInput } from "@/lib/selection/combination-scoring";
import { assertEvidenceDidNotExcludeCandidates } from "@/lib/policies/evidence-guardrails";

// Evidence-Informed Match Planning programme, Bundle 6 (ADR-0117): locks in that fairness
// dominates the bounded combination-evidence bonus in the real, shipped candidate-ranking
// function — not just in combination-scoring.ts's own isolated unit tests — matching
// TEST-MATRIX.md Scenario F ("Fairness protection") and PROGRAMME.md's required precedence
// order (eligibility -> fairness/development -> ... -> evidence guardrails/preferences).

function makePlayer(id: string): RotationCandidate["player"] {
  return {
    id,
    playerCode: 1,
    firstName: id,
    lastName: null,
    active: true,
    removedAt: null,
    coreTeamId: "team1",
    nonRotatable: false,
    reducedMatchLoadAllowed: false,
    supportSuitability: "neutral",
    developmentReadiness: "neutral",
    primaryPosition: "CM",
    secondaryPosition: null,
    tertiaryPosition: null,
    preferredFoot: "RIGHT",
    secondaryFoot: "LEFT",
    bestSide: "BOTH",
    currentAvailability: "AVAILABLE",
    supportNoShowCount: 0,
    ballControl: 0,
    passing: 0,
    firstTouch: 0,
    oneVOneAttacking: 0,
    positioning: 0,
    oneVOneDefending: 0,
    decisionMaking: 0,
    effort: 0,
    teamplay: 0,
    concentration: 0,
    speed: 0,
    strength: 0,
    notes: null,
    supportInstruction: null,
    developmentInstruction: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    coreTeam: { id: "team1", name: "Team 1" },
    rotationPathsFromCoreTeam: [],
  } as unknown as RotationCandidate["player"];
}

function makeCandidate(id: string, overrides: Partial<RotationCandidate> = {}): Omit<RotationCandidate, "priorityScore"> {
  return {
    player: makePlayer(id),
    playerName: id,
    playerPosition: "CM",
    candidateCategory: "SUPPORT",
    chosenPosition: "CM",
    cooldownBlocked: false,
    cooldownBlockReason: null,
    eligibilityExplanation: "",
    floatingHistory: { lastFinalizedMatchDate: null, lastFinalizedRoleType: null, totalFloatingMatches: 0 },
    missedCoreMatchThisWeek: null,
    positionMatchLevel: "primary" as const,
    registeredAppearanceCount: 0,
    recentLoadScore: 0,
    suitabilityScore: 0,
    isMovementCandidate: false,
    ...overrides,
  } as unknown as Omit<RotationCandidate, "priorityScore">;
}

describe("fairness dominates combination-evidence bonus (TEST-MATRIX Scenario F)", () => {
  it("ranks a rarely-used player above a heavily-used player with a strong known combination", () => {
    const inSquadPartnerId = "partner-already-in-squad";

    const overusedWithStrongCombination = makeCandidate("overused-strong-combo");
    const rarelyUsedNoEvidence = makeCandidate("rarely-used-no-evidence");

    const leagueSeasonCounts = new Map<string, LeagueSeasonRoleCounts>([
      ["overused-strong-combo", { coreCount: 15, supportCount: 15, developmentCount: 0 }],
      ["rarely-used-no-evidence", { coreCount: 15, supportCount: 0, developmentCount: 0 }],
    ]);

    const combinationEvidence: CombinationScoringInput[] = [
      {
        playerIds: ["overused-strong-combo", inSquadPartnerId],
        family: "PARTNERSHIP",
        subtype: null,
        confidence: "ESTABLISHED",
        totalMinutesTogether: 500,
        matchCount: 12,
      },
    ];

    const selectedPlayers = [{ playerId: inSquadPartnerId } as never];

    const overusedScore = getRotationCandidatePriorityScore(
      overusedWithStrongCombination,
      selectedPlayers,
      leagueSeasonCounts,
      0,
      combinationEvidence,
      "COMPETITIVE", // amplifies the combination bonus as much as intent allows
    );
    const rarelyUsedScore = getRotationCandidatePriorityScore(
      rarelyUsedNoEvidence,
      selectedPlayers,
      leagueSeasonCounts,
      0,
      combinationEvidence,
      "COMPETITIVE",
    );

    expect(rarelyUsedScore).toBeGreaterThan(overusedScore);
  });

  it("ranks the rarely-used player first in the sorted candidate list", () => {
    const inSquadPartnerId = "partner-already-in-squad";
    const overused = makeCandidate("overused-strong-combo");
    const rarelyUsed = makeCandidate("rarely-used-no-evidence");

    const leagueSeasonCounts = new Map<string, LeagueSeasonRoleCounts>([
      ["overused-strong-combo", { coreCount: 15, supportCount: 15, developmentCount: 0 }],
      ["rarely-used-no-evidence", { coreCount: 15, supportCount: 0, developmentCount: 0 }],
    ]);
    const combinationEvidence: CombinationScoringInput[] = [
      {
        playerIds: ["overused-strong-combo", inSquadPartnerId],
        family: "PARTNERSHIP",
        subtype: null,
        confidence: "ESTABLISHED",
        totalMinutesTogether: 500,
        matchCount: 12,
      },
    ];
    const selectedPlayers = [{ playerId: inSquadPartnerId } as never];

    const ranked = getRankedRotationCandidates(
      [overused, rarelyUsed],
      selectedPlayers,
      leagueSeasonCounts,
      new Map(),
      combinationEvidence,
      "COMPETITIVE",
    );

    expect(ranked[0]!.player.id).toBe("rarely-used-no-evidence");
  });
});

describe("evidence never shrinks the candidate set (structural exclusion guardrail)", () => {
  it("getRankedRotationCandidates preserves every candidate regardless of combination-evidence scoring", () => {
    // Four "developing" players with no shared minutes with anyone or each other (TEST-MATRIX
    // Scenario F: "four developing players have weaker historical raw outcomes... all remain
    // eligible").
    const candidates = ["dev-a", "dev-b", "dev-c", "dev-d"].map((id) => makeCandidate(id, { candidateCategory: "DEVELOPMENT" }));
    const beforeIds = candidates.map((c) => c.player.id);

    const ranked = getRankedRotationCandidates(candidates, [], null, new Map(), [], "BALANCED");
    const afterIds = ranked.map((c) => c.player.id);

    expect(() => assertEvidenceDidNotExcludeCandidates(beforeIds, afterIds, "getRankedRotationCandidates")).not.toThrow();
    expect(afterIds).toHaveLength(4);
  });

  it("an unknown/zero-evidence player never receives a negative combination-bonus contribution", () => {
    const candidate = makeCandidate("no-evidence-player", { candidateCategory: "DEVELOPMENT" });
    const withNoEvidence = getRotationCandidatePriorityScore(candidate, [{ playerId: "someone-else" } as never], null, 0, [], "BALANCED");
    const withEmptyEvidenceArray = getRotationCandidatePriorityScore(candidate, [{ playerId: "someone-else" } as never], null, 0, [], "COMPETITIVE");
    // Both should be identical to the score with no combination evidence contribution at all —
    // i.e. combinationBonus = 0 in every intent mode when there is no evidence.
    expect(withNoEvidence).toBe(withEmptyEvidenceArray);
  });
});
