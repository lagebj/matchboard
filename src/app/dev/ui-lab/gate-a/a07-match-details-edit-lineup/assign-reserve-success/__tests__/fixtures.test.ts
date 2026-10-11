import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, predeclaredOutcome } from "../fixtures";

describe("A07-S1/S2 assign-reserve-success fixture", () => {
  it("predeclared outcome is SUCCESS", () => {
    expect(predeclaredOutcome.kind).toBe("SUCCESS");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
