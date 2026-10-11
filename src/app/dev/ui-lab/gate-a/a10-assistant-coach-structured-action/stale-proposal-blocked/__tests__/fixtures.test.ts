import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, proposalExpectedRevision, currentPlanRevision, blockedReason } from "../fixtures";

describe("A10-stale-proposal-blocked fixture", () => {
  it("proposal's expected revision does not match the current plan revision", () => {
    expect(proposalExpectedRevision).not.toBe(currentPlanRevision);
  });

  it("blocked reason is STALE", () => {
    expect(blockedReason.kind).toBe("STALE");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
