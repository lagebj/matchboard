import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import { b04MatchIdentity, b04Timeline, B04_KICKOFF_AT, b04FootballObservations } from "../shared/match-b-fixture";
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
  fixtureVersion: 1,
  fixtureSha256: "6317d9ebeed907f537217bd9b71048964bec919a5401030df827621613eb7de0",
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

export const whatThisMatchAddedInput: WhatThisMatchAddedInput = {
  hasNewObservations: true,
  observationCount: b04FootballObservations.length,
  hasNewOpponentEncounter: true,
  opponentName: matchIdentity.awayTeam,
  firstTimeCanonicalPositions: [{ playerId: "player-gb4-tobias", playerName: "Tobias", position: "RCM" }],
};

export const rawRecordsForHash = { matchIdentity, timeline, matchInsights, whatThisMatchAddedInput, b04FootballObservations };
