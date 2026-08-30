import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CoachDecisionCandidate, SituationContext } from "../situation-types";

const NOW = "2026-01-01T12:00:00.000Z";

function isoMinutesFromNow(minutes: number): string {
  return new Date(new Date(NOW).getTime() + minutes * 60_000).toISOString();
}

function baseContext(overrides: Partial<SituationContext> = {}): SituationContext {
  return {
    nowIso: NOW,
    primarySituation: "NEXT",
    imminentMatchIds: [],
    temporal: {},
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<CoachDecisionCandidate> = {}): CoachDecisionCandidate {
  return {
    id: "cand-1",
    source: "test",
    entityType: "MATCH",
    entityId: "match-1",
    title: "Test candidate",
    facts: [],
    consequences: [],
    affectedMatchIds: [],
    affectedTeamIds: [],
    affectedPlayerIds: [],
    alternativeActions: [],
    ...overrides,
  };
}

describe("evaluateSituationPolicy (real compiled Rego artifact)", () => {
  it("promotes a hard-consequence candidate on an imminent Matchday", async () => {
    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const candidate = baseCandidate({
      consequences: ["SQUAD_DEGRADED", "POSITION_COVERAGE"],
      deadlineAt: isoMinutesFromNow(30),
      recommendedAction: { label: "Move Elias", href: "/rounds/r1" },
      affectedMatchIds: ["match-1"],
    });

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.policyRuntimeStatus).toBe("HEALTHY");
    expect(outcome.result.visibility).toBe("PROMOTE");
    expect(outcome.result.horizon).toBe("NOW");
    expect(outcome.result.urgency).toBe("IMMEDIATE");
    expect(outcome.result.interaction).toBe("CONFIRM");
    expect(outcome.result.reasonCodes).toContain("HARD_CONSEQUENCE");
  });

  it("suppresses a long-term signal during an unrelated live match", async () => {
    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const candidate = baseCandidate({
      consequences: ["PLAYER_OPPORTUNITY"],
      isLongTermSignal: true,
      affectsNextRoundDecision: false,
      affectedMatchIds: ["match-2"],
    });

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.result.visibility).toBe("SUPPRESS");
  });

  it("promotes the same long-term signal as primary content during a LONG_TERM review", async () => {
    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext({ primarySituation: "LONG_TERM" });
    const candidate = baseCandidate({
      consequences: ["DEVELOPMENT_SIGNAL"],
      isLongTermSignal: true,
    });

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.result.visibility).toBe("PROMOTE");
    expect(outcome.result.horizon).toBe("LONG_TERM");
  });

  it("never returns AUTO", async () => {
    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext({ primarySituation: "NEXT" });
    const candidate = baseCandidate({ consequences: ["POSITION_COVERAGE"], alternativeActions: [{ label: "a", href: "/a" }, { label: "b", href: "/b" }] });

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.result.interaction).not.toBe("AUTO");
  });
});

describe("evaluateSituationPolicy (degraded runtime)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("degrades safely without throwing when the policy runtime is unavailable", async () => {
    vi.doMock("@/lib/policies/policy-runtime", async () => {
      const actual = await vi.importActual<typeof import("@/lib/policies/policy-runtime")>(
        "@/lib/policies/policy-runtime",
      );
      return {
        ...actual,
        evaluatePolicyEntrypoint: vi.fn().mockRejectedValue(
          new actual.PolicyRuntimeDegradedError("simulated failure", "test_error"),
        ),
      };
    });

    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const candidate = baseCandidate({
      consequences: ["SQUAD_DEGRADED"],
      affectedMatchIds: ["match-1"],
      recommendedAction: { label: "Fix it", href: "/x" },
    });

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.policyRuntimeStatus).toBe("DEGRADED");
    // Degraded fallback must never suppress and must never use AUTO.
    expect(outcome.result.visibility).not.toBe("SUPPRESS");
    expect(outcome.result.interaction).not.toBe("AUTO");
    expect(outcome.result.visibility).toBe("PROMOTE");
    expect(outcome.result.reasonCodes).toEqual(["POLICY_RUNTIME_DEGRADED"]);
  });

  it("degrades safely rather than throwing when the entrypoint returns a malformed shape", async () => {
    vi.doMock("@/lib/policies/policy-runtime", async () => {
      const actual = await vi.importActual<typeof import("@/lib/policies/policy-runtime")>(
        "@/lib/policies/policy-runtime",
      );
      return {
        ...actual,
        evaluatePolicyEntrypoint: vi.fn().mockResolvedValue({ not: "a valid shape" }),
      };
    });

    const { evaluateSituationPolicy } = await import("../situation-policy-adapter");
    const context = baseContext();
    const candidate = baseCandidate();

    const outcome = await evaluateSituationPolicy(context, candidate);

    expect(outcome.policyRuntimeStatus).toBe("DEGRADED");
    expect(outcome.result.visibility).not.toBe("SUPPRESS");
  });
});
