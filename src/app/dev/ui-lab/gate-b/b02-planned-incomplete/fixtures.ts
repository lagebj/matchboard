import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import { b02MatchIdentity, b02Squad, B02_NOW } from "../shared/match-b-fixture";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";
import type { MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";

/**
 * B02 "Before match planned / Incomplete" (official Gate B register): honest missing readiness —
 * no invented checklist, no invented percentage. `preparationInput` below drives the real
 * `buildMatchPreparationDisplayItems()` (`src/lib/matches/match-detail-view-model.ts`), so the
 * "5/8 selected", "Lineup not set" wording is the production function's own output, not a new
 * number this candidate invents.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B02",
  fixtureId: "gate-b-w1-b02-planned-incomplete",
  fixtureVersion: 1,
  fixtureSha256: "a3da471e7419ae40398c53b7bbc272c89ee9aaa4bb81e34b6447e283d8712997",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B02_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b02MatchIdentity;
export const squad = b02Squad;

export const preparationInput: MatchPreparationInput = {
  squadSelectedCount: 5,
  squadTarget: 8,
  hasLineup: false,
  hasPlannedRotation: false,
};

/** No history with this opponent yet, and no plan-based insight has anything to rank — both
 * `MatchOpponentMemory`'s `null` return and `MatchInsights`'s `totalCount === 0` empty state are
 * the real components' own honest "nothing here" rendering, not a custom empty state this
 * candidate invents. */
export const opponentMemory = null;

export const matchInsights: MatchInsightsViewModel = {
  status: "CURRENT",
  totalCount: 0,
  insights: [],
};

export const rawRecordsForHash = { matchIdentity, squad, preparationInput, opponentMemory, matchInsights };
