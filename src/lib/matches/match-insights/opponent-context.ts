import "server-only";
import { db } from "@/lib/db";
import { getOpponentCombinationEvidence } from "@/lib/evidence/combination-aggregation";
import { toPairCombinationSummary } from "./combination-context";
import type { OpponentPreparationContext, PairCombinationSummary, PreviousEncounterSummary, TrustedOpponentObservation } from "./types";

/**
 * Exact-opponent history (ADR-0149 Decision 3/4; bundle §8). "Exact opponent identity is a
 * first-class boundary" — every query here is scoped to `opponentTeamId`; nothing here ever
 * reads another opponent's evidence, and there is no name/reputation-based inference anywhere in
 * this module.
 *
 * ADR-0149 Decision 3's narrow, disclosed exception: `OpponentEncounterObservation.factualSummary`
 * and `PostMatchReport.teamNote`, for prior encounters with this exact opponent only, become
 * eligible input here — bounded, normalized, and carried as an explicitly attributed
 * `TrustedOpponentObservation`, never merged into a structured/objective field.
 * `sportingLevelNote` (an in-progress subjective note, not a settled post-encounter summary)
 * remains excluded, matching `match-prep.ts`'s existing doctrine for every other free-text field.
 */

const MAX_PREVIOUS_ENCOUNTERS = 5;
const TRUSTED_TEXT_MAX_LENGTH = 400;

function truncateTrustedText(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > TRUSTED_TEXT_MAX_LENGTH ? `${trimmed.slice(0, TRUSTED_TEXT_MAX_LENGTH - 1)}…` : trimmed;
}

function buildTrustedObservation(
  factualSummary: string | null | undefined,
  teamNote: string | null | undefined,
  encounterDate: Date,
): TrustedOpponentObservation | null {
  if (factualSummary && factualSummary.trim().length > 0) {
    return { text: truncateTrustedText(factualSummary), encounterDate, source: "OPPONENT_ENCOUNTER_SUMMARY" };
  }
  if (teamNote && teamNote.trim().length > 0) {
    return { text: truncateTrustedText(teamNote), encounterDate, source: "POST_MATCH_TEAM_NOTE" };
  }
  return null;
}

const EMPTY_CONTEXT: OpponentPreparationContext = {
  opponentTeamId: null,
  exactOpponentHistoryAvailable: false,
  previousEncounterCount: 0,
  previousEncounters: [],
  establishedCombinationsAgainstOpponent: [],
};

export async function buildOpponentContext(params: {
  opponentTeamId: string | null;
  organisationId: string;
  excludeMatchId: string;
}): Promise<OpponentPreparationContext> {
  if (!params.opponentTeamId) return EMPTY_CONTEXT;
  const opponentTeamId = params.opponentTeamId;

  const matches = await db.match.findMany({
    where: { opponentTeamId, organisationId: params.organisationId, id: { not: params.excludeMatchId } },
    orderBy: { startsAt: "desc" },
    take: MAX_PREVIOUS_ENCOUNTERS,
    select: { id: true, startsAt: true, formation: true },
  });

  if (matches.length === 0) {
    return { ...EMPTY_CONTEXT, opponentTeamId };
  }

  const matchIds = matches.map((m) => m.id);

  const [sportingRows, observationRows, reportRows, combinationSummaries] = await Promise.all([
    db.opponentSportingEvidence.findMany({
      where: { matchId: { in: matchIds }, excludedAt: null },
      select: { matchId: true, goalsFor: true, goalsAgainst: true },
    }),
    db.opponentEncounterObservation.findMany({
      where: { matchId: { in: matchIds } },
      select: {
        matchId: true,
        overallEnvironment: true,
        sportingLevel: true,
        playingStyleTags: true,
        concernCategories: true,
        factualSummary: true,
      },
    }),
    db.postMatchReport.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true, teamNote: true },
    }),
    getOpponentCombinationEvidence(opponentTeamId),
  ]);

  const sportingByMatch = new Map(sportingRows.map((r) => [r.matchId!, r]));
  const observationByMatch = new Map(observationRows.map((r) => [r.matchId, r]));
  const reportByMatch = new Map(reportRows.map((r) => [r.matchId, r]));

  const previousEncounters: PreviousEncounterSummary[] = matches.map((match) => {
    const sporting = sportingByMatch.get(match.id);
    const observation = observationByMatch.get(match.id);
    const report = reportByMatch.get(match.id);

    return {
      matchId: match.id,
      occurredAt: match.startsAt,
      goalsFor: sporting?.goalsFor ?? 0,
      goalsAgainst: sporting?.goalsAgainst ?? 0,
      formation: match.formation,
      overallEnvironment: observation ? String(observation.overallEnvironment) : null,
      sportingLevel: observation?.sportingLevel ? observation.sportingLevel.toString() : null,
      playingStyleTags: observation ? [...observation.playingStyleTags].map(String).sort() : [],
      concernCategories: observation ? [...observation.concernCategories].map(String).sort() : [],
      trustedObservation: buildTrustedObservation(observation?.factualSummary, report?.teamNote, match.startsAt),
    };
  });

  const establishedCombinationsAgainstOpponent: PairCombinationSummary[] = combinationSummaries
    .filter((s) => s.family === "PARTNERSHIP" && s.confidence !== "INSUFFICIENT")
    .map(toPairCombinationSummary)
    .filter((s): s is PairCombinationSummary => s !== null);

  return {
    opponentTeamId,
    exactOpponentHistoryAvailable: true,
    previousEncounterCount: previousEncounters.length,
    previousEncounters,
    establishedCombinationsAgainstOpponent,
  };
}
