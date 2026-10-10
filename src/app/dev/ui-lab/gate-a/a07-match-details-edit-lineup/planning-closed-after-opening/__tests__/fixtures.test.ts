import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, predeclaredOutcome } from "../fixtures";

describe("A07-S5 planning-closed-after-opening fixture", () => {
  it("predeclared outcome is PLANNING_CLOSED", () => {
    expect(predeclaredOutcome.kind).toBe("PLANNING_CLOSED");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
