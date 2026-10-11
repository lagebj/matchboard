import type { TodayQuickActionCandidate, TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { rosterIncludesPlayer, type RosterProjection } from "../../shared/roster-projection";
import { didrik } from "./fixtures";

const BASE_REASON = "Eligible for a match-day addition — not subject to planned-selection RSVP or planning-boundary rules (ADR-0077).";

/**
 * Derived from the operational roster projection, not a static fixture constant — once a
 * resolved `SUCCESS` has added Didrik, this represents that already-applied authoritative result
 * on the OPERATIONAL roster specifically (never the planned-selection roster — see
 * `match-w3-fixture.ts`'s provenance separation), not a newly invented permission check.
 */
export function deriveCandidate(operationalRoster: RosterProjection): TodayQuickActionCandidate {
  const alreadyIncluded = rosterIncludesPlayer(operationalRoster, didrik.playerId);
  return {
    playerId: didrik.playerId,
    displayName: didrik.displayName,
    shirtNumber: didrik.shirtNumber,
    eligible: didrik.helperEligible && !alreadyIncluded,
    reasons: alreadyIncluded ? ["Already included in this match"] : [BASE_REASON],
  };
}

/** Predeclared — applies ONLY to the operational roster counter, never the planned-selection count. */
export const successOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "SUCCESS",
  revision: "operational-rev-2-didrik",
  result: { addedPlayerId: didrik.playerId },
};
