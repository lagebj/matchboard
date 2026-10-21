import type { FixtureIdentity } from "../../../../gate-a/shared/fixture-identity";
import { b06LeagueBeforeIdentity, b06LeagueSquad, B06_LEAGUE_NOW, B06_LEAGUE_OPPONENT_NAME } from "../../../shared/match-b-fixture";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";

/**
 * B06 League · Before — planned, ready. Minimal real composition on purpose: `MatchIdentityCard`
 * and `MatchPreparationWidget` plus the real planning pitch are the structural pieces this wave
 * compares against Event; `MatchOpponentMemory`/`MatchInsights` are B01's own evidence-grammar
 * territory and are not re-demonstrated here (see SOURCE_RECONCILIATION.md).
 */
export const identity: FixtureIdentity = {
  scenarioId: "B06-LEAGUE-BEFORE",
  fixtureId: "gate-b-w3-b06-league-before",
  fixtureVersion: 1,
  fixtureSha256: "322b4e19e833d51c0517c175d6b8f727e0e7a0e442998af276f9ac255cfcf726",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B06_LEAGUE_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b06LeagueBeforeIdentity;
export const squad = b06LeagueSquad;
export const opponentName = B06_LEAGUE_OPPONENT_NAME;

export const preparationInput: MatchPreparationInput = {
  squadSelectedCount: 8,
  squadTarget: 8,
  hasLineup: true,
  hasPlannedRotation: true,
};

export const rawRecordsForHash = { matchIdentity, squad, preparationInput };
