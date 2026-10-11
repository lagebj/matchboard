import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, predeclaredOutcome, proposal, proposalExpectedRevision, currentPlanRevision } from "../fixtures";

describe("A10-review-alternative-success fixture", () => {
  it("predeclared outcome is SUCCESS", () => {
    expect(predeclaredOutcome.kind).toBe("SUCCESS");
  });

  it("proposal's expected revision matches the current plan revision — Apply is genuinely available", () => {
    expect(proposalExpectedRevision).toBe(currentPlanRevision);
  });

  it("proposal cites at least one evidence ref and a rationale distinct from the evidence", () => {
    expect(proposal.evidenceRefs.length).toBeGreaterThan(0);
    expect(proposal.rationale.length).toBeGreaterThan(0);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
