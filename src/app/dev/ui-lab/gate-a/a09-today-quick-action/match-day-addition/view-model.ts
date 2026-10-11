import type { TodayQuickActionCandidate, TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { didrik } from "./fixtures";

export const candidate: TodayQuickActionCandidate = {
  playerId: didrik.playerId,
  displayName: didrik.displayName,
  shirtNumber: didrik.shirtNumber,
  eligible: didrik.helperEligible,
  reasons: ["Eligible for a match-day addition — not subject to planned-selection RSVP or planning-boundary rules (ADR-0077)."],
};

/** Predeclared — applies ONLY to the operational roster counter, never the planned-selection count. */
export const successOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "SUCCESS",
  revision: "operational-rev-2-didrik",
  result: { addedPlayerId: didrik.playerId },
};
