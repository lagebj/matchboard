import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import { b04MatchIdentity, b04Timeline, B04_KICKOFF_AT, b04FootballObservations, b04CombinationSourceRecords } from "../shared/match-b-fixture";
import type { WhatThisMatchAddedInput } from "@/lib/matches/completed-match-story";
import type { MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";

/**
 * B04 "Completed with richer evidence / Synthetic canonical fixture" (official Gate B register):
 * a meaningful recorded chronology that reconciles exactly with the final score (4-1, all 5
 * goal events individually logged), comparable measures, and an earned Match Insights finding
 * with source drilldown — never a forced chart panel, never possession/xG/shots/cards/ratings/
 * Player of the Match.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B04",
  fixtureId: "gate-b-w1-b04-completed-rich",
  fixtureVersion: 2,
  fixtureSha256: "6c6b599ed40d44c718f952c7f032230f7bf5f298b4e7442f5e816dad2f9f6faf",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B04_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b04MatchIdentity;
export const timeline = b04Timeline;

export const matchInsights: MatchInsightsViewModel = {
  status: "CURRENT",
  totalCount: 1,
  insights: [
    {
      id: "insight-gb4-1",
      category: "COMBINATION",
      relevance: "HIGH",
      title: "Noah and Sindre have combined for a goal in each of the last 2 matches",
      observation: "Sindre assisted Noah's 8th-minute goal in this match — the same pairing recorded in the prior match on 20 Sep 2026 against Krokstadelva IL.",
      implication: "A pairing worth preserving in the next lineup.",
      subjectRefs: ["player-gb4-noah", "player-gb4-sindre"],
      factRefs: ["fact-goal-combination-noah-sindre-2-matches"],
      evidenceRefs: ["evt-gb4-goal-1", "evt-gb4-prev-1-goal-1"],
      confidence: "HIGH",
      source: "AI",
    },
  ],
};

/**
 * B1-R6: `firstTimeCanonicalPositions` is deliberately empty. `b04Timeline`'s `ROTATION` item
 * (`evt-gb4-rotation-1`) names Tobias as `secondaryPlayerName` — per `MatchTimelineItem`'s own
 * type contract (`src/lib/matches/match-detail-view-model.ts`), that field is "the player coming
 * off," i.e. Tobias is recorded leaving the match at 40', not arriving at a new position. Even
 * read charitably, a rotation event carries no position field at all — it cannot establish which
 * position a player occupied, for how long, or whether it was a first occurrence. Building a real
 * positional-history evidence model (minutes, season boundary, prior appearances) is out of scope
 * for this fixture; `buildWhatThisMatchAddedRows()` (`src/lib/matches/completed-match-story.ts`)
 * already returns `[]` safely for an empty array — see
 * `shared/__tests__/match-b-fixture.test.ts` / this file's own tests for the regression coverage
 * that keeps this claim from being silently reintroduced without real backing.
 */
export const whatThisMatchAddedInput: WhatThisMatchAddedInput = {
  hasNewObservations: true,
  observationCount: b04FootballObservations.length,
  hasNewOpponentEncounter: true,
  opponentName: matchIdentity.awayTeam,
  firstTimeCanonicalPositions: [],
};

export const rawRecordsForHash = {
  matchIdentity,
  timeline,
  matchInsights,
  b04CombinationSourceRecords,
  b04FootballObservations,
  whatThisMatchAddedInput,
};
