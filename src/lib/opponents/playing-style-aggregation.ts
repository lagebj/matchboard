import type { OpponentPlayingStyleTag } from "@/generated/prisma/client";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";

/**
 * Evidence-Informed Match Planning programme, Bundle 2: aggregates the coach-captured
 * `OpponentEncounterObservation.playingStyleTags` (per-match, structured tactical fact —
 * ADR see `docs/adr/`) into a confidence-bound tactical tendency per opponent. Extends the
 * smallest existing capture owner (`playing-style-tags.ts`) rather than inventing a new
 * observation model (PROGRAMME.md D-017: "Detailed opponent style requires actual capture").
 *
 * Reuses the shared `ConfidenceLevel` vocabulary (`combination-topology.ts`) rather than
 * `sporting-level-aggregation.ts`'s separate unknown/low/medium/high scale — estimated sporting
 * level and opponent tactical tendency are deliberately different evidence (D-016) and are not
 * required to share a confidence vocabulary; this one matches PROGRAMME.md's explicit ask
 * ("insufficient; emerging; established") for pattern-style evidence.
 *
 * League-only for now: `OpponentEncounterObservation` has no Event-match equivalent yet
 * (AGENTS.md "Canonical post-match learning pipeline": Event keeps only a free-text
 * `opponentObservation` field). Generalizing that capture model is a separate, larger decision
 * this bundle does not make speculatively.
 */

export type OpponentTacticalTendency = {
  opponentTeamId: string;
  tag: OpponentPlayingStyleTag;
  occurrences: number;
  confidence: ConfidenceLevel;
  firstObservedAt: Date;
  lastObservedAt: Date;
  /** Team-level fact only (match ids) — no player identity, safe under coach-facing scope. */
  sourceMatchIds: string[];
};

export type TacticalObservationInput = {
  matchId: string;
  occurredAt: Date;
  playingStyleTags: OpponentPlayingStyleTag[];
};

/**
 * A tag observed 12+ months ago is stale enough that it should not influence a current
 * tendency read — mirrors `sporting-level-aggregation.ts`'s WINDOW_MONTHS for opponent
 * strength, kept as a hard cutoff (not a smooth recency decay) since tactical tendencies are
 * presented as discrete confidence tiers, not a continuous score (TEST-MATRIX.md §17).
 */
export const TACTICAL_EVIDENCE_WINDOW_MONTHS = 12;
const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

/**
 * Thresholds are deliberately small: a youth-club opponent might only be played 1-4 times a
 * season. Matches PROGRAMME.md's "one observation is insufficient for strong advice;
 * confidence grows only from explicit observations" (TEST-MATRIX.md §14).
 */
const CONFIDENCE_THRESHOLDS = { EMERGING: 2, ESTABLISHED: 4 } as const;

export function classifyTacticalConfidence(occurrences: number): ConfidenceLevel {
  if (occurrences >= CONFIDENCE_THRESHOLDS.ESTABLISHED) return "ESTABLISHED";
  if (occurrences >= CONFIDENCE_THRESHOLDS.EMERGING) return "EMERGING";
  return "INSUFFICIENT";
}

/**
 * Pure aggregation — no I/O, so it is unit-testable without a database. The caller
 * (`playing-style-query.ts`) is responsible for scoping `observations` to one opponent team.
 */
export function aggregatePlayingStyleTendencies(
  opponentTeamId: string,
  observations: TacticalObservationInput[],
  referenceDate: Date = new Date(),
): OpponentTacticalTendency[] {
  const windowMs = TACTICAL_EVIDENCE_WINDOW_MONTHS * MS_PER_MONTH;
  const withinWindow = observations.filter(
    (o) => referenceDate.getTime() - o.occurredAt.getTime() <= windowMs,
  );

  const byTag = new Map<OpponentPlayingStyleTag, { matchIds: string[]; first: Date; last: Date }>();
  for (const obs of withinWindow) {
    for (const tag of obs.playingStyleTags) {
      const existing = byTag.get(tag);
      if (existing) {
        existing.matchIds.push(obs.matchId);
        if (obs.occurredAt < existing.first) existing.first = obs.occurredAt;
        if (obs.occurredAt > existing.last) existing.last = obs.occurredAt;
      } else {
        byTag.set(tag, { matchIds: [obs.matchId], first: obs.occurredAt, last: obs.occurredAt });
      }
    }
  }

  const tendencies: OpponentTacticalTendency[] = [];
  for (const [tag, data] of byTag) {
    tendencies.push({
      opponentTeamId,
      tag,
      occurrences: data.matchIds.length,
      confidence: classifyTacticalConfidence(data.matchIds.length),
      firstObservedAt: data.first,
      lastObservedAt: data.last,
      sourceMatchIds: data.matchIds,
    });
  }

  return tendencies.sort((a, b) => b.occurrences - a.occurrences);
}

export type OpponentTendencyOutcome = {
  tag: OpponentPlayingStyleTag;
  matchCount: number;
  goalsFor: number;
  goalsAgainst: number;
};

/**
 * "Our response to opponent tendencies" (PROGRAMME.md): factual outcomes across the matches
 * that produced a given tendency, without any causal claim ("goals for/against while this
 * tendency was observed", never "because of this tendency"). Insufficient-confidence tendencies
 * are excluded — one observation is not enough evidence to describe a repeated response
 * (mirrors `selectRelevantPartnerships()`'s same INSUFFICIENT exclusion in
 * `combination-aggregation.ts`).
 */
export function deriveOpponentTendencyOutcomes(
  tendencies: OpponentTacticalTendency[],
  outcomesByMatchId: Map<string, { goalsFor: number; goalsAgainst: number }>,
): OpponentTendencyOutcome[] {
  const outcomes: OpponentTendencyOutcome[] = [];

  for (const tendency of tendencies) {
    if (tendency.confidence === "INSUFFICIENT") continue;

    let matchCount = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const matchId of tendency.sourceMatchIds) {
      const outcome = outcomesByMatchId.get(matchId);
      if (!outcome) continue;
      matchCount += 1;
      goalsFor += outcome.goalsFor;
      goalsAgainst += outcome.goalsAgainst;
    }

    if (matchCount > 0) {
      outcomes.push({ tag: tendency.tag, matchCount, goalsFor, goalsAgainst });
    }
  }

  return outcomes;
}
