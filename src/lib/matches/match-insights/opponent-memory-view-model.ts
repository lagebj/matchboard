/**
 * Opponent memory view-model (ADR-0157 §6 "Match Preparation convergence",
 * `05_MATCH_PREPARATION.md` "Opponent memory"). Pure presentation selection over the existing
 * `OpponentPreparationContext` (`opponent-context.ts`'s `buildOpponentContext()`) -- no new
 * query, no new pattern-derivation algorithm. `OpponentPattern.summary` is already a
 * deterministic templated sentence from that module; this file only decides which patterns/
 * encounters are worth showing in a compact block and builds short recency/consistency labels.
 */

import type { OpponentPattern, OpponentPreparationContext, PreviousEncounterSummary } from "./types";

const MAX_RECENT_ENCOUNTERS = 3;
const MAX_PATTERNS = 2;

export type OpponentMemoryEncounterItem = {
  matchId: string;
  occurredAt: Date;
  resultLabel: string;
};

export type OpponentMemoryPatternItem = {
  summary: string;
  qualifier: string;
};

export type OpponentMemoryViewModel = {
  hasHistory: boolean;
  recentEncounters: OpponentMemoryEncounterItem[];
  patterns: OpponentMemoryPatternItem[];
};

function resultLabel(encounter: PreviousEncounterSummary): string {
  if (encounter.goalsFor > encounter.goalsAgainst) return `Won ${encounter.goalsFor}-${encounter.goalsAgainst}`;
  if (encounter.goalsFor < encounter.goalsAgainst) return `Lost ${encounter.goalsFor}-${encounter.goalsAgainst}`;
  return `Drew ${encounter.goalsFor}-${encounter.goalsAgainst}`;
}

const RECENCY_LABELS: Record<OpponentPattern["recency"], string> = {
  RECENT: "seen in the most recent meeting",
  MIXED_AGE: "seen across several meetings",
  OLD: "not seen in the most recent meeting",
};

const CONSISTENCY_LABELS: Record<OpponentPattern["consistency"], string> = {
  CONSISTENT: "Consistent",
  MIXED: "Mixed",
  SINGLE_OBSERVATION: "Single observation",
};

function buildQualifier(pattern: OpponentPattern): string {
  return `${CONSISTENCY_LABELS[pattern.consistency]} · ${RECENCY_LABELS[pattern.recency]}`;
}

/**
 * §05 "Display" rules: up to three recent encounters, one or two recurring patterns "when
 * evidence maturity permits" (a `SINGLE_OBSERVATION` is one data point, not yet a recurring
 * pattern -- excluded here, not merely de-prioritized), a recency/consistency qualifier per
 * pattern. Never infers opponent traits beyond what this exact-opponent evidence already states.
 */
export function buildOpponentMemoryViewModel(context: OpponentPreparationContext): OpponentMemoryViewModel {
  if (!context.exactOpponentHistoryAvailable || context.previousEncounters.length === 0) {
    return { hasHistory: false, recentEncounters: [], patterns: [] };
  }

  const recentEncounters = context.previousEncounters.slice(0, MAX_RECENT_ENCOUNTERS).map((e) => ({
    matchId: e.matchId,
    occurredAt: e.occurredAt,
    resultLabel: resultLabel(e),
  }));

  const patterns = context.opponentPatterns
    .filter((p) => p.consistency !== "SINGLE_OBSERVATION")
    .sort((a, b) => (a.consistency === b.consistency ? b.encounterCount - a.encounterCount : a.consistency === "CONSISTENT" ? -1 : 1))
    .slice(0, MAX_PATTERNS)
    .map((p) => ({ summary: p.summary, qualifier: buildQualifier(p) }));

  return { hasHistory: true, recentEncounters, patterns };
}
