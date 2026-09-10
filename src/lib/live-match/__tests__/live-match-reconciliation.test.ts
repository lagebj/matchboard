import { describe, it, expect } from "vitest";
import { reconcileFromServerEvents } from "@/lib/live-match/live-match-reconciliation";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";

function ev(partial: Partial<LiveEventSummary> & Pick<LiveEventSummary, "id" | "eventType">): LiveEventSummary {
  return {
    period: null,
    matchSeconds: null,
    wallClockTime: null,
    playerId: null,
    secondaryPlayerId: null,
    isCorrected: false,
    isReversed: false,
    correctsEventId: null,
    ...partial,
  };
}

describe("reconcileFromServerEvents (ADR-0133 H6)", () => {
  it("counts every goal across a long event list, not just a recent tail", () => {
    // The 2026-09-09 incident: 8 goals for spread through ~68 events. A windowed reconcile
    // dropped the early ones and reset the score.
    const events: LiveEventSummary[] = [];
    for (let i = 0; i < 8; i++) events.push(ev({ id: `gf-${i}`, eventType: "GOAL_FOR" }));
    for (let i = 0; i < 3; i++) events.push(ev({ id: `ga-${i}`, eventType: "GOAL_AGAINST" }));
    for (let i = 0; i < 60; i++) events.push(ev({ id: `noise-${i}`, eventType: "MOMENT_MARKED" }));

    const r = reconcileFromServerEvents(events, new Set());
    expect(r.goalsFor).toBe(8);
    expect(r.goalsAgainst).toBe(3);
  });

  it("un-counts a goal that a later EVENT_REVERSED points at via correctsEventId", () => {
    const events: LiveEventSummary[] = [
      ev({ id: "g1", eventType: "GOAL_FOR" }),
      ev({ id: "g2", eventType: "GOAL_FOR" }),
      // The reversal row's own `isReversed` is true; the goal it reverses is `g2`.
      ev({ id: "rev1", eventType: "EVENT_REVERSED", isReversed: true, correctsEventId: "g2" }),
      ev({ id: "g3", eventType: "GOAL_AGAINST" }),
    ];

    const r = reconcileFromServerEvents(events, new Set());
    expect(r.goalsFor).toBe(1); // g1 only — g2 was reversed
    expect(r.goalsAgainst).toBe(1);
  });

  it("tracks on-field players through rotations, ignoring a reversed rotation", () => {
    const events: LiveEventSummary[] = [
      ev({ id: "r1out", eventType: "ROTATION_OUT", playerId: "p1" }),
      ev({ id: "r1in", eventType: "ROTATION_IN", playerId: "p9" }),
      ev({ id: "r2out", eventType: "ROTATION_OUT", playerId: "p2" }),
      ev({ id: "rev", eventType: "EVENT_REVERSED", isReversed: true, correctsEventId: "r2out" }),
    ];

    const r = reconcileFromServerEvents(events, new Set(["p1", "p2", "p3"]));
    // p1 rotated out, p9 rotated in, p2's rotation-out was reversed so p2 stays on.
    expect(r.onFieldPlayerIds).toEqual(new Set(["p2", "p3", "p9"]));
  });
});
