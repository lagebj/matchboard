import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchInsights } from "../fixtures";

describe("A05-disabled fixture", () => {
  it("has no AI candidates and status CURRENT", () => {
    expect(matchInsights.status).toBe("CURRENT");
    expect(matchInsights.insights.every((i) => i.source === "DETERMINISTIC")).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
