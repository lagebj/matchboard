import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, matchInsights } from "../fixtures";

describe("A05-enabled-with-pattern fixture", () => {
  it("hypothesis cites at least one supporting evidence ref", () => {
    expect(hypothesis.supportingRefs.length).toBeGreaterThan(0);
  });

  it("matchInsights merges the AI candidate alongside deterministic ones, status CURRENT", () => {
    expect(matchInsights.status).toBe("CURRENT");
    expect(matchInsights.insights.some((i) => i.source === "AI")).toBe(true);
    expect(matchInsights.insights.some((i) => i.source === "DETERMINISTIC")).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
