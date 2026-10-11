import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, didrik } from "../fixtures";
import { deriveCandidate, successOutcome } from "../view-model";
import { initialRoster, addPlayerToRoster } from "../../../shared/roster-projection";
import { MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT } from "../../../shared/match-w3-fixture";

describe("A09-S6 match-day-addition fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("Didrik's eligibility is its own helper-eligibility fact, mapped straight through when not yet added", () => {
    expect(didrik.helperEligible).toBe(true);
    const candidate = deriveCandidate(initialRoster(MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT));
    expect(candidate.eligible).toBe(didrik.helperEligible);
  });

  it("becomes ineligible once already included in the operational roster — the already-applied authoritative result, not a new permission check", () => {
    const rosterAfterAdd = addPlayerToRoster(initialRoster(MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT), didrik.playerId);
    const candidate = deriveCandidate(rosterAfterAdd);
    expect(candidate.eligible).toBe(false);
    expect(candidate.reasons).toEqual(["Already included in this match"]);
  });

  it("the predeclared outcome is SUCCESS and applies only to the operational roster", () => {
    expect(successOutcome.kind).toBe("SUCCESS");
    if (successOutcome.kind === "SUCCESS") {
      expect(successOutcome.result.addedPlayerId).toBe(didrik.playerId);
    }
  });
});
