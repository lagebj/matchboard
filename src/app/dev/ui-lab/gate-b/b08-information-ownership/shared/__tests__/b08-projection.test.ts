import { describe, it, expect } from "vitest";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import {
  computeEffectiveLiveEvents,
  deriveEffectiveScore,
  deriveGoalsAndAssists,
  deriveEffectiveTimeline,
  deriveB08AfterDataFromReport,
  deriveB08IdentityFromReport,
  resolveB08EffectiveHistory,
} from "../b08-projection";
import { b08CanonicalLiveEvents } from "../fixture-history";
import type { B08PersistedReportState } from "../b08-journey";

/**
 * B08 W5 second remediation (independent review, 2026-11-08, "lifecycle data consistency",
 * section 11) — literal expected values for every required case, never a self-comparison between
 * two functions sharing the same assumption. `computeEffectiveLiveEvents()` is verified against
 * the REAL production reversal algorithm it mirrors (`get-match-detail-after-data.ts`), not a
 * reimplementation invented here.
 */

function event(partial: Partial<LiveEventSummary> & Pick<LiveEventSummary, "id" | "eventType">): LiveEventSummary {
  return {
    clientEventId: null,
    period: "FIRST_HALF",
    matchSeconds: null,
    wallClockTime: null,
    playerId: null,
    secondaryPlayerId: null,
    isCorrected: false,
    isReversed: false,
    correctsEventId: null,
    positionChange: null,
    ...partial,
  };
}

describe("computeEffectiveLiveEvents — mirrors the real production reversal algorithm", () => {
  it("reference fixture (no reversals): every event stays effective, 2-1", () => {
    const effective = computeEffectiveLiveEvents(b08CanonicalLiveEvents as unknown as LiveEventSummary[]);
    expect(effective).toHaveLength(b08CanonicalLiveEvents.length);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 2, opponentGoals: 1 });
  });

  it("LIVE cutoff at 45' (first two canonical goals only, before the 48' winner): 1-1", () => {
    const cutoff = (b08CanonicalLiveEvents as unknown as LiveEventSummary[]).slice(0, 3); // goal-1 + scorer-1 + goal-against-1
    expect(deriveEffectiveScore(computeEffectiveLiveEvents(cutoff))).toEqual({ ourGoals: 1, opponentGoals: 1 });
  });

  it("finished without recording a new goal: 1-1 (no GOAL_FOR beyond the cutoff seed)", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle" }),
      event({ id: "ga1", eventType: "GOAL_AGAINST" }),
    ];
    const effective = computeEffectiveLiveEvents(events);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 1, opponentGoals: 1 });
  });

  it("new goal, scorer skipped: 2-1, with the new goal row unattributed (playerName null)", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle" }),
      event({ id: "ga1", eventType: "GOAL_AGAINST" }),
      event({ id: "g2", eventType: "GOAL_FOR", clientEventId: "c2" }), // scorer skipped — no SCORER_SET for c2
    ];
    const effective = computeEffectiveLiveEvents(events);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 2, opponentGoals: 1 });
    const { goals } = deriveGoalsAndAssists(effective);
    expect(goals).toHaveLength(2);
    const unattributed = goals.find((g) => g.id === "g2")!;
    expect(unattributed.playerName).toBeNull();
    expect(unattributed.participantKey).toBeNull();
  });

  it("new goal, scorer assigned: 2-1, attributed to the real scorer", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle" }),
      event({ id: "ga1", eventType: "GOAL_AGAINST" }),
      event({ id: "g2", eventType: "GOAL_FOR", clientEventId: "c2" }),
      event({ id: "s2", eventType: "SCORER_SET", correctsEventId: "c2", playerId: "player-gb8-noah" }),
      event({ id: "a2", eventType: "ASSIST_SET", correctsEventId: "c2", playerId: "player-gb8-sindre" }),
    ];
    const effective = computeEffectiveLiveEvents(events);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 2, opponentGoals: 1 });
    const { goals, assists } = deriveGoalsAndAssists(effective);
    expect(goals.find((g) => g.id === "g2")!.playerName).toBe("Noah");
    expect(assists).toHaveLength(1);
    expect(assists[0]!.playerName).toBe("Sindre");
  });

  it("goal followed by a real reversal (EVENT_REVERSED referencing the goal's own id, not its clientEventId): back to 1-1, and the reversed goal contributes no row", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle" }),
      event({ id: "ga1", eventType: "GOAL_AGAINST" }),
      event({ id: "g2", eventType: "GOAL_FOR", clientEventId: "c2" }),
      event({ id: "s2", eventType: "SCORER_SET", correctsEventId: "c2", playerId: "player-gb8-noah" }),
      // Undo targets the goal's own `id` (`g2`), per LiveMatchClient.handleUndo(eventId) ->
      // recordEventLocal("EVENT_REVERSED", { correctsEventId: eventId }) where eventId is
      // event.id — NOT g2's clientEventId ("c2"). A reversal using the wrong namespace would
      // silently fail to exclude anything; this test would catch that regression.
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctsEventId: "g2" }),
    ];
    const effective = computeEffectiveLiveEvents(events);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 1, opponentGoals: 1 });
    expect(effective.some((e) => e.id === "g2")).toBe(false);
    expect(effective.some((e) => e.id === "s2")).toBe(true); // the SCORER_SET itself isn't reversed, just orphaned
    const { goals } = deriveGoalsAndAssists(effective);
    expect(goals).toHaveLength(1);
    expect(goals[0]!.id).toBe("g1");
    // The EVENT_REVERSED marker itself is never a visible event.
    expect(effective.some((e) => e.eventType === "EVENT_REVERSED")).toBe(false);
  });

  it("reversing using the WRONG reference (a clientEventId instead of the real id) does not reverse anything — proves the two correction namespaces are genuinely distinct, not interchangeable", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      // Wrong: targets "c1" (the clientEventId) instead of "g1" (the real id).
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctsEventId: "c1" }),
    ];
    const effective = computeEffectiveLiveEvents(events);
    // g1 survives — c1 is not g1's own id, so the (incorrectly-targeted) reversal matches nothing.
    expect(effective.some((e) => e.id === "g1")).toBe(true);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 1, opponentGoals: 0 });
  });

  it("this projection does NOT deduplicate a genuine duplicate array entry — array length is counted verbatim; deduplication is the write boundary's own job, not this derivation's", () => {
    const g1 = event({ id: "g1", eventType: "GOAL_FOR" });
    const events = [g1, { ...g1 }]; // same id, literally the same event object appearing twice
    const effective = computeEffectiveLiveEvents(events);
    // computeEffectiveLiveEvents() itself does not dedupe by id (production's own two real
    // Prisma queries can't produce a true row-level duplicate — a unique id constraint already
    // prevents it upstream); dedup-by-id is the ledger-write side's own job
    // (`recordEvent()` in `safe-transition-controller.ts`), never this derivation's. This test
    // documents that real architectural boundary — it is NOT, by itself, evidence that
    // `recordEvent()` is idempotent; that real claim is proven directly against the actual write
    // boundary in `safe-transition-controller.test.tsx`'s own "idempotent event recording" suite.
    expect(effective).toHaveLength(2);
    expect(deriveEffectiveScore(effective)).toEqual({ ourGoals: 2, opponentGoals: 0 });
  });

  it("completed 1-1 report (via the AFTER-data projection): LOCKED, 1-1, factual-only — no reference-only narrative leaks in", () => {
    const report: B08PersistedReportState = {
      status: "LOCKED",
      ourScore: 1,
      opponentScore: 1,
      goals: [{ id: "g1", playerId: "player-gb8-vetle", playerName: "Vetle", minute: 10 }],
      assists: [],
      players: [{ id: "a1", playerId: "player-gb8-vetle", playerName: "Vetle", attendanceStatus: "PRESENT" }],
      timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 30, needsReview: false }],
      outOfRangeEventCount: 0,
      completedBy: "Kristin Haug",
      completedAt: "2026-11-08T09:00:00.000Z",
      nextLocalId: 0,
    };
    const data = deriveB08AfterDataFromReport(report, resolveB08EffectiveHistory("LIVE_JOURNEY", []));
    expect(data.reportStatus).toBe("LOCKED");
    expect(data.homeGoals).toBe(1);
    expect(data.awayGoals).toBe(1);
    expect(data.completedBy).toBe("Kristin Haug");
    expect(data.reflection).toBeNull();
    expect(data.footballObservations).toEqual([]);
    expect(data.opponentObservation).toBeNull();
    expect(data.combinationEvidence).toEqual([]);

    const identity = deriveB08IdentityFromReport(report, "done");
    expect(identity.score).toEqual({ home: 1, away: 1 });
    expect(identity.outcomeLabel).toBe("DRAW");
  });

  it("completed 2-1 journey (via the AFTER-data projection): LOCKED, the real recorded 2-1 — not the fixed canonical value", () => {
    const report: B08PersistedReportState = {
      status: "LOCKED",
      ourScore: 2,
      opponentScore: 1,
      goals: [
        { id: "g1", playerId: "player-gb8-vetle", playerName: "Vetle", minute: 10 },
        { id: "g2", playerId: null, playerName: null, minute: 48 },
      ],
      assists: [],
      players: [{ id: "a1", playerId: "player-gb8-vetle", playerName: "Vetle", attendanceStatus: "PRESENT" }],
      timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 30, needsReview: false }],
      outOfRangeEventCount: 0,
      completedBy: "Kristin Haug",
      completedAt: "2026-11-08T09:00:00.000Z",
      nextLocalId: 0,
    };
    const data = deriveB08AfterDataFromReport(report, resolveB08EffectiveHistory("LIVE_JOURNEY", []));
    expect(data.homeGoals).toBe(2);
    expect(data.awayGoals).toBe(1);
    expect(data.goalAttributionGap!.attributedGoals).toBe(2);
    // One of the two goals has no scorer — hasGap only trips when FEWER goals are attributed
    // than were actually recorded live, which this report-only check can't see on its own
    // (liveGoalsRecorded defaults to the effective live-event count, [] here) — asserting the
    // real, documented field shape, not inventing a stronger claim this function doesn't make.
    expect(data.goalScorers.scorers.map((s) => s.playerName)).toContain("Vetle");
  });

  it("chronology: the effective timeline only ever contains non-reversed events, real buildMatchTimeline(), never a second chronology builder", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1", period: "FIRST_HALF", matchSeconds: 600_000 }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle", period: "FIRST_HALF" }),
      event({ id: "g2", eventType: "GOAL_FOR", clientEventId: "c2", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctsEventId: "g2" }),
    ];
    const timeline = deriveEffectiveTimeline(computeEffectiveLiveEvents(events));
    const goalItems = timeline.filter((i) => i.kind === "GOAL_FOR");
    expect(goalItems).toHaveLength(1);
  });
});

/**
 * Third remediation (independent review, 2026-11-08, "final data-integrity remediation",
 * defect #1): a REFERENCE-origin persisted report (a direct edit of the canonical report, no
 * LIVE journey involved) must keep the real 10'/22'/48' chronology — before this fix,
 * `deriveB08AfterDataFromReport()` always received a raw `effectiveEvents` array a
 * REFERENCE-origin caller had no correct way to populate (it has no LIVE event ledger at all),
 * so every reference-mode edit silently derived an EMPTY timeline and a `liveGoalsRecorded: 0`
 * goal-attribution-gap figure. `resolveB08EffectiveHistory()` is the single place this is now
 * decided, by the real `historyOrigin`, never inferred from an array's own emptiness.
 */
describe("resolveB08EffectiveHistory — history provenance (third remediation)", () => {
  it("REFERENCE origin: the real canonical chronology, never an empty derivation", () => {
    const history = resolveB08EffectiveHistory("REFERENCE", null);
    expect(history.liveGoalsRecorded).toBe(2);
    expect(history.timeline.length).toBeGreaterThan(0);
    expect(history.teamNote.length).toBeGreaterThan(0);
    expect(history.effectiveEvents).toHaveLength(0);
  });

  it("no journey at all (a direct visit): the identical canonical chronology as REFERENCE — never a third, empty guess", () => {
    const history = resolveB08EffectiveHistory(null, null);
    expect(history).toEqual(resolveB08EffectiveHistory("REFERENCE", null));
  });

  it("LIVE_JOURNEY origin with a real finished ledger: the actually-recorded chronology, reversal-aware, and no reference team note", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", clientEventId: "c1" }),
      event({ id: "s1", eventType: "SCORER_SET", correctsEventId: "c1", playerId: "player-gb8-vetle" }),
      event({ id: "ga1", eventType: "GOAL_AGAINST" }),
    ];
    const history = resolveB08EffectiveHistory("LIVE_JOURNEY", events);
    expect(history.liveGoalsRecorded).toBe(1);
    expect(history.teamNote).toBe("");
    expect(history.effectiveEvents).toHaveLength(3);
  });

  it("LIVE_JOURNEY origin with no events array (defensive — should not happen in practice) falls back to the canonical chronology, same as REFERENCE", () => {
    const history = resolveB08EffectiveHistory("LIVE_JOURNEY", null);
    expect(history).toEqual(resolveB08EffectiveHistory("REFERENCE", null));
  });
});
