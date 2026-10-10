import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, felix } from "../fixtures";
import { successOutcome } from "../view-model";

describe("A09-S1 add-eligible-player-success fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the predeclared outcome is SUCCESS, never computed from a local eligibility check", () => {
    expect(successOutcome.kind).toBe("SUCCESS");
    if (successOutcome.kind === "SUCCESS") {
      expect(successOutcome.result.addedPlayerId).toBe(felix.playerId);
    }
  });

  it("Felix has accepted availability and actor permission allowed", () => {
    expect(felix.availability).toBe("ACCEPTED");
    expect(felix.actorPermission).toBe("ALLOWED");
  });
});
