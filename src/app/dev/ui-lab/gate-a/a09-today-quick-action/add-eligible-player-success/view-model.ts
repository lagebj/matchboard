import type { TodayQuickActionCandidate, TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { felix } from "./fixtures";

export const candidate: TodayQuickActionCandidate = {
  playerId: felix.playerId,
  displayName: felix.displayName,
  shirtNumber: felix.shirtNumber,
  eligible: true,
  reasons: ["Accepted availability for this match", "Not yet in the planned squad"],
};

/** Predeclared — never computed from a local permission algorithm. */
export const successOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "SUCCESS",
  revision: "roster-rev-2-felix",
  result: { addedPlayerId: felix.playerId },
};
