import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline } from "../fixtures";

describe("B03 completed-sparse fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the final score (6-4) is recorded as a real result independent of event-logging completeness", () => {
    expect(matchIdentity.score).toEqual({ home: 6, away: 4 });
  });

  it("only one event is individually logged — the deliberate sparse mismatch", () => {
    expect(timeline).toHaveLength(1);
  });

  it("never pairs a fabricated assist to the single recorded goal", () => {
    for (const item of timeline) {
      expect(item.assistPlayerName).toBeNull();
    }
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
