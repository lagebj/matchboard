import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline } from "../fixtures";

describe("B06 League · After fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the logged chronology reconciles exactly with the final 3-1 score", () => {
    const goalsFor = timeline.filter((e) => e.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((e) => e.kind === "GOAL_AGAINST").length;
    expect(goalsFor).toBe(matchIdentity.score?.home);
    expect(goalsAgainst).toBe(matchIdentity.score?.away);
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
