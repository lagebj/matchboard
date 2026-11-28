import { describe, it, expect } from "vitest";
import {
  buildMatchPresentation,
  matchPresentationPhase,
  awaitingReportLabel,
} from "@/lib/matches/match-presentation";
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

// Issue #853: a non-null score must never, by itself, promote a match to the `final` phase — only
// `lifecycle === "done"` may. `played` (kicked off, no report) and `report_incomplete` (a DRAFT or
// not-yet-locked report) must read as `awaiting_report`, never `final`, even when a caller has
// passed through a provisional score (e.g. a draft report a coach has started typing goals into).

const ALL_LIFECYCLES: MatchLifecycleStatus[] = [
  "planning_open",
  "planning_closed",
  "live",
  "played",
  "report_incomplete",
  "done",
  "cancelled",
];

describe("matchPresentationPhase", () => {
  it.each(ALL_LIFECYCLES)("derives the correct phase for lifecycle %s with no score", (lifecycle) => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: lifecycle,
    });
    const expected =
      lifecycle === "cancelled"
        ? "cancelled"
        : lifecycle === "live"
          ? "live"
          : lifecycle === "done"
            ? "final"
            : lifecycle === "played" || lifecycle === "report_incomplete"
              ? "awaiting_report"
              : "scheduled";
    expect(matchPresentationPhase(p)).toBe(expected);
  });

  it("never returns final for played, even with a non-null score passed through", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "played",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    });
    expect(p.score).not.toBeNull();
    expect(matchPresentationPhase(p)).toBe("awaiting_report");
  });

  it("never returns final for report_incomplete, even with a draft score passed through", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "report_incomplete",
      ownGoals: 3,
      opponentGoals: 0,
      outcome: "WON",
    });
    expect(p.score).not.toBeNull();
    expect(matchPresentationPhase(p)).toBe("awaiting_report");
  });

  it("returns final for done regardless of score presence", () => {
    const withScore = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 2,
      outcome: "DRAWN",
    });
    expect(matchPresentationPhase(withScore)).toBe("final");
  });
});

describe("score", () => {
  // A non-null `score` is legitimate on an `awaiting_report` presentation (e.g. a report a coach
  // is actively editing, or a DRAFT/REPORTED-but-not-locked report's recorded goals) — the #853
  // defect was the `final`/"FT" label implying that number was a confirmed result, not the
  // number's mere presence. A renderer is free to show it transparently alongside a truthful
  // `awaitingReportLabel()`; `buildMatchPresentation()` itself only ever withholds it for
  // `cancelled` (ADR already covers that — see `hasScore` in the builder).
  it("stays visible on a played presentation (kicked off, no report at all would just be null anyway)", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "played",
      ownGoals: 1,
      opponentGoals: 0,
      outcome: "WON",
    });
    expect(p.score).toEqual({ home: 1, away: 0 });
    expect(matchPresentationPhase(p)).toBe("awaiting_report");
  });

  it("stays visible on a report_incomplete (draft) presentation", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "report_incomplete",
      ownGoals: 4,
      opponentGoals: 2,
      outcome: "WON",
    });
    expect(p.score).toEqual({ home: 4, away: 2 });
    expect(matchPresentationPhase(p)).toBe("awaiting_report");
  });

  it("never exists for a cancelled match even when stale score fields were passed in", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "cancelled",
      ownGoals: 2,
      opponentGoals: 0,
      outcome: "WON",
      cancelledReason: "Opponent withdrew",
    });
    expect(p.score).toBeNull();
  });
});

describe("awaitingReportLabel", () => {
  it("uses the canonical 'Played' label when no report exists at all", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "played",
    });
    expect(awaitingReportLabel(p)).toBe("Played");
  });

  it("uses the canonical 'Report incomplete' label for a draft/pending report", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "report_incomplete",
    });
    expect(awaitingReportLabel(p)).toBe("Report incomplete");
  });

  it("prefers a caller-supplied reportAttention qualifier when present", () => {
    const p = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Blå",
      lifecycleStatus: "report_incomplete",
      reportAttention: { label: "Report draft", tone: "warning" },
    });
    expect(awaitingReportLabel(p)).toBe("Report draft");
  });
});
