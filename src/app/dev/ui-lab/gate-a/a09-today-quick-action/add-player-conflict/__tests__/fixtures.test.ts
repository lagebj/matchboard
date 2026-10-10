import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash } from "../fixtures";
import { conflictOutcome } from "../view-model";

describe("A09-S5 add-player-conflict fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the predeclared outcome is CONFLICT with distinct expected/current revisions", () => {
    expect(conflictOutcome.kind).toBe("CONFLICT");
    if (conflictOutcome.kind === "CONFLICT") {
      expect(conflictOutcome.expectedRevision).not.toBe(conflictOutcome.currentRevision);
    }
  });
});
