import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, jonas } from "../fixtures";
import { candidate } from "../view-model";

describe("A09-S3 add-player-rsvp-blocked fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("Jonas has no response after the RSVP cutoff and the mapped candidate is ineligible", () => {
    expect(jonas.availability).toBe("NO_RESPONSE_AFTER_DEADLINE");
    expect(candidate.eligible).toBe(false);
  });
});
