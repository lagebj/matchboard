import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, predeclaredOutcome } from "../fixtures";

describe("A07-S4 server-conflict fixture", () => {
  it("predeclared outcome is CONFLICT with distinct expected/current revisions", () => {
    expect(predeclaredOutcome.kind).toBe("CONFLICT");
    if (predeclaredOutcome.kind === "CONFLICT") {
      expect(predeclaredOutcome.expectedRevision).not.toBe(predeclaredOutcome.currentRevision);
    }
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
