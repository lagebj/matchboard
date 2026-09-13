import { describe, it, expect } from "vitest";
import {
  projectCanonicalLiveState,
  mergeSnapshotWithRealtimeEvents,
  canonicalEventToSummary,
  reduceLiveEvents,
  type LiveMatchBaseline,
} from "@/lib/live-match/live-match-projection";
import type { CanonicalLiveEvent } from "@/lib/live-match/realtime/realtime-messages";

/**
 * ADR-0138 (Bundle 5, "Authoritative projection"), resolving ARR-0047's two confirmed defects
 * and covering this bundle's TEST_MATRIX.md requirements.
 */

function event(partial: Partial<CanonicalLiveEvent> & Pick<CanonicalLiveEvent, "id" | "eventType">): CanonicalLiveEvent {
  return {
    clientEventId: partial.id,
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...partial,
  };
}

function baseline(squad: { playerId: string; playerName: string; startingOnField: boolean }[]): LiveMatchBaseline {
  return { squad, activeSession: null };
}

describe("reduceLiveEvents (ADR-0138 Bundle 5, shared reducer)", () => {
  it("ARR-0047 fix: a reversal excludes the TARGETED goal via correctsEventId, not the reversal's own id", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR" }),
      event({ id: "g2", eventType: "GOAL_FOR" }),
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctionType: "REVERSAL", correctsEventId: "g2" }),
    ];
    const result = reduceLiveEvents(events, []);
    expect(result.goalsFor).toBe(1); // g1 only
    expect(result.diagnostics).toEqual([]);
  });

  it("does not depend on a recent-tail window — every goal across a long event list counts", () => {
    const events: CanonicalLiveEvent[] = [];
    for (let i = 0; i < 30; i++) events.push(event({ id: `gf-${i}`, eventType: "GOAL_FOR" }));
    for (let i = 0; i < 200; i++) events.push(event({ id: `noise-${i}`, eventType: "MOMENT_MARKED" }));
    const result = reduceLiveEvents(events, []);
    expect(result.goalsFor).toBe(30);
  });

  it("records a replay diagnostic for a reversal with no correctsEventId, without throwing", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR" }),
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctionType: "REVERSAL" }),
    ];
    const result = reduceLiveEvents(events, []);
    expect(result.goalsFor).toBe(1); // unresolvable reversal excludes nothing
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatch(/no correctsEventId/);
  });

  it("records a replay diagnostic for a reversal targeting an event outside this window", () => {
    const events = [event({ id: "rev1", eventType: "EVENT_REVERSED", correctionType: "REVERSAL", correctsEventId: "missing-goal" })];
    const result = reduceLiveEvents(events, []);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatch(/not present in this event window/);
  });

  it("derives on-field players from rotations, order-preserving and deduplicated", () => {
    const events = [
      event({ id: "r1", eventType: "ROTATION_OUT", playerId: "p1" }),
      event({ id: "r2", eventType: "ROTATION_IN", playerId: "p9" }),
      event({ id: "r3", eventType: "ROTATION_IN", playerId: "p9" }), // duplicate — no-op
    ];
    const result = reduceLiveEvents(events, ["p1", "p2"]);
    expect(result.onFieldPlayerIds).toEqual(["p2", "p9"]);
  });

  it("adds positions projection from POSITIONS_CHANGED — the most recent change wins", () => {
    const events = [
      event({ id: "pc1", eventType: "POSITIONS_CHANGED", playerId: "p1", positionChange: { fromPosition: "CM", toPosition: "CB" } }),
      event({ id: "pc2", eventType: "POSITIONS_CHANGED", playerId: "p1", positionChange: { fromPosition: "CB", toPosition: "RB" } }),
    ];
    const result = reduceLiveEvents(events, []);
    expect(result.positions).toEqual({ p1: "RB" });
  });

  it("is deterministic — the same input always produces the same output", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR" }),
      event({ id: "r1", eventType: "ROTATION_OUT", playerId: "p1" }),
      event({ id: "pc1", eventType: "POSITIONS_CHANGED", playerId: "p2", positionChange: { fromPosition: null, toPosition: "ST" } }),
    ];
    const a = reduceLiveEvents(events, ["p1", "p2"]);
    const b = reduceLiveEvents(events, ["p1", "p2"]);
    expect(a).toEqual(b);
  });
});

describe("projectCanonicalLiveState (ADR-0112, ADR-0138 Bundle 5)", () => {
  const squad = [
    { playerId: "p1", playerName: "Player One", startingOnField: true },
    { playerId: "p2", playerName: "Player Two", startingOnField: false },
  ];

  it("is deterministic under refresh — recomputing from the same baseline/events/clock/status/version is stable", () => {
    const events = [event({ id: "g1", eventType: "GOAL_FOR" })];
    const a = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    const b = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    expect(a).toEqual(b);
  });

  it("produces the same score/onField facts whether events arrive as one full snapshot or via incremental appends", () => {
    const g1 = event({ id: "g1", eventType: "GOAL_FOR", sequence: 1 });
    const rIn = event({ id: "r1", eventType: "ROTATION_IN", playerId: "p2", sequence: 2 });
    const g2 = event({ id: "g2", eventType: "GOAL_AGAINST", sequence: 3 });

    // Whole snapshot at once.
    const fromSnapshot = projectCanonicalLiveState(baseline(squad), [g1, rIn, g2], null, "ACTIVE", 3);

    // Incrementally: snapshot with g1, then two realtime appends merged in one at a time.
    let merged = mergeSnapshotWithRealtimeEvents([g1], 1, [], 1);
    merged = mergeSnapshotWithRealtimeEvents(merged, 1, [rIn], 2);
    merged = mergeSnapshotWithRealtimeEvents(merged, 2, [g2], 3);
    const fromIncremental = projectCanonicalLiveState(baseline(squad), merged, null, "ACTIVE", 3);

    expect(fromIncremental.score).toEqual(fromSnapshot.score);
    expect(fromIncremental.onField).toEqual(fromSnapshot.onField);
  });

  it("reversal removes the exact goal from the projection's own score output (ARR-0047)", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR" }),
      event({ id: "g2", eventType: "GOAL_FOR" }),
      event({ id: "rev1", eventType: "EVENT_REVERSED", correctionType: "REVERSAL", correctsEventId: "g1" }),
    ];
    const result = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    expect(result.score.goalsFor).toBe(1); // g2 only — g1 was reversed
  });

  it("score does not depend on a last-N event tail — every goal across a long history counts", () => {
    const events: CanonicalLiveEvent[] = [];
    for (let i = 0; i < 25; i++) events.push(event({ id: `gf-${i}`, eventType: "GOAL_FOR" }));
    for (let i = 0; i < 100; i++) events.push(event({ id: `noise-${i}`, eventType: "MOMENT_MARKED" }));
    const result = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    expect(result.score.goalsFor).toBe(25);
    // recentEvents display list may still be capped — that is a display concern, not a score one.
    expect(result.recentEvents.length).toBeLessThanOrEqual(events.length);
  });

  it("positions survive reload — a fresh projection built straight from a full event history recovers the same positions as one built incrementally", () => {
    const events = [
      event({ id: "pc1", eventType: "POSITIONS_CHANGED", playerId: "p1", positionChange: { fromPosition: "CM", toPosition: "CB" } }),
    ];
    // Simulates a page reload: build fresh from the full history, no prior in-memory state.
    const afterReload = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    expect(afterReload.positions.byPlayerId).toEqual({ p1: "CB" });
  });

  it("produces the same final projection whether events are replayed from a fresh empty state (simulating a coordinator restart) or incrementally", () => {
    const events = [
      event({ id: "g1", eventType: "GOAL_FOR", sequence: 1 }),
      event({ id: "pc1", eventType: "POSITIONS_CHANGED", playerId: "p1", positionChange: { fromPosition: "CM", toPosition: "CB" }, sequence: 2 }),
      event({ id: "r1", eventType: "ROTATION_OUT", playerId: "p1", sequence: 3 }),
    ];
    const freshReplay = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 3);
    let incremental = projectCanonicalLiveState(baseline(squad), [events[0]], null, "ACTIVE", 1);
    incremental = projectCanonicalLiveState(baseline(squad), [events[0], events[1]], null, "ACTIVE", 2);
    incremental = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 3);
    expect(incremental).toEqual(freshReplay);
  });

  it("falls back to the latest event's own period field when no clock anchor is available", () => {
    const events = [
      event({ id: "e1", eventType: "MATCH_START", period: "FIRST_HALF" }),
      event({ id: "e2", eventType: "PERIOD_END", period: "HALF_TIME" }),
    ];
    const result = projectCanonicalLiveState(baseline(squad), events, null, "ACTIVE", 1);
    expect(result.clock.period).toBe("HALF_TIME");
    expect(result.clock.running).toBe(false); // HALF_TIME is not a playing period
  });
});

describe("mergeSnapshotWithRealtimeEvents ordering (ARR-0047 fix 1)", () => {
  it("orders by persisted sequence, never by createdAt string comparison, once sequence is present", () => {
    // createdAt is deliberately out of sequence order — a delayed offline operation accepted
    // later in canonical order but captured earlier in wall-clock time (this programme's
    // central scenario).
    const early = event({ id: "e-early", eventType: "GOAL_FOR", createdAt: new Date(2026, 0, 1, 10, 0).toISOString(), sequence: 2 });
    const late = event({ id: "e-late", eventType: "GOAL_AGAINST", createdAt: new Date(2026, 0, 1, 9, 0).toISOString(), sequence: 1 });

    const merged = mergeSnapshotWithRealtimeEvents([late, early], 0, [], 0);
    expect(merged.map((e) => e.id)).toEqual(["e-late", "e-early"]);
  });

  it("falls back to createdAt/id tie-break only for events with no sequence at all (legacy rows)", () => {
    const a = event({ id: "a", eventType: "GOAL_FOR", createdAt: new Date(2026, 0, 1, 9, 0).toISOString() });
    const b = event({ id: "b", eventType: "GOAL_AGAINST", createdAt: new Date(2026, 0, 1, 10, 0).toISOString() });
    const merged = mergeSnapshotWithRealtimeEvents([b, a], 0, [], 0);
    expect(merged.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("a sequenced event always sorts before a legacy unsequenced one", () => {
    const legacy = event({ id: "legacy", eventType: "GOAL_FOR", createdAt: new Date(2020, 0, 1).toISOString() });
    const sequenced = event({ id: "seq", eventType: "GOAL_AGAINST", createdAt: new Date(2030, 0, 1).toISOString(), sequence: 1 });
    const merged = mergeSnapshotWithRealtimeEvents([legacy, sequenced], 0, [], 0);
    expect(merged.map((e) => e.id)).toEqual(["seq", "legacy"]);
  });
});

describe("canonicalEventToSummary match-time formatting (Bundle 5 unit fix)", () => {
  it("formats matchSeconds (already milliseconds) directly, with no extra multiply/divide by 1000", () => {
    // 90_000 ms = 1 minute 30 seconds. The pre-fix code multiplied by 1000 again, which would
    // have produced ~25 hours.
    const e = event({ id: "g1", eventType: "GOAL_FOR", matchSeconds: 90_000 });
    const summary = canonicalEventToSummary(e, {});
    expect(summary.matchClock).toBe("1:30");
  });

  it("handles a zero matchSeconds concretely (not falsy-skipped)", () => {
    const e = event({ id: "e1", eventType: "MATCH_START", matchSeconds: 0 });
    const summary = canonicalEventToSummary(e, {});
    expect(summary.matchClock).toBe("0:00");
  });

  it("omits matchClock when matchSeconds is absent, rather than showing a fabricated time", () => {
    const e = event({ id: "e1", eventType: "MOMENT_MARKED" });
    const summary = canonicalEventToSummary(e, {});
    expect(summary.matchClock).toBeUndefined();
  });
});
