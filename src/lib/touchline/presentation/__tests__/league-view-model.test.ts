import { describe, it, expect } from "vitest";
import { buildLeagueOperatingViewModel, resolveMatchIssue } from "../league-view-model";
import type { FixturePeriod, FixtureRound, FixtureMatch, FixturePlanningSignal } from "@/domain/fixtures/types";

function match(overrides: Partial<FixtureMatch> & { id: string; teamId: string }): FixtureMatch {
  return {
    title: `${overrides.teamId} vs Opponent`,
    teamName: overrides.teamId,
    opponent: "Opponent",
    readinessState: "READY",
    selectionState: "READY",
    selectedPlayerCount: 10,
    blockerCount: 0,
    decisionRequiredCount: 0,
    reportState: { state: "NO_REPORT" },
    availableActions: [],
    matchStatus: "SCHEDULED",
    lifecycleStatus: "planning_open",
    teamKitColor: null,
    lineupState: "PREPARED",
    planningSignals: [],
    ...overrides,
  };
}

function round(overrides: Partial<FixtureRound> & { id: string }): FixtureRound {
  return {
    title: overrides.id,
    readinessState: "READY",
    selectionState: "READY",
    hasDraftSelections: true,
    hasMatches: true,
    blockerCount: 0,
    decisionRequiredCount: 0,
    availableActions: [],
    matches: [],
    roundLevelPlanningSignals: [],
    ...overrides,
  };
}

function period(overrides: Partial<FixturePeriod> & { id: string; rounds: FixtureRound[] }): FixturePeriod {
  return {
    title: "Fall 2026",
    dateRange: "Jul-Dec",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    readinessState: "READY",
    blockerCount: 0,
    decisionRequiredCount: 0,
    isCurrent: true,
    ...overrides,
  };
}

const NOW = new Date("2026-09-15T12:00:00.000Z"); // Tuesday, ISO week 2026-W38

describe("buildLeagueOperatingViewModel — temporal classification", () => {
  it("classifies a round with a kickoff in the current display ISO week as CURRENT and focuses it", () => {
    const r1 = round({
      id: "r1",
      selectionState: "FINALIZED",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-08-01T12:00:00.000Z" })],
    });
    const r2 = round({
      id: "r2",
      matches: [match({ id: "m2", teamId: "t1", startsAt: "2026-09-16T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.id).toBe("r2");
  });

  it("does not treat an old non-finalized round as current merely because it is unfinished", () => {
    const r1 = round({
      id: "r1",
      selectionState: "DRAFT",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-07-04T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", rounds: [r1] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    // No current/future round exists, and r1 needs closure (DRAFT + past played match would --
    // but here lifecycle defaults to planning_open, so nothing needs closure). Falls through to
    // "most recent past round" -- but the key assertion is that its FOCUSED STATUS is not
    // fabricated as current.
    expect(vm.focusedRound?.status).not.toBe("CURRENT_ROUND");
  });

  it("defaults to the nearest future round when no round is current", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-10-01T12:00:00.000Z" })],
    });
    const r2 = round({
      id: "r2",
      matches: [match({ id: "m2", teamId: "t1", startsAt: "2026-09-25T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.id).toBe("r2");
  });

  it("defaults to the newest past round needing closure when there is no current/future round", () => {
    const r1 = round({
      id: "r1",
      matches: [
        match({
          id: "m1",
          teamId: "t1",
          startsAt: "2026-08-01T12:00:00.000Z",
          lifecycleStatus: "done",
        }),
      ],
    });
    const r2 = round({
      id: "r2",
      matches: [
        match({
          id: "m2",
          teamId: "t1",
          startsAt: "2026-08-15T12:00:00.000Z",
          lifecycleStatus: "played",
        }),
      ],
    });
    const p = period({ id: "p1", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.id).toBe("r2");
    expect(vm.focusedRound?.status).toBe("NEEDS_CLOSURE");
  });

  it("defaults to the most recent past round when nothing needs closure", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-08-01T12:00:00.000Z", lifecycleStatus: "done" })],
    });
    const r2 = round({
      id: "r2",
      matches: [match({ id: "m2", teamId: "t1", startsAt: "2026-08-15T12:00:00.000Z", lifecycleStatus: "done" })],
    });
    const p = period({ id: "p1", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.id).toBe("r2");
    expect(vm.focusedRound?.status).toBe("FINAL");
  });

  it("a valid ?round= selection overrides the default focus", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-09-16T12:00:00.000Z" })],
    });
    const r2 = round({
      id: "r2",
      matches: [match({ id: "m2", teamId: "t1", startsAt: "2026-08-01T12:00:00.000Z", lifecycleStatus: "done" })],
    });
    const p = period({ id: "p1", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({
      periods: [p],
      selectedPeriodId: null,
      selectedRoundId: "r2",
      now: NOW,
    });
    expect(vm.focusedRound?.id).toBe("r2");
  });

  it("degrades to the deterministic default when the requested round does not belong to the selected phase", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-09-16T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", rounds: [r1] });

    const vm = buildLeagueOperatingViewModel({
      periods: [p],
      selectedPeriodId: null,
      selectedRoundId: "does-not-exist",
      now: NOW,
    });
    expect(vm.focusedRound?.id).toBe("r1");
  });
});

describe("buildLeagueOperatingViewModel — rail", () => {
  it("marks a calendar week with no scheduled round as EMPTY and non-selectable", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-09-16T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-09-30T00:00:00.000Z", rounds: [r1] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    const emptySlots = vm.railSlots.filter((s) => s.state === "EMPTY");
    expect(emptySlots.length).toBeGreaterThan(0);
    for (const slot of emptySlots) {
      expect(slot.roundIds).toEqual([]);
      expect(slot.primaryRoundId).toBeNull();
    }
  });

  it("resolves the primary round for a week deterministically when two rounds share it", () => {
    const r1 = round({
      id: "r1",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-09-16T18:00:00.000Z" })],
    });
    const r2 = round({
      id: "r2",
      matches: [match({ id: "m2", teamId: "t1", startsAt: "2026-09-15T12:00:00.000Z" })],
    });
    const p = period({ id: "p1", startDate: "2026-09-01T00:00:00.000Z", endDate: "2026-09-30T00:00:00.000Z", rounds: [r1, r2] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    const slot = vm.railSlots.find((s) => s.roundIds.length === 2);
    expect(slot?.primaryRoundId).toBe("r2"); // earlier non-cancelled kickoff wins (neither has actionable work)
  });
});

describe("buildLeagueOperatingViewModel — closure", () => {
  it("a past round with a played match needing a report is NEEDS_CLOSURE, not FINAL, even when MatchRound.status is FINALIZED", () => {
    const r1 = round({
      id: "r1",
      selectionState: "FINALIZED",
      matches: [match({ id: "m1", teamId: "t1", startsAt: "2026-08-01T12:00:00.000Z", lifecycleStatus: "played" })],
    });
    const p = period({ id: "p1", rounds: [r1] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.status).toBe("NEEDS_CLOSURE");
  });

  it("a past round is FINAL only when every active match is done", () => {
    const r1 = round({
      id: "r1",
      matches: [
        match({ id: "m1", teamId: "t1", startsAt: "2026-08-01T12:00:00.000Z", lifecycleStatus: "done" }),
        match({ id: "m2", teamId: "t2", startsAt: "2026-08-01T12:00:00.000Z", matchStatus: "CANCELLED", lifecycleStatus: "cancelled" }),
      ],
    });
    const p = period({ id: "p1", rounds: [r1] });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    expect(vm.focusedRound?.status).toBe("FINAL");
  });
});

describe("buildLeagueOperatingViewModel — history split", () => {
  it("excludes the focused round from recent/earlier history and caps recent at two", () => {
    const past = (id: string, day: string) =>
      round({ id, matches: [match({ id: `${id}m`, teamId: "t1", startsAt: day, lifecycleStatus: "done" })] });
    const rounds = [
      past("r1", "2026-07-01T12:00:00.000Z"),
      past("r2", "2026-07-08T12:00:00.000Z"),
      past("r3", "2026-07-15T12:00:00.000Z"),
      past("r4", "2026-07-22T12:00:00.000Z"),
    ];
    const p = period({ id: "p1", rounds });

    const vm = buildLeagueOperatingViewModel({ periods: [p], selectedPeriodId: null, selectedRoundId: null, now: NOW });
    // r4 (newest) is the focused round (most recent past round, nothing needs closure).
    expect(vm.focusedRound?.id).toBe("r4");
    expect(vm.recentRounds.map((r) => r.id)).toEqual(["r3", "r2"]);
    expect(vm.earlierRounds.map((r) => r.id)).toEqual(["r1"]);
    expect(vm.earlierRoundCount).toBe(1);
  });
});

describe("resolveMatchIssue", () => {
  const blockedSignal: FixturePlanningSignal = {
    idempotencyKey: "k1",
    kind: "BLOCKED",
    ruleCode: "SQUAD_BELOW_MINIMUM",
    title: "Squad below minimum",
    currentState: "Squad below minimum",
    consequence: "Match cannot be played.",
    primaryActionLabel: "Review squad",
    primaryActionTarget: "/matches/m1?tab=selection",
  };
  const decisionSignal: FixturePlanningSignal = {
    idempotencyKey: "k2",
    kind: "DECISION_REQUIRED",
    ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
    title: "Player has no planned opportunity",
    currentState: "1 player has no planned opportunity",
    consequence: "Player may miss out unfairly.",
    primaryActionLabel: "Review selection",
    primaryActionTarget: "/matches/m1?tab=selection",
  };

  it("surfaces a BLOCKED signal as the primary issue", () => {
    const m = match({ id: "m1", teamId: "t1", planningSignals: [blockedSignal] });
    expect(resolveMatchIssue(m)).toMatchObject({ kind: "BLOCKED", label: "Squad below minimum" });
  });

  it("surfaces a DECISION_REQUIRED signal when no BLOCKED signal exists", () => {
    const m = match({ id: "m1", teamId: "t1", planningSignals: [decisionSignal] });
    expect(resolveMatchIssue(m)).toMatchObject({ kind: "DECISION_REQUIRED", label: "1 player has no planned opportunity" });
  });

  it("shows +N more when several equivalent signals apply", () => {
    const m = match({ id: "m1", teamId: "t1", planningSignals: [decisionSignal, { ...decisionSignal, idempotencyKey: "k3" }] });
    expect(resolveMatchIssue(m).extraCount).toBe(1);
  });

  it("no signal + selected players + prepared lineup -> Ready", () => {
    const m = match({ id: "m1", teamId: "t1", lineupState: "PREPARED", selectedPlayerCount: 10 });
    expect(resolveMatchIssue(m)).toMatchObject({ kind: "READY", label: "Ready" });
  });

  it("no MatchLineup/formation -> Tactics not prepared, opening the tactics tab", () => {
    const m = match({ id: "m1", teamId: "t1", lineupState: "MISSING" });
    const issue = resolveMatchIssue(m);
    expect(issue.kind).toBe("TACTICS_MISSING");
    expect(issue.actionTarget).toBe("/matches/m1?tab=tactics");
  });

  it("live lifecycle -> Live / follow-live action", () => {
    const m = match({ id: "m1", teamId: "t1", lifecycleStatus: "live", lineupState: "PREPARED" });
    const issue = resolveMatchIssue(m);
    expect(issue.kind).toBe("LIVE");
    expect(issue.actionTarget).toBe("/matches/m1?tab=live");
  });

  it("a past played match with no report -> report missing closure work", () => {
    const m = match({ id: "m1", teamId: "t1", lifecycleStatus: "played" });
    expect(resolveMatchIssue(m).kind).toBe("REPORT_MISSING");
  });

  it("report_incomplete lifecycle -> incomplete closure work", () => {
    const m = match({ id: "m1", teamId: "t1", lifecycleStatus: "report_incomplete" });
    expect(resolveMatchIssue(m).kind).toBe("REPORT_INCOMPLETE");
  });

  it("cancelled match displays honestly regardless of other state", () => {
    const m = match({ id: "m1", teamId: "t1", matchStatus: "CANCELLED", planningSignals: [blockedSignal] });
    expect(resolveMatchIssue(m)).toEqual({ kind: "CANCELLED", label: "Cancelled" });
  });

  it("a match-owned signal is only counted for that match, not a same-round teammate match", () => {
    const ownedSignal: FixturePlanningSignal = { ...blockedSignal, matchId: "m1" };
    const ownMatch = match({ id: "m1", teamId: "t1", planningSignals: [ownedSignal] });
    const otherMatch = match({ id: "m2", teamId: "t2", planningSignals: [] });
    expect(resolveMatchIssue(ownMatch).kind).toBe("BLOCKED");
    expect(resolveMatchIssue(otherMatch).kind).toBe("READY");
  });
});
