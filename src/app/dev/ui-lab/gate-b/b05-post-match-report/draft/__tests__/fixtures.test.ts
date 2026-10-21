import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { isDebriefReadyToSubmit } from "@/lib/post-match/debrief/v1";
import { identity, rawRecordsForHash, afterData, initialReport, debriefAnswers, timingReview } from "../fixtures";
import { B05_LIVE_GOALS_RECORDED, b05CanonicalLiveEvents } from "../../shared/report-data";

describe("B05 draft fixture (fixtureVersion 2 — B2-R2/R3/R4/R7 remediation)", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("is a genuine draft — not yet locked, no completedBy/completedAt", () => {
    expect(initialReport.status).not.toBe("LOCKED");
    expect(afterData.reportStatus).not.toBe("LOCKED");
    expect(initialReport.completedBy).toBeNull();
    expect(initialReport.completedAt).toBeNull();
  });

  it("the debrief is already SUBMITTED-ready — the real completion gate is genuinely satisfiable, not bypassed", () => {
    expect(isDebriefReadyToSubmit(debriefAnswers)).toBe(true);
  });

  // B2-R2: the real `computeGoalAttributionGap()` counts report Goal ROWS (`db.goal.count()`),
  // never filtered by scorer presence — so the gap must come from a genuinely MISSING row, not
  // a row with a null scorer.
  it("the live goal count comes from synthetic canonical events, independent of the report", () => {
    expect(B05_LIVE_GOALS_RECORDED).toBe(3);
    expect(b05CanonicalLiveEvents.filter((e) => e.eventType === "GOAL_FOR")).toHaveLength(3);
  });

  it("the report goal count matches the actual report rows — 2, not 3-with-a-null-scorer", () => {
    expect(initialReport.goals).toHaveLength(2);
    expect(initialReport.goals.every((g) => g.playerId !== null)).toBe(true);
  });

  it("the gap follows the real production contract: attributedGoals is a row count, not a scorer-presence count", () => {
    expect(afterData.goalAttributionGap).toEqual({ liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true });
  });

  it("the official final score is independent of how many goal rows exist", () => {
    expect(initialReport.homeGoals).toBe(3);
    expect(initialReport.awayGoals).toBe(2);
  });

  it("has one period still needing timing review", () => {
    expect(afterData.timingNeedsReviewCount).toBe(1);
    expect(timingReview.filter((t) => t.needsReview)).toHaveLength(1);
  });

  it("does not expose combination evidence in draft — production only loads it for a LOCKED report", () => {
    expect(afterData.combinationEvidence).toEqual([]);
  });

  it("has one real no-show, not silently omitted from attendance", () => {
    expect(afterData.attendanceSummary.noShowCount).toBe(1);
    expect(afterData.attendanceSummary.noShowNames).toContain("Magnus");
  });

  it("has no invented measures (possession, xG, shots, cards, rating, Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "expected goal", " xg", "shots", "cards", "rating", "player of the match"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
