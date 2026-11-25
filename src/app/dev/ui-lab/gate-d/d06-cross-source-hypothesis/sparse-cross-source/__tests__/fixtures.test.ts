import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, noHypothesisState } from "../fixtures";

describe("GATE-D-W2-D06-SPARSE fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("distinguishes missing data, insufficient sample, no contrary evidence, and coach uncertainty as separate facts", () => {
    const facts = noHypothesisState.availableFacts;
    expect(facts.some((f) => f.startsWith("Missing data:"))).toBe(true);
    expect(facts.some((f) => f.startsWith("Insufficient sample:"))).toBe(true);
    expect(facts.some((f) => f.startsWith("No contrary evidence:"))).toBe(true);
    expect(facts.some((f) => f.startsWith("Coach uncertainty"))).toBe(true);
  });
});
