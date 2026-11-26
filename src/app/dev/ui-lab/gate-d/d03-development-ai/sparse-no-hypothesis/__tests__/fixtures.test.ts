import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypotheses, developmentInput } from "../fixtures";

describe("GATE-D-W2-D03-SPARSE fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("has no Assistant Coach hypothesis — the sparse case must not fabricate one", () => {
    expect(hypotheses).toHaveLength(0);
  });

  it("has exactly one observation, matching the real single-appearance scenario", () => {
    expect(developmentInput.observationTimeline).toHaveLength(1);
    expect(developmentInput.activeFocus?.observationCount).toBe(1);
  });

  it("the active focus has no review state yet — too new for a review cadence to apply", () => {
    expect(developmentInput.activeFocus?.reviewState).toBeNull();
  });
});
