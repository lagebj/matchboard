/**
 * The one evolving player-position model (Atlas Follow-up,
 * `07_EVOLVING_PLAYER_POSITION_MODEL.md`, ADR-0139). Pure and DB-free — the DB-bound orchestrator
 * lives in `sync-effective-position.ts`.
 *
 * Coach declaration and actual football evidence are inputs to ONE model, not two competing
 * truths (contract §1). This module never reads planned lineup, planned rotation, formation-slot
 * eligibility, exact-position suitability, or an automatic lineup recommendation — those sources
 * must never create position evidence (contract §6); callers only ever pass this module coach
 * declaration, actual completed-match usage, and explicit position observations.
 */

export type DeclaredPositions = {
  primary: string;
  secondary: string | null;
  tertiary: string | null;
};

/** One completed match's actual positional usage for one player. See `position-usage-history.ts`. */
export type MatchPositionEvidence = {
  matchKey: string;
  playedAt: Date;
  minutesByPosition: Record<string, number>;
};

/**
 * One explicit position observation signal, reusing the existing evidence engine's own
 * confidence/polarity semantics (`evaluatePositionEvidence()` in `position-experience.ts`) rather
 * than a second observation score (contract §5: "Use existing confidence/polarity semantics if
 * present... Do not create a second observation score in the UI layer").
 */
export type PositionObservationSignal = {
  positionCode: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  direction: "POSITIVE" | "NEGATIVE" | null;
};

export type SupportBand = "LIMITED" | "ESTABLISHED" | "STRONG" | "STRONGEST";
export type EvidenceConfidence = "LOW" | "MEDIUM" | "HIGH";

export type EffectivePlayerPosition = {
  positionId: string;
  rank: 1 | 2 | 3 | null;
  supportBand: SupportBand;
  confidence: EvidenceConfidence;
  sources: {
    coachDeclared: boolean;
    appearances: number;
    minutes: number | null;
    recentAppearances: number;
    lastPlayedAt: Date | null;
    observations: number;
  };
};

export type EffectivePlayerPositionProfile = {
  primary: string | null;
  secondary: string | null;
  tertiary: string | null;
  positions: EffectivePlayerPosition[];
  updatedAt: Date;
};

import {
  DECLARED_POSITION_SUPPORT,
  ACTUAL_USAGE_MAX_SUPPORT,
  OBSERVATION_SUPPORT_BONUS,
  SUPPORT_BAND_THRESHOLDS,
  CONFIDENCE_APPEARANCE_THRESHOLDS,
  POSITION_EVOLUTION_CONFIG,
} from "./position-evolution-config";

type RawPositionScore = {
  positionId: string;
  rawScore: number;
  appearances: number;
  minutes: number;
  lastPlayedAt: Date | null;
  observations: number;
  coachDeclared: boolean;
};

/**
 * Recency weight for the i-th most recent match in the window (i=0 is the most recent): 1.0
 * down to a floor just above 0 at the edge of the window. "Recent repeated usage matters more
 * than old isolated usage" (contract §8).
 */
function recencyWeight(i: number, windowSize: number): number {
  return Math.max(0, 1 - i / windowSize);
}

/**
 * Combines all evidence sources into one raw, internal support score per position. Not exposed
 * to any UI as a number (contract §10: "Do not expose internal opaque numeric scores unless they
 * are already coach-facing") — only the derived rank/supportBand/confidence are.
 */
function computeRawScores(
  declared: DeclaredPositions,
  windowedMatches: MatchPositionEvidence[],
  fullHistory: MatchPositionEvidence[],
  observations: PositionObservationSignal[],
): Map<string, RawPositionScore> {
  const scores = new Map<string, RawPositionScore>();

  function get(positionId: string): RawPositionScore {
    let entry = scores.get(positionId);
    if (!entry) {
      entry = { positionId, rawScore: 0, appearances: 0, minutes: 0, lastPlayedAt: null, observations: 0, coachDeclared: false };
      scores.set(positionId, entry);
    }
    return entry;
  }

  // Coach declaration — counts immediately, establishes initial support (contract §5).
  if (declared.primary) {
    const entry = get(declared.primary);
    entry.rawScore += DECLARED_POSITION_SUPPORT.primary;
    entry.coachDeclared = true;
  }
  if (declared.secondary) {
    const entry = get(declared.secondary);
    entry.rawScore += DECLARED_POSITION_SUPPORT.secondary;
    entry.coachDeclared = true;
  }
  if (declared.tertiary) {
    const entry = get(declared.tertiary);
    entry.rawScore += DECLARED_POSITION_SUPPORT.tertiary;
    entry.coachDeclared = true;
  }

  // Actual completed-match usage, recency-weighted within the window, normalized to a share of
  // total windowed weighted minutes, then scaled to the actual-usage support budget.
  const weightedMinutesByPosition = new Map<string, number>();
  let totalWeightedMinutes = 0;
  windowedMatches.forEach((match, i) => {
    const weight = recencyWeight(i, POSITION_EVOLUTION_CONFIG.recentMatchWindow);
    for (const [position, minutes] of Object.entries(match.minutesByPosition)) {
      if (minutes <= 0) continue;
      const weighted = minutes * weight;
      weightedMinutesByPosition.set(position, (weightedMinutesByPosition.get(position) ?? 0) + weighted);
      totalWeightedMinutes += weighted;
    }
  });

  if (totalWeightedMinutes > 0) {
    for (const [position, weighted] of weightedMinutesByPosition) {
      const entry = get(position);
      entry.rawScore += (weighted / totalWeightedMinutes) * ACTUAL_USAGE_MAX_SUPPORT;
    }
  }

  // Windowed appearance counts and windowed raw (non-recency-weighted) minutes, for
  // confidence/sources — computed from the same window as the score above.
  for (const match of windowedMatches) {
    for (const [position, minutes] of Object.entries(match.minutesByPosition)) {
      if (minutes <= 0) continue;
      const entry = get(position);
      entry.appearances += 1;
      entry.minutes += minutes;
    }
  }

  // lastPlayedAt uses the FULL history (not just the window) — a position last played long ago
  // should still show when it was last played, even once it has aged out of the scoring window.
  for (const match of fullHistory) {
    for (const [position, minutes] of Object.entries(match.minutesByPosition)) {
      if (minutes <= 0) continue;
      const entry = get(position);
      if (!entry.lastPlayedAt || match.playedAt > entry.lastPlayedAt) {
        entry.lastPlayedAt = match.playedAt;
      }
    }
  }

  // Explicit position observations — a small, capped bonus, never a penalty (contract's
  // guardrail philosophy: evidence can de-prioritise, never exclude or punish).
  for (const obs of observations) {
    const entry = get(obs.positionCode);
    entry.observations += 1;
    if (obs.confidence !== "LOW" && obs.direction === "POSITIVE") {
      entry.rawScore += OBSERVATION_SUPPORT_BONUS;
    }
  }

  return scores;
}

function bandForScore(rawScore: number): SupportBand {
  if (rawScore >= SUPPORT_BAND_THRESHOLDS.strongest) return "STRONGEST";
  if (rawScore >= SUPPORT_BAND_THRESHOLDS.strong) return "STRONG";
  if (rawScore >= SUPPORT_BAND_THRESHOLDS.established) return "ESTABLISHED";
  return "LIMITED";
}

function confidenceForAppearances(appearances: number): EvidenceConfidence {
  if (appearances >= CONFIDENCE_APPEARANCE_THRESHOLDS.high) return "HIGH";
  if (appearances >= CONFIDENCE_APPEARANCE_THRESHOLDS.medium) return "MEDIUM";
  return "LOW";
}

/**
 * Computes the current effective position profile: coach declaration and evidence blended into
 * one ranked, banded model. Uses the CURRENT `declared` triple for its coach-declaration
 * contribution — the stability/hysteresis discipline (contract §8) lives in
 * `determineAutomaticPositionUpdate()` below, which decides *when* `declared` itself should
 * change; once it has, this function's natural ranking reflects the update automatically on the
 * next read. No separate gating logic is duplicated here.
 */
export function computeEffectivePlayerPositionProfile(
  declared: DeclaredPositions,
  matchHistory: MatchPositionEvidence[],
  observations: PositionObservationSignal[] = [],
  now: Date = new Date(),
): EffectivePlayerPositionProfile {
  const sorted = [...matchHistory].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  const windowed = sorted.slice(0, POSITION_EVOLUTION_CONFIG.recentMatchWindow);

  const raw = computeRawScores(declared, windowed, sorted, observations);
  const ranked = [...raw.values()].filter((r) => r.rawScore > 0).sort((a, b) => b.rawScore - a.rawScore);

  const positions: EffectivePlayerPosition[] = ranked.map((entry, index) => ({
    positionId: entry.positionId,
    rank: index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : null,
    supportBand: bandForScore(entry.rawScore),
    confidence: confidenceForAppearances(entry.appearances),
    sources: {
      coachDeclared: entry.coachDeclared,
      appearances: entry.appearances,
      minutes: entry.minutes > 0 ? Math.round(entry.minutes) : null,
      recentAppearances: entry.appearances,
      lastPlayedAt: entry.lastPlayedAt,
      observations: entry.observations,
    },
  }));

  return {
    primary: positions[0]?.positionId ?? null,
    secondary: positions[1]?.positionId ?? null,
    tertiary: positions[2]?.positionId ?? null,
    positions,
    updatedAt: now,
  };
}

export type AutomaticPositionUpdateResult = {
  changed: boolean;
  newDeclared: DeclaredPositions | null;
  /** Human-readable reason for provenance (`DecisionRecord.reason`). Never player-identifying beyond the position codes themselves. */
  reason: string;
};

/**
 * Decides whether accumulated evidence should automatically promote a new primary position,
 * applying full hysteresis (contract §8): the candidate needs enough windowed appearances, a
 * clear margin over the current primary, and that margin must survive across two consecutive
 * evidence snapshots (this one, and the one immediately before it) — never a single match's
 * evidence. Manual coach edits reset this comparison for free: a manual edit changes `declared`
 * in the database, so the next run's "current primary" is already the manually-set value.
 *
 * Only ever changes secondary/tertiary alongside a primary promotion (never in isolation) — the
 * contract's explicit stability language is about primary specifically; secondary/tertiary simply
 * follow the natural current-window ranking once a promotion is warranted.
 */
export function determineAutomaticPositionUpdate(
  declared: DeclaredPositions,
  matchHistory: MatchPositionEvidence[],
  observations: PositionObservationSignal[] = [],
  now: Date = new Date(),
): AutomaticPositionUpdateResult {
  const sorted = [...matchHistory].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  const { recentMatchWindow, minAppearancesForAutomaticPromotion, promotionSupportMargin } = POSITION_EVOLUTION_CONFIG;

  const currentWindow = sorted.slice(0, recentMatchWindow);
  // "The one evidence update before this one": drop the single most recent match, then window again.
  const previousWindow = sorted.slice(1, 1 + recentMatchWindow);

  const currentProfile = computeEffectivePlayerPositionProfile(declared, currentWindow, observations, now);
  const currentScores = new Map(currentProfile.positions.map((p) => [p.positionId, p]));

  const naturalPrimary = currentProfile.primary;
  if (!naturalPrimary || naturalPrimary === declared.primary) {
    return { changed: false, newDeclared: null, reason: "No candidate exceeds the current primary." };
  }

  const candidateAppearances = currentScores.get(naturalPrimary)?.sources.recentAppearances ?? 0;
  if (candidateAppearances < minAppearancesForAutomaticPromotion) {
    return {
      changed: false,
      newDeclared: null,
      reason: `${naturalPrimary} has ${candidateAppearances} recent appearance(s), fewer than the ${minAppearancesForAutomaticPromotion} required for automatic promotion.`,
    };
  }

  // Recompute raw scores directly (not via the banded profile) to check the actual margin —
  // the profile's positions[] intentionally never expose a raw score, so we compute it once more
  // here, internally, for the gate check only.
  const currentRaw = computeRawScores(declared, currentWindow, sorted, observations);
  const previousRaw = computeRawScores(declared, previousWindow, sorted, observations);

  const currentMargin = (currentRaw.get(naturalPrimary)?.rawScore ?? 0) - (currentRaw.get(declared.primary)?.rawScore ?? 0);
  const previousMargin = (previousRaw.get(naturalPrimary)?.rawScore ?? 0) - (previousRaw.get(declared.primary)?.rawScore ?? 0);

  if (currentMargin < promotionSupportMargin || previousMargin < promotionSupportMargin) {
    return {
      changed: false,
      newDeclared: null,
      reason: `${naturalPrimary}'s lead over ${declared.primary} has not yet persisted across two evidence updates (current margin ${currentMargin.toFixed(2)}, previous ${previousMargin.toFixed(2)}, required ${promotionSupportMargin}).`,
    };
  }

  // Persisted, clear lead: promote. Secondary/tertiary follow the natural current-window ranking, excluding the new primary.
  const remaining = currentProfile.positions.filter((p) => p.positionId !== naturalPrimary);
  const newDeclared: DeclaredPositions = {
    primary: naturalPrimary,
    secondary: remaining[0]?.positionId ?? null,
    tertiary: remaining[1]?.positionId ?? null,
  };

  return {
    changed: true,
    newDeclared,
    reason: `${naturalPrimary} exceeded ${declared.primary} by ${currentMargin.toFixed(2)} (>= ${promotionSupportMargin}) across two consecutive evidence updates, with ${candidateAppearances} recent appearances.`,
  };
}
