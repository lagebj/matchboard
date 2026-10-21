import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { isDebriefReadyToSubmit } from "@/lib/post-match/debrief/v1";
import { identity, rawRecordsForHash, afterData, initialReport, debriefAnswers, timingReview } from "../fixtures";

describe("B05 draft fixture", () => {
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

  it("has one genuine unresolved goal-attribution gap", () => {
    expect(afterData.goalAttributionGap).toEqual({ liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true });
    const unattributed = initialReport.goals.filter((g) => g.playerId === null);
    expect(unattributed).toHaveLength(1);
  });

  it("has one period still needing timing review", () => {
    expect(afterData.timingNeedsReviewCount).toBe(1);
    expect(timingReview.filter((t) => t.needsReview)).toHaveLength(1);
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
