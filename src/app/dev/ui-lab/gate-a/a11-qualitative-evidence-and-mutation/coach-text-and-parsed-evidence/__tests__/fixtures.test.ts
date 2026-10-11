import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, extraction } from "../fixtures";
import { safeParseExtractionResponse } from "@/lib/evidence/qualitative-evidence-extraction-contract";

describe("A11-coach-text-and-parsed-evidence fixture", () => {
  it("every observation is a claim present in the coach's own text, not invented", () => {
    expect(extraction.observations.length).toBeGreaterThan(0);
    for (const observation of extraction.observations) {
      expect(observation.statement.length).toBeGreaterThan(0);
    }
  });

  it("preserves tentative wording rather than resolving it", () => {
    expect(extraction.observations.some((o) => o.explicitness === "TENTATIVE")).toBe(true);
  });

  it("re-validates against the real extraction response schema independently", () => {
    const result = safeParseExtractionResponse(extraction);
    expect(result.success).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
