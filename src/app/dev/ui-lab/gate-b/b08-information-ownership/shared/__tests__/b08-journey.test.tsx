import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadB08Journey,
  loadB08HistoryOrigin,
  loadB08JourneyReport,
  loadFinishedB08JourneyEvents,
  saveB08JourneyEvents,
  markB08JourneyFinished,
  saveB08JourneyReport,
  resetB08Journey,
  type B08PersistedReportState,
} from "../b08-journey";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";

/**
 * Fourth remediation (independent review, 2026-11-08, "final source-of-truth remediation",
 * defect #2) — storage/write-boundary tests for the history-origin invariant: a persisted
 * `"REFERENCE"`-origin report must never be silently retained under a newly-flipped
 * `"LIVE_JOURNEY"` origin. `.tsx` (not `.ts`) deliberately — this repo's default `vitest run`
 * config uses the `node` environment (no `window`/`sessionStorage` at all), under which every
 * function in `b08-journey.ts` silently no-ops via its own `typeof window === "undefined"` guard;
 * only the component-test config (`jsdom`) actually exercises the real storage behavior, matching
 * `safe-transition-controller.test.tsx`'s own established precedent for the same reason.
 */

const EVENT: LiveEventSummary = {
  id: "e1",
  clientEventId: "c1",
  eventType: "GOAL_FOR",
  period: "SECOND_HALF",
  matchSeconds: 900_000,
  wallClockTime: null,
  playerId: null,
  secondaryPlayerId: null,
  isCorrected: false,
  isReversed: false,
  correctsEventId: null,
  positionChange: null,
};

function referenceReport(): B08PersistedReportState {
  return {
    status: "REPORTED",
    ourScore: 2,
    opponentScore: 1,
    goals: [],
    assists: [],
    players: [],
    timingReview: [],
    outOfRangeEventCount: 0,
    completedBy: null,
    completedAt: null,
    nextLocalId: 0,
  };
}

beforeEach(() => resetB08Journey());
afterEach(() => resetB08Journey());

describe("b08-journey — history-origin write-boundary protection (fourth remediation, defect #2)", () => {
  it("a REFERENCE-origin report blocks saveB08JourneyEvents — the write is rejected, the report and origin are unchanged", () => {
    const report = referenceReport();
    saveB08JourneyReport(report, "REFERENCE");
    expect(loadB08HistoryOrigin()).toBe("REFERENCE");

    const result = saveB08JourneyEvents([EVENT]);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason.length).toBeGreaterThan(0);

    // Nothing changed: origin, report and events all exactly as before the rejected write.
    expect(loadB08HistoryOrigin()).toBe("REFERENCE");
    expect(loadB08JourneyReport()).toEqual(report);
    expect(loadB08Journey()!.events).toEqual([]);
  });

  it("a REFERENCE-origin report blocks markB08JourneyFinished — even with no prior recordEvent call", () => {
    const report = referenceReport();
    saveB08JourneyReport(report, "REFERENCE");

    const result = markB08JourneyFinished([EVENT]);
    expect(result.accepted).toBe(false);

    expect(loadB08HistoryOrigin()).toBe("REFERENCE");
    expect(loadB08JourneyReport()).toEqual(report);
    expect(loadFinishedB08JourneyEvents()).toBeNull();
  });

  it("after Reset journey, the reference state is cleared and a new LIVE journey may start", () => {
    saveB08JourneyReport(referenceReport(), "REFERENCE");
    expect(loadB08HistoryOrigin()).toBe("REFERENCE");

    resetB08Journey();
    expect(loadB08Journey()).toBeNull();
    expect(loadB08HistoryOrigin()).toBeNull();
    expect(loadB08JourneyReport()).toBeNull();

    const result = saveB08JourneyEvents([EVENT]);
    expect(result.accepted).toBe(true);
    expect(loadB08HistoryOrigin()).toBe("LIVE_JOURNEY");
  });

  it("a full valid LIVE_JOURNEY lifecycle: record, finish, reconcile — report and event history share the same origin", () => {
    expect(saveB08JourneyEvents([EVENT]).accepted).toBe(true);
    expect(loadB08HistoryOrigin()).toBe("LIVE_JOURNEY");

    expect(markB08JourneyFinished([EVENT]).accepted).toBe(true);
    expect(loadFinishedB08JourneyEvents()).toEqual([EVENT]);

    const liveReport: B08PersistedReportState = { ...referenceReport(), ourScore: 1, opponentScore: 1 };
    saveB08JourneyReport(liveReport, "LIVE_JOURNEY");
    expect(loadB08HistoryOrigin()).toBe("LIVE_JOURNEY");
    expect(loadB08JourneyReport()).toEqual(liveReport);
  });

  it("the reverse constraint: an ordinary report edit on an ALREADY-LIVE_JOURNEY-origin report never flips its origin to REFERENCE", () => {
    saveB08JourneyEvents([EVENT]);
    expect(loadB08HistoryOrigin()).toBe("LIVE_JOURNEY");

    // A caller passing the "wrong" origin (e.g. a stale/defensive default) has no effect — the
    // real, already-established origin always wins.
    saveB08JourneyReport(referenceReport(), "REFERENCE");
    expect(loadB08HistoryOrigin()).toBe("LIVE_JOURNEY");
  });

  it("saveB08JourneyReport on a genuinely fresh store (no journey at all) establishes REFERENCE and is never rejected", () => {
    expect(loadB08Journey()).toBeNull();
    const report = referenceReport();
    saveB08JourneyReport(report, "REFERENCE");
    expect(loadB08HistoryOrigin()).toBe("REFERENCE");
    expect(loadB08JourneyReport()).toEqual(report);
  });
});
