import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, proposal } from "../fixtures";

describe("A11-profile-change-review-rejected fixture", () => {
  it("is the same proposal shape as the accepted scenario", () => {
    expect(proposal.currentPrimary).toBe("DM");
    expect(proposal.proposedPrimary).toBe("CM");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
