import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import { b03MatchIdentity, b03Timeline, B03_KICKOFF_AT } from "../shared/match-b-fixture";
import type { WhatThisMatchAddedInput } from "@/lib/matches/completed-match-story";

/**
 * B03 "Completed with sparse events / 6-4 / one recorded event" (official Gate B register):
 * the final result (6-4) is kept visibly separate from the partial recorded chronology (1 event)
 * — ADR-0147 §5/ADR-0157 C6: a real annotation event's `correctsEventId` can only pair an assist
 * to a goal via persisted canonical live-event linkage, and the schema has no `Goal.assistId`/
 * `Assist.goalId` column, so a report-fallback goal like this one is never paired to an assist by
 * construction, not by omission.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B03",
  fixtureId: "gate-b-w1-b03-completed-sparse",
  fixtureVersion: 1,
  fixtureSha256: "5a5c6aecf63c670021688db7a26c45da67715072f378bfefa499a5a59d72e91b",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B03_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b03MatchIdentity;
export const timeline = b03Timeline;

/** Nothing genuinely new was added by this sparsely-recorded match — the real
 * `buildWhatThisMatchAddedRows()` returns `[]` for this input, and `WhatThisMatchAddedPanel`
 * renders nothing at all rather than a padded, empty-looking section. */
export const whatThisMatchAddedInput: WhatThisMatchAddedInput = {
  hasNewObservations: false,
  observationCount: 0,
  hasNewOpponentEncounter: false,
  opponentName: null,
  firstTimeCanonicalPositions: [],
};

export const rawRecordsForHash = { matchIdentity, timeline, whatThisMatchAddedInput };
