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

/** Predeclared — the rejection arises at Confirm, after a genuine draft/preview. */
export const planningClosedOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "PLANNING_CLOSED",
  reason: "Planning closed when the match kicked off. Only a genuine reschedule before the actual start can reopen it.",
};
