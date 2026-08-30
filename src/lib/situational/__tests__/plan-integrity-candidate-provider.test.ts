import { describe, it, expect } from "vitest";
import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import {
  createPlanIntegrityCandidateProvider,
  planIntegritySignalToCandidate,
  idempotencyKeyFromCandidateId,
  PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID,
} from "../providers/plan-integrity-candidate-provider";
import type { SituationContext } from "../situation-types";

const DUMMY_CONTEXT: SituationContext = {
  nowIso: "2026-01-01T12:00:00.000Z",
  primarySituation: "NEXT",
  imminentMatchIds: [],
  temporal: {},
};

function makeSignal(overrides: Partial<PlanIntegritySignal> & Pick<PlanIntegritySignal, "kind" | "ruleCode">): PlanIntegritySignal {
  return {
    idempotencyKey: "key-1",
    matchRoundId: "round-1",
    title: "Signal title",
    currentState: "Current state",
    consequence: "Consequence",
    classificationReason: "Reason",
    primaryActionLabel: "Fix it",
    primaryActionTarget: "/rounds/round-1",
    ...overrides,
  };
}

function makeIntegrity(signals: PlanIntegritySignal[]): RoundPlanIntegrity {
  return {
    matchRoundId: "round-1",
    signals,
    planningNotes: [],
    summary: {
      blockerCount: signals.filter((s) => s.kind === "BLOCKED").length,
      decisionRequiredCount: signals.filter((s) => s.kind === "DECISION_REQUIRED").length,
      belowMinimumMatchCount: 0,
      unavailableSelectedPlayerCount: 0,
      missingOpportunityPlayerCount: 0,
      integrityFailureCount: 0,
    },
    coverage: {
      eligibleAvailablePlayerCount: 0,
      assignedEligibleAvailablePlayerCount: 0,
      unassignedEligibleAvailablePlayerIds: [],
    },
    computedAt: new Date(),
  };
}

describe("planIntegritySignalToCandidate", () => {
  it("maps SQUAD_BELOW_MINIMUM to SQUAD_DEGRADED", () => {
    const signal = makeSignal({ kind: "BLOCKED", ruleCode: "SQUAD_BELOW_MINIMUM", matchId: "match-1", teamId: "team-1" });
    const candidate = planIntegritySignalToCandidate(signal, () => "2026-01-01T12:00:00.000Z");

    expect(candidate.consequences).toEqual(["SQUAD_DEGRADED"]);
    expect(candidate.entityType).toBe("MATCH");
    expect(candidate.entityId).toBe("match-1");
    expect(candidate.affectedTeamIds).toEqual(["team-1"]);
    expect(candidate.deadlineAt).toBe("2026-01-01T12:00:00.000Z");
    expect(candidate.recommendedAction).toEqual({ label: "Fix it", href: "/rounds/round-1" });
    expect(candidate.id).toBe(`${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|key-1`);
  });

  it("maps AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY to PLAYER_OPPORTUNITY", () => {
    const signal = makeSignal({
      kind: "DECISION_REQUIRED",
      ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
      playerId: "player-1",
    });
    const candidate = planIntegritySignalToCandidate(signal, () => undefined);

    expect(candidate.consequences).toEqual(["PLAYER_OPPORTUNITY"]);
    expect(candidate.affectedPlayerIds).toEqual(["player-1"]);
    // No matchId on this signal -- falls back to the round as the entity.
    expect(candidate.entityType).toBe("ROUND");
    expect(candidate.entityId).toBe("round-1");
  });

  it("marks a signal with repeatedContext as requiring review", () => {
    const signal = makeSignal({
      kind: "DECISION_REQUIRED",
      ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
      repeatedContext: { earlierMissedRoundCount: 2, roundLabels: ["R1", "R2"] },
    });
    const candidate = planIntegritySignalToCandidate(signal, () => undefined);
    expect(candidate.requiresReview).toBe(true);
  });

  it("does not require review for a first-occurrence signal", () => {
    const signal = makeSignal({ kind: "BLOCKED", ruleCode: "SQUAD_BELOW_MINIMUM" });
    const candidate = planIntegritySignalToCandidate(signal, () => undefined);
    expect(candidate.requiresReview).toBe(false);
  });

  it("never marks a plan-integrity candidate as a long-term signal", () => {
    const signal = makeSignal({ kind: "BLOCKED", ruleCode: "SQUAD_BELOW_MINIMUM" });
    const candidate = planIntegritySignalToCandidate(signal, () => undefined);
    expect(candidate.isLongTermSignal).toBe(false);
  });
});

describe("idempotencyKeyFromCandidateId", () => {
  it("recovers the original idempotency key", () => {
    expect(idempotencyKeyFromCandidateId(`${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|abc123`)).toBe("abc123");
  });

  it("returns null for an id from a different provider", () => {
    expect(idempotencyKeyFromCandidateId("other-provider|abc123")).toBeNull();
  });
});

describe("createPlanIntegrityCandidateProvider", () => {
  it("flattens signals across multiple rounds into one candidate list without recomputation", () => {
    const roundPlanIntegrities = {
      "round-1": makeIntegrity([makeSignal({ kind: "BLOCKED", ruleCode: "SQUAD_BELOW_MINIMUM", idempotencyKey: "a" })]),
      "round-2": makeIntegrity([
        makeSignal({ kind: "DECISION_REQUIRED", ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY", idempotencyKey: "b", matchRoundId: "round-2" }),
      ]),
    };

    const provider = createPlanIntegrityCandidateProvider(roundPlanIntegrities, () => undefined);
    expect(provider.id).toBe(PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID);

    const candidates = provider.getCandidates(DUMMY_CONTEXT);
    expect(candidates).toHaveLength(2);
    expect((candidates as ReturnType<typeof planIntegritySignalToCandidate>[]).map((c) => c.id)).toEqual(
      expect.arrayContaining([`${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|a`, `${PLAN_INTEGRITY_CANDIDATE_PROVIDER_ID}|b`]),
    );
  });

  it("returns an empty list for a round with no signals", () => {
    const provider = createPlanIntegrityCandidateProvider({ "round-1": makeIntegrity([]) }, () => undefined);
    expect(provider.getCandidates(DUMMY_CONTEXT)).toHaveLength(0);
  });
});
