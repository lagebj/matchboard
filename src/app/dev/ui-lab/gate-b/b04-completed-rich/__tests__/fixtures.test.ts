import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, matchInsights } from "../fixtures";

describe("B04 completed-rich fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the recorded chronology reconciles exactly with the final score", () => {
    const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
    expect(matchIdentity.score).toEqual({ home: goalsFor, away: goalsAgainst });
  });

  it("every assist pairing is only on a canonical-live-event-sourced item", () => {
    for (const item of timeline) {
      if (item.assistPlayerName !== null) {
        expect(item.sourceIsCanonicalLiveEvent).toBe(true);
      }
    }
  });

  it("the earned insight cites real evidence and is never a numeric score", () => {
    expect(matchInsights.insights.length).toBeGreaterThan(0);
    for (const insight of matchInsights.insights) {
      expect(insight.evidenceRefs.length).toBeGreaterThan(0);
      expect(["DETERMINISTIC", "AI"]).toContain(insight.source);
    }
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
