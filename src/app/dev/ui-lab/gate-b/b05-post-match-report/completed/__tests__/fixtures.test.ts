import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, afterData, initialReport, timingReview } from "../fixtures";
import { identity as draftIdentity } from "../../draft/fixtures";

describe("B05 completed fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("is genuinely locked — completedBy/completedAt set, status LOCKED", () => {
    expect(initialReport.status).toBe("LOCKED");
    expect(afterData.reportStatus).toBe("LOCKED");
    expect(initialReport.completedBy).toBe("Marte Johansen");
    expect(initialReport.completedAt).not.toBeNull();
  });

  it("the previously-unattributed goal is now attributed — the real gap was resolved, not silently dropped", () => {
    expect(afterData.goalAttributionGap).toEqual({ liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false });
    const unattributed = initialReport.goals.filter((g) => g.playerId === null);
    expect(unattributed).toHaveLength(0);
  });

  it("the timing review item is resolved, not still pending", () => {
    expect(afterData.timingNeedsReviewCount).toBe(0);
    expect(timingReview.every((t) => !t.needsReview)).toBe(true);
  });

  it("shares the same real match identity and squad as the draft fixture — one report's own lifecycle, not two different matches", () => {
    expect(afterData.reportId).toBe("report-gate-b-05");
    expect(initialReport.matchId).toBe("match-gate-b-05");
    expect(initialReport.teamName).toBe("Slemmestad Rød");
    expect(initialReport.opponent).toBe("Kongsberg IL");
    expect(identity.fixtureId).not.toBe(draftIdentity.fixtureId);
    expect(identity.scenarioId).not.toBe(draftIdentity.scenarioId);
  });

  it("has no invented measures (possession, xG, shots, cards, rating, Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "expected goal", " xg", "shots", "cards", "rating", "player of the match"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
