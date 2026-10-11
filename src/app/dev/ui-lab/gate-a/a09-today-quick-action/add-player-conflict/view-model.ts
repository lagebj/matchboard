import type { TodayQuickActionCandidate, TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { felix } from "./fixtures";
import { MATCH_W3_ROSTER_REVISION, MATCH_W3_ROSTER_REVISION_CONCURRENT } from "../../shared/match-w3-fixture";

export const candidate: TodayQuickActionCandidate = {
  playerId: felix.playerId,
  displayName: felix.displayName,
  shirtNumber: felix.shirtNumber,
  eligible: true,
  reasons: ["Accepted availability for this match", "Not yet in the planned squad"],
};

/** Predeclared conflict — explicit expected/current revisions, no inferred diff. */
export const conflictOutcome: FixtureOperationOutcome<TodayQuickActionSuccess> = {
  kind: "CONFLICT",
  expectedRevision: MATCH_W3_ROSTER_REVISION,
  currentRevision: MATCH_W3_ROSTER_REVISION_CONCURRENT,
  currentSummary: "Felix was already added by another coach a moment ago.",
};
