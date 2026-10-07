import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import { buildOpponentMemoryViewModel } from "@/lib/matches/match-insights/opponent-memory-view-model";
import type { OpponentPreparationContext } from "@/lib/matches/match-insights/types";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";

/**
 * ADR-0157 C9 golden-state fixture data — Match Preparation (`05_MATCH_PREPARATION.md`).
 * Deterministic, in-memory only; opponent memory renders through the real
 * `buildOpponentMemoryViewModel()` gate (exact recorded evidence only — no inferred traits).
 */

const opponentContext: OpponentPreparationContext = {
  opponentTeamId: "opp-saetre",
  exactOpponentHistoryAvailable: true,
  previousEncounterCount: 3,
  previousEncounters: [
    {
      matchId: "m-2026-spring-1",
      occurredAt: new Date("2026-04-18T00:00:00Z"),
      goalsFor: 2,
      goalsAgainst: 1,
      formation: null,
      overallEnvironment: null,
      sportingLevel: null,
      playingStyleTags: [],
      concernCategories: [],
      trustedObservation: null,
    },
    {
      matchId: "m-2026-spring-2",
      occurredAt: new Date("2026-05-30T00:00:00Z"),
      goalsFor: 1,
      goalsAgainst: 3,
      formation: null,
      overallEnvironment: null,
      sportingLevel: null,
      playingStyleTags: [],
      concernCategories: [],
      trustedObservation: null,
    },
    {
      matchId: "m-2026-fall-1",
      occurredAt: new Date("2026-09-12T00:00:00Z"),
      goalsFor: 4,
      goalsAgainst: 2,
      formation: null,
      overallEnvironment: null,
      sportingLevel: null,
      playingStyleTags: [],
      concernCategories: [],
      trustedObservation: null,
    },
  ],
  establishedCombinationsAgainstOpponent: [],
  opponentPatterns: [
    {
      phase: "Opening",
      summary: "Fast starts recorded in 2 of 3 meetings — early pressing described as a problem.",
      encounterCount: 3,
      observedInMatchIds: ["m-2026-spring-2", "m-2026-fall-1"],
      recency: "RECENT",
      consistency: "CONSISTENT",
    },
  ],
};

export const matchPrepFixture = {
  presentation: buildMatchPresentation({
    id: "match-prep-1",
    href: null,
    teamName: "Rød",
    opponentName: "Sætre Lions",
    isHome: true,
    kickoffAt: new Date(Date.now() + 3 * 24 * 3_600_000 + 17 * 3_600_000),
    lifecycleStatus: "planning_open",
  }),
  ownKitColor: "#d62828",
  venue: "HOME",
  matchType: "LEAGUE",
  gameFormat: "SEVEN_A_SIDE",
  matchFit: "GREEN",
  teamName: "Rød",
  preparationInput: {
    squadSelectedCount: 10,
    squadTarget: 10,
    hasLineup: true,
    hasPlannedRotation: true,
  } satisfies MatchPreparationInput,
  opponentMemory: buildOpponentMemoryViewModel(opponentContext),
  opponentEncounterCount: opponentContext.previousEncounterCount,
  opponentHasProfile: true,
};