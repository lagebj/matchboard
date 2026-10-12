import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, proposal } from "../fixtures";

describe("A11-profile-change-review-guarded fixture", () => {
  it("proposes a change distinct from the current declared primary, with evidence", () => {
    expect(proposal.currentPrimary).not.toBe(proposal.proposedPrimary);
    expect(proposal.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("discloses its materiality threshold as explicitly hypothetical", () => {
    expect(proposal.materialityNote).toMatch(/Hypothetical fixture threshold, not an approved policy/);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
