import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, erik } from "../fixtures";
import { candidate } from "../view-model";

describe("A09-S2 add-player-denied fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("Erik's actor permission is DENIED and the mapped candidate is ineligible", () => {
    expect(erik.actorPermission).toBe("DENIED");
    expect(candidate.eligible).toBe(false);
  });
});
