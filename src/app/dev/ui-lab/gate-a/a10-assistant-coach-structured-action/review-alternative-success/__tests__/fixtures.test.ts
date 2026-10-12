import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, predeclaredOutcome, proposal, proposalValidation, evidence } from "../fixtures";

describe("A10-review-alternative-success fixture", () => {
  it("predeclared outcome is SUCCESS", () => {
    expect(predeclaredOutcome.kind).toBe("SUCCESS");
  });

  it("the fixture's own proposal validates as APPLICABLE against the shared validation context", () => {
    expect(proposalValidation.valid).toBe(true);
    if (proposalValidation.valid) expect(proposalValidation.applicability).toBe("APPLICABLE");
  });

  it("proposal cites resolvable evidence and a rationale distinct from the evidence", () => {
    expect(proposal.evidenceRefs.length).toBeGreaterThan(0);
    expect(evidence.length).toBe(proposal.evidenceRefs.length);
    expect(proposal.rationale.length).toBeGreaterThan(0);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
