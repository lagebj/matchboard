import type { TodayQuickActionCandidate, TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { rosterIncludesPlayer, type RosterProjection } from "../../shared/roster-projection";
import { felix } from "./fixtures";

const BASE_REASONS = ["Accepted availability for this match", "Not yet in the planned squad"];

/**
 * The candidate's eligibility/reasons are derived from the current authoritative roster
 * projection, not a static fixture constant — once a resolved `SUCCESS` has added Felix, this
 * represents that already-applied authoritative result (`"Already included in this match"`), not
 * a newly invented permission check. Re-deriving on every render means a close/reopen can never
 * show a stale "still eligible" state for a candidate who was already added.
 */
export function deriveCandidate(roster: RosterProjection): TodayQuickActionCandidate {
  const alreadyIncluded = rosterIncludesPlayer(roster, felix.playerId);
  return {
    playerId: felix.playerId,
    displayName: felix.displayName,
    shirtNumber: felix.shirtNumber,
    eligible: !alreadyIncluded,
    reasons: alreadyIncluded ? ["Already included in this match"] : BASE_REASONS,
  };
}

/** Predeclared — never computed from a local permission algorithm. */
export const successOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "SUCCESS",
  revision: "roster-rev-2-felix",
  result: { addedPlayerId: felix.playerId },
};
