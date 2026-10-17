import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import { b04MatchIdentity, b04Timeline, B04_KICKOFF_AT } from "../shared/match-b-fixture";
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
  fixtureSha256: "24612280a0e5c8721cb0a0d30a3994fddf977294183cd2736926f3e3a5718616",
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
      title: "Noah and Sindre have combined for 2 goals in the last 2 matches",
      observation: "Noah scored from a Sindre assist in the 8th minute, and Kasper assisted Noah's second in the 52nd — a real, recorded link, not a projection.",
      implication: "A pairing worth preserving in the next lineup.",
      subjectRefs: ["player-gb4-noah", "player-gb4-sindre", "player-gb4-kasper"],
      factRefs: ["fact-goal-combination-noah-sindre"],
      evidenceRefs: ["evt-gb4-goal-1", "evt-gb4-goal-2", "fact-goal-combination-noah-sindre"],
      confidence: "HIGH",
      source: "AI",
    },
  ],
};

export const whatThisMatchAddedInput: WhatThisMatchAddedInput = {
  hasNewObservations: true,
  observationCount: 2,
  hasNewOpponentEncounter: true,
  opponentName: matchIdentity.awayTeam,
  firstTimeCanonicalPositions: [{ playerId: "player-gb4-tobias", playerName: "Tobias", position: "RCM" }],
};

export const rawRecordsForHash = { matchIdentity, timeline, matchInsights, whatThisMatchAddedInput };
