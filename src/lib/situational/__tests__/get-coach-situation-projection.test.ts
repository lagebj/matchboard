import { describe, it, expect } from "vitest";
import { projectCandidates } from "../get-coach-situation-projection";
import type { CoachDecisionCandidate, SituationContext } from "../situation-types";

const NOW = "2026-01-01T12:00:00.000Z";

function isoMinutesFromNow(minutes: number): string {
  return new Date(new Date(NOW).getTime() + minutes * 60_000).toISOString();
}

function baseContext(overrides: Partial<SituationContext> = {}): SituationContext {
  return {
    nowIso: NOW,
    primarySituation: "MATCHDAY",
    imminentMatchIds: [],
    temporal: {},
    ...overrides,
  };
}

function candidate(overrides: Partial<CoachDecisionCandidate>): CoachDecisionCandidate {
  return {
    id: "cand",
    source: "test",
    entityType: "MATCH",
    entityId: "m",
    title: "Title",
    facts: [],
    consequences: [],
    affectedMatchIds: [],
    affectedTeamIds: [],
    affectedPlayerIds: [],
    alternativeActions: [],
    ...overrides,
  };
}

describe("projectCandidates", () => {
  it("returns READY with no decisions and no candidates", async () => {
    const projection = await projectCandidates(baseContext({ primarySituation: "NEXT" }), []);
    expect(projection.status).toBe("READY");
    expect(projection.decisions).toHaveLength(0);
  });

  it("orders an imminent hard-consequence decision ahead of a long-term one during Matchday", async () => {
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const urgent = candidate({
      id: "urgent",
      consequences: ["SQUAD_DEGRADED"],
      affectedMatchIds: ["match-1"],
      deadlineAt: isoMinutesFromNow(20),
      recommendedAction: { label: "Fix", href: "/fix" },
    });
    const longTerm = candidate({
      id: "long-term",
      consequences: ["PLAYER_OPPORTUNITY"],
      isLongTermSignal: true,
      affectedMatchIds: ["match-2"],
    });

    const projection = await projectCandidates(context, [urgent, longTerm]);

    // The long-term signal is suppressed entirely during an unrelated live match.
    expect(projection.decisions.map((d) => d.candidateId)).toEqual(["urgent"]);
    expect(projection.status).toBe("ACTION_REQUIRED");
  });

  it("excludes SUPPRESS decisions and counts DEFER decisions separately without rendering them", async () => {
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const suppressed = candidate({
      id: "suppressed",
      isLongTermSignal: true,
      affectsNextRoundDecision: false,
      affectedMatchIds: ["match-2"],
    });
    const deferred = candidate({
      id: "deferred",
      consequences: ["REPORTING_DEBT"],
      deadlineAt: isoMinutesFromNow(30),
    });

    const projection = await projectCandidates(context, [suppressed, deferred]);

    expect(projection.decisions).toHaveLength(0);
    expect(projection.deferredCount).toBe(1);
  });

  it("reports LIVE (not READY) when the only candidates are suppressed but a match is active", async () => {
    const context = baseContext({ primarySituation: "MATCHDAY", activeMatchId: "match-1" });
    const suppressed = candidate({
      id: "suppressed",
      isLongTermSignal: true,
      affectedMatchIds: ["match-2"],
    });

    const projection = await projectCandidates(context, [suppressed]);
    expect(projection.status).toBe("LIVE");
  });

  it("reports READY when the only candidates are suppressed and there is no active match", async () => {
    const context = baseContext({ primarySituation: "NEXT" });
    const suppressed = candidate({
      id: "suppressed",
      isLongTermSignal: true,
      affectedMatchIds: ["match-2"],
    });

    const projection = await projectCandidates(context, [suppressed]);
    expect(projection.status).toBe("READY");
  });

  it("is stable/deterministic for identical candidate sets", async () => {
    const context = baseContext({ primarySituation: "NEXT" });
    const candidates = [
      candidate({ id: "a", consequences: ["POSITION_COVERAGE"] }),
      candidate({ id: "b", consequences: ["POSITION_COVERAGE"] }),
    ];

    const first = await projectCandidates(context, candidates);
    const second = await projectCandidates(context, candidates);

    expect(first.decisions.map((d) => d.id)).toEqual(second.decisions.map((d) => d.id));
  });

  it("never produces an AUTO interaction across a representative candidate mix", async () => {
    const context = baseContext({ primarySituation: "NEXT" });
    const candidates = [
      candidate({ id: "a", consequences: ["PLANNING_BLOCKED"], recommendedAction: { label: "x", href: "/x" } }),
      candidate({ id: "b", alternativeActions: [{ label: "1", href: "/1" }, { label: "2", href: "/2" }, { label: "3", href: "/3" }, { label: "4", href: "/4" }] }),
      candidate({ id: "c", isLongTermSignal: true }),
    ];

    const projection = await projectCandidates(context, candidates);
    for (const decision of projection.decisions) {
      expect(decision.interaction).not.toBe("AUTO");
    }
  });

  describe("affectedEntities", () => {
    it("includes only the primary entity for a single-player candidate (no duplicate)", async () => {
      const context = baseContext({ primarySituation: "NEXT" });
      const candidates = [
        candidate({ id: "a", entityType: "PLAYER", entityId: "p1", affectedPlayerIds: ["p1"] }),
      ];
      const [decision] = (await projectCandidates(context, candidates)).decisions;
      expect(decision.affectedEntities).toEqual([{ entityType: "PLAYER", entityId: "p1" }]);
    });

    it("includes every affected player for a multi-player candidate (e.g. a partnership) alongside its primary entity", async () => {
      const context = baseContext({ primarySituation: "NEXT" });
      const candidates = [
        candidate({
          id: "a",
          entityType: "TEAM",
          entityId: "opponent-1",
          affectedPlayerIds: ["p1", "p2"],
        }),
      ];
      const [decision] = (await projectCandidates(context, candidates)).decisions;
      expect(decision.affectedEntities).toEqual([
        { entityType: "TEAM", entityId: "opponent-1" },
        { entityType: "PLAYER", entityId: "p1" },
        { entityType: "PLAYER", entityId: "p2" },
      ]);
    });

    it("does not duplicate a player id also referenced by a non-PLAYER primary entity's affectedPlayerIds", async () => {
      const context = baseContext({ primarySituation: "NEXT" });
      const candidates = [
        candidate({ id: "a", entityType: "MATCH", entityId: "m1", affectedPlayerIds: ["p1"] }),
      ];
      const [decision] = (await projectCandidates(context, candidates)).decisions;
      expect(decision.affectedEntities).toEqual([
        { entityType: "MATCH", entityId: "m1" },
        { entityType: "PLAYER", entityId: "p1" },
      ]);
    });
  });
});
