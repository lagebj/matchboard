import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, blockedReason } from "../fixtures";

describe("A10-disabled-or-failed fixture", () => {
  it("blocked reason is UNAVAILABLE", () => {
    expect(blockedReason.kind).toBe("UNAVAILABLE");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
