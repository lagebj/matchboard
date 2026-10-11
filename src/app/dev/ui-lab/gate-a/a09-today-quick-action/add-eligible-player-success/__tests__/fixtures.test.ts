import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, felix } from "../fixtures";
import { deriveCandidate, successOutcome } from "../view-model";
import { initialRoster, addPlayerToRoster } from "../../../shared/roster-projection";
import { MATCH_W3_CURRENT_SQUAD_SIZE } from "../../../shared/match-w3-fixture";

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

  it("Felix is eligible before being added, and ineligible with an 'already included' reason once added — derived from the roster, never a static constant", () => {
    const before = deriveCandidate(initialRoster(MATCH_W3_CURRENT_SQUAD_SIZE));
    expect(before.eligible).toBe(true);

    const rosterAfterAdd = addPlayerToRoster(initialRoster(MATCH_W3_CURRENT_SQUAD_SIZE), felix.playerId);
    const after = deriveCandidate(rosterAfterAdd);
    expect(after.eligible).toBe(false);
    expect(after.reasons).toEqual(["Already included in this match"]);
  });
});
