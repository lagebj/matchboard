import { describe, expect, it } from "vitest";
import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import {
  buildSelectedAvailability,
  formatSelectedAvailabilityLine,
  formatSquadPlannedLine,
  resolveTodayMatchdayAction,
  type TodayMatchdayReadiness,
} from "@/lib/touchline/presentation/today-matchday-readiness";

function makeSignal(overrides: Partial<PlanIntegritySignal> & Pick<PlanIntegritySignal, "idempotencyKey">): PlanIntegritySignal {
  return {
    kind: "BLOCKED",
    ruleCode: "SQUAD_BELOW_MINIMUM",
    matchRoundId: "round-1",
    title: "Squad below minimum",
    currentState: "8 of 11 required",
    consequence: "Match cannot be reported",
    classificationReason: "test",
    primaryActionLabel: "Fix squad",
    primaryActionTarget: "/selection/round-1",
    ...overrides,
  };
}

function baseReadiness(overrides: Partial<TodayMatchdayReadiness> = {}): TodayMatchdayReadiness {
  return {
    selection: { state: "READY", selectedCount: 10, targetCount: 10 },
    selectedAvailability: {
      selectedCount: 10,
      availableCount: 10,
      doubtfulCount: 0,
      unavailableCount: 0,
      unknownCount: 0,
      affectedPlayers: [],
    },
    lineup: { state: "READY" },
    tactics: { state: "UNKNOWN" },
    plannedRotations: null,
    blockingSignals: [],
    decisionSignals: [],
    ...overrides,
  };
}

const baseActionInput = {
  phase: "IMMINENT" as const,
  canEnterLiveReporting: true,
  startLiveHref: "/matches/m1/live",
  reviewHref: "/matches/m1",
  availabilityReviewHref: "/matches/m1/selection",
  lineupReviewHref: "/matches/m1/lineup",
};

describe("buildSelectedAvailability", () => {
  it("returns null for no selected players", () => {
    expect(buildSelectedAvailability([])).toBeNull();
  });

  it("orders affected players unavailable, then doubtful, then unknown", () => {
    const av = buildSelectedAvailability([
      { playerId: "p1", displayName: "Noah", availability: "TENTATIVE" },
      { playerId: "p2", displayName: "Emil", availability: "UNAVAILABLE" },
      { playerId: "p3", displayName: "Theodor", availability: "SOMETHING_ELSE" },
      { playerId: "p4", displayName: "Aksel", availability: "AVAILABLE" },
    ]);
    expect(av?.affectedPlayers.map((p) => p.displayName)).toEqual(["Emil", "Noah", "Theodor"]);
    expect(av?.availableCount).toBe(1);
    expect(av?.unknownCount).toBe(1);
  });
});

describe("formatSquadPlannedLine / formatSelectedAvailabilityLine", () => {
  it("formats a fully-ready squad as a single collapsed line", () => {
    const readiness = baseReadiness();
    expect(formatSquadPlannedLine(readiness.selection)).toBe("10 of 10 planned");
    expect(formatSelectedAvailabilityLine(readiness.selectedAvailability!)).toBe("10/10 selected players available");
  });

  it("formats a partial-availability squad as counts", () => {
    const av = { selectedCount: 10, availableCount: 9, doubtfulCount: 1, unavailableCount: 0, unknownCount: 0, affectedPlayers: [] };
    expect(formatSelectedAvailabilityLine(av)).toBe("9 available · 1 doubtful");
  });

  it("omits target count when unknown rather than inventing it", () => {
    expect(formatSquadPlannedLine({ state: "DRAFT", selectedCount: 7, targetCount: null })).toBe("7 players planned");
  });
});

describe("resolveTodayMatchdayAction priority order", () => {
  it("1. hard blocker outranks everything", () => {
    const readiness = baseReadiness({ blockingSignals: [makeSignal({ idempotencyKey: "sig-1" })] });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("HARD_BLOCKER");
    expect(action.consumedSignalId).toBe("sig-1");
  });

  it("2. unavailable selected player outranks doubtful/lineup/start-live", () => {
    const readiness = baseReadiness({
      selectedAvailability: {
        selectedCount: 10,
        availableCount: 8,
        doubtfulCount: 1,
        unavailableCount: 1,
        unknownCount: 0,
        affectedPlayers: [
          { playerId: "p1", displayName: "Emil", state: "UNAVAILABLE" },
          { playerId: "p2", displayName: "Noah", state: "DOUBTFUL" },
        ],
      },
      lineup: { state: "MISSING" },
    });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("UNAVAILABLE_PLAYER");
    expect(action.title).toBe("Emil is unavailable");
  });

  it("3. doubtful selected player outranks missing lineup", () => {
    const readiness = baseReadiness({
      selectedAvailability: {
        selectedCount: 10,
        availableCount: 8,
        doubtfulCount: 2,
        unavailableCount: 0,
        unknownCount: 0,
        affectedPlayers: [
          { playerId: "p1", displayName: "Noah", state: "DOUBTFUL" },
          { playerId: "p2", displayName: "Theodor", state: "DOUBTFUL" },
        ],
      },
      lineup: { state: "MISSING" },
    });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("DOUBTFUL_PLAYER");
    expect(action.title).toBe("Noah and Theodor are doubtful");
  });

  it("formats 3+ affected players with a +N suffix", () => {
    const readiness = baseReadiness({
      selectedAvailability: {
        selectedCount: 10,
        availableCount: 6,
        doubtfulCount: 4,
        unavailableCount: 0,
        unknownCount: 0,
        affectedPlayers: [
          { playerId: "p1", displayName: "Noah", state: "DOUBTFUL" },
          { playerId: "p2", displayName: "Theodor", state: "DOUBTFUL" },
          { playerId: "p3", displayName: "Emil", state: "DOUBTFUL" },
          { playerId: "p4", displayName: "Aksel", state: "DOUBTFUL" },
        ],
      },
    });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.title).toBe("Noah, Theodor +2 doubtful");
  });

  it("4. missing lineup outranks missing tactics and start-live", () => {
    const readiness = baseReadiness({ lineup: { state: "MISSING" }, tactics: { state: "MISSING" } });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("MISSING_LINEUP");
  });

  it("5. missing tactics outranks a planning-signal and start-live", () => {
    const readiness = baseReadiness({
      tactics: { state: "MISSING" },
      decisionSignals: [makeSignal({ idempotencyKey: "sig-2", kind: "DECISION_REQUIRED" })],
    });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("MISSING_TACTICS");
  });

  it("6. a planning decision signal outranks start-live", () => {
    const readiness = baseReadiness({
      decisionSignals: [makeSignal({ idempotencyKey: "sig-3", kind: "DECISION_REQUIRED", title: "Review rotation" })],
    });
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("PLANNING_SIGNAL");
    expect(action.consumedSignalId).toBe("sig-3");
  });

  it("7. start-live wins when fully ready and inside the imminent window", () => {
    const readiness = baseReadiness();
    const action = resolveTodayMatchdayAction({ ...baseActionInput, readiness });
    expect(action.kind).toBe("START_LIVE");
  });

  it("7b. does not offer start-live outside the imminent window even if ready", () => {
    const readiness = baseReadiness();
    const action = resolveTodayMatchdayAction({ ...baseActionInput, phase: "PREPARE", readiness });
    expect(action.kind).toBe("REVIEW_MATCH");
  });

  it("8. falls back to review-match when nothing else applies and live entry is unavailable", () => {
    const readiness = baseReadiness();
    const action = resolveTodayMatchdayAction({ ...baseActionInput, canEnterLiveReporting: false, readiness });
    expect(action.kind).toBe("REVIEW_MATCH");
  });
});
