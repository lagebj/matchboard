import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, proposalValidation, blockedReason, evidence } from "../fixtures";

describe("A10-stale-proposal-blocked fixture", () => {
  it("the fixture's own proposal validates as STALE, not structurally rejected", () => {
    expect(proposalValidation.valid).toBe(true);
    if (proposalValidation.valid) {
      expect(proposalValidation.applicability).toBe("STALE");
      if (proposalValidation.applicability === "STALE") {
        expect(proposalValidation.expectedRevision).not.toBe(proposalValidation.currentRevision);
      }
    }
  });

  it("blocked reason is STALE and its message cites both revisions", () => {
    expect(blockedReason.kind).toBe("STALE");
    expect(blockedReason.message).toMatch(/lineup-rev-2/);
    expect(blockedReason.message).toMatch(/lineup-rev-1/);
  });

  it("evidence remains resolvable even though Apply is blocked", () => {
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
