import "server-only";
import { db } from "@/lib/db";
import { getOpponentCombinationEvidence } from "@/lib/evidence/combination-aggregation";
import { getQualitativeEvidenceForOpponent } from "@/lib/evidence/qualitative-evidence-service";
import { toPairCombinationSummary } from "./combination-context";
import type {
  OpponentPattern,
  OpponentPatternConsistency,
  OpponentPatternRecency,
  OpponentPreparationContext,
  PairCombinationSummary,
  PreviousEncounterSummary,
  TrustedOpponentObservation,
} from "./types";

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
  opponentPatterns: [],
};

/** ADR-0152 §6 (bundle §3-4). `matches` is the same up-to-`MAX_PREVIOUS_ENCOUNTERS`,
 * newest-first previous-encounter list `buildOpponentContext` already resolved — no second
 * match query. Only the deterministic RECENT/MIXED_AGE/OLD threshold below is this codebase's
 * own choice (the bundle leaves it undefined); CONSISTENT/MIXED/SINGLE_OBSERVATION follows
 * bundle §4's rule exactly.
 */
const PHASE_LABELS: Record<string, string> = {
  GENERAL: "General play",
  BUILD_UP: "Build-up",
  PROGRESSION: "Progression",
  CHANCE_CREATION: "Chance creation",
  PRESSING: "Pressing",
  DEFENSIVE_SHAPE: "Defensive shape",
  DEFENSIVE_TRANSITION: "Defensive transition",
  ATTACKING_TRANSITION: "Attacking transition",
  SET_PLAYS: "Set plays",
};

const POLARITY_WORDS: Record<string, string> = {
  WORKING: "working well",
  PROBLEM: "a problem",
  NEUTRAL: "neutral",
  UNCERTAIN: "uncertain",
};

/** RECENT: the phase's evidence appears in the single most recent encounter (index 0) — still
 * current as of the last meeting, regardless of how far back its history also goes. OLD: it does
 * not appear in the most recent encounter, and there is only the one (older) data point — an
 * isolated, stale observation. MIXED_AGE: it does not appear in the most recent encounter, but
 * there is more than one data point — a longer-running pattern that simply wasn't tested (or
 * didn't recur) last time. */
function classifyRecency(encounterIndexesWithEvidence: number[]): OpponentPatternRecency {
  const newest = Math.min(...encounterIndexesWithEvidence);
  if (newest === 0) return "RECENT";
  return encounterIndexesWithEvidence.length > 1 ? "MIXED_AGE" : "OLD";
}

function classifyConsistency(polarityByMatchId: Map<string, string>): { consistency: OpponentPatternConsistency; dominantPolarity: string; dominantCount: number } {
  const totalMatches = polarityByMatchId.size;
  if (totalMatches === 1) {
    const [dominantPolarity] = polarityByMatchId.values();
    return { consistency: "SINGLE_OBSERVATION", dominantPolarity, dominantCount: 1 };
  }

  const matchCountByPolarity = new Map<string, number>();
  for (const polarity of polarityByMatchId.values()) {
    matchCountByPolarity.set(polarity, (matchCountByPolarity.get(polarity) ?? 0) + 1);
  }
  let dominantPolarity = "";
  let dominantCount = 0;
  for (const [polarity, count] of matchCountByPolarity) {
    if (count > dominantCount) {
      dominantPolarity = polarity;
      dominantCount = count;
    }
  }
  // Bundle §4: "CONSISTENT when the same high-level pattern appears in at least two encounters
  // and at least 60% of encounters with relevant phase evidence."
  const consistency: OpponentPatternConsistency = dominantCount >= 2 && dominantCount / totalMatches >= 0.6 ? "CONSISTENT" : "MIXED";
  return { consistency, dominantPolarity, dominantCount };
}

function buildOpponentPatternSummary(phase: string, consistency: OpponentPatternConsistency, dominantPolarity: string, dominantCount: number, totalMatches: number): string {
  const phaseLabel = PHASE_LABELS[phase] ?? phase;
  if (consistency === "SINGLE_OBSERVATION") return `${phaseLabel} has one recorded observation against this opponent.`;
  if (consistency === "MIXED") return `${phaseLabel} evidence is mixed across recorded meetings against this opponent.`;
  const polarityWord = POLARITY_WORDS[dominantPolarity] ?? dominantPolarity;
  return `${phaseLabel} described as ${polarityWord} in ${dominantCount} of ${totalMatches} recorded meetings against this opponent.`;
}

async function buildOpponentPatterns(
  teamId: string,
  opponentTeamId: string,
  organisationId: string,
  matches: { id: string }[],
): Promise<OpponentPattern[]> {
  const observations = await getQualitativeEvidenceForOpponent(teamId, opponentTeamId, organisationId, MAX_PREVIOUS_ENCOUNTERS);
  if (observations.length === 0) return [];

  const encounterIndexById = new Map(matches.map((m, index) => [m.id, index]));

  const byPhase = new Map<string, typeof observations>();
  for (const o of observations) {
    if (!o.matchId || !encounterIndexById.has(o.matchId)) continue;
    const list = byPhase.get(o.phase) ?? [];
    list.push(o);
    byPhase.set(o.phase, list);
  }

  const patterns: OpponentPattern[] = [];
  for (const [phase, phaseObservations] of byPhase) {
    // Most recent polarity per match wins (a phase's own observations across resubmits/multiple
    // debrief sources for the same match are collapsed to that match's own newest read).
    const sortedNewestFirst = [...phaseObservations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const polarityByMatchId = new Map<string, string>();
    for (const o of sortedNewestFirst) {
      if (!o.matchId || polarityByMatchId.has(o.matchId)) continue;
      polarityByMatchId.set(o.matchId, o.polarity);
    }

    const observedInMatchIds = [...polarityByMatchId.keys()];
    const encounterIndexes = observedInMatchIds.map((id) => encounterIndexById.get(id)!);
    const { consistency, dominantPolarity, dominantCount } = classifyConsistency(polarityByMatchId);

    patterns.push({
      phase,
      summary: buildOpponentPatternSummary(phase, consistency, dominantPolarity, dominantCount, observedInMatchIds.length),
      encounterCount: observedInMatchIds.length,
      observedInMatchIds,
      recency: classifyRecency(encounterIndexes),
      consistency,
    });
  }

  return patterns.sort((a, b) => b.encounterCount - a.encounterCount || a.phase.localeCompare(b.phase));
}

export async function buildOpponentContext(params: {
  teamId: string;
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

  const [sportingRows, observationRows, reportRows, combinationSummaries, opponentPatterns] = await Promise.all([
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
    buildOpponentPatterns(params.teamId, opponentTeamId, params.organisationId, matches),
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
    opponentPatterns,
  };
}
