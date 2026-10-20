import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, preparationInput, opponentMemory, matchInsights } from "../fixtures";

describe("B02 planned-incomplete fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("is genuinely incomplete, not a disguised 'ready' state", () => {
    expect(preparationInput.hasLineup).toBe(false);
    expect(preparationInput.hasPlannedRotation).toBe(false);
    expect(preparationInput.squadSelectedCount).toBeLessThan(preparationInput.squadTarget);
  });

  it("has no invented readiness percentage anywhere in the fixture", () => {
    const serialized = JSON.stringify(rawRecordsForHash);
    expect(serialized).not.toMatch(/\d+%/);
  });

  it("opponent memory and insights are honestly empty, not a custom placeholder", () => {
    expect(opponentMemory).toBeNull();
    expect(matchInsights.totalCount).toBe(0);
    expect(matchInsights.insights).toHaveLength(0);
  });
});
