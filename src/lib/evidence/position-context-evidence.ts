import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";
import { classifyMatchPhaseConfidence } from "@/lib/evidence/match-phase-pattern-evidence";
import { getActualPositionIntervalsForRef, type ActualIntervalRow } from "@/lib/evidence/actual-timeline";
import { getGoalAttributionEventsForRef, type GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import { getSeasonCombinationEvidence, aggregateSeasonCombinations, type SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import { capEvidenceBonus, isEvidenceConfidentEnoughToInfluence } from "@/lib/policies/evidence-guardrails";

/**
 * Position-context outcome evidence addendum to the Evidence-Informed Match Planning programme.
 *
 * Answers: "what has historically happened while THIS player occupied THIS outfield position,
 * compared to the team's other recorded exposure at that same position?" — using only actual
 * match evidence (`ActualPositionInterval`, the canonical source Bundle 1 established), never
 * planned lineup, planned rotation, or declared Primary/Secondary/Tertiary position.
 *
 * This is contextual evidence, not a player-quality judgement. Language throughout this module —
 * types, exported names, generated text — is deliberately neutral: `outcomeDifference` is
 * `MORE_FAVORABLE` / `SIMILAR` / `LESS_FAVORABLE`, never "good"/"bad"/"weak"/"strong". See
 * AGENTS.md's "Position-context evidence" section for the full language rule and rationale.
 *
 * Team-season scoped, League-only (matches `match-phase-pattern-evidence.ts`'s Bundle 2 D-003
 * scope decision exactly, for the same reason: a League team is primarily a team-season
 * instance; a group-longitudinal variant is a deliberate, disclosed deferral, not an oversight).
 * Derived on read, nothing persisted (D-002) — a future `replayPostMatchLearningHistory()` run
 * only ever needs to rebuild the underlying `ActualPositionInterval`/goal-attribution facts this
 * module reads; there is no separate aggregate to rebuild here.
 *
 * Baseline: "same team-season at the same position, other players" (the one baseline required by
 * the addendum's own worked example). The addendum names other possible baselines (same player at
 * other positions, group-level evidence) as options where sufficient evidence exists — this
 * module implements the one baseline that generalises to every position/player pair without
 * requiring a second query shape; the others are a disclosed, deliberate scope decision for a
 * later pass, matching this programme's established practice of scoping one bundle at a time.
 */

export type PositionContextOutcomeDifference = "MORE_FAVORABLE" | "SIMILAR" | "LESS_FAVORABLE";

export type PositionContextBucket = {
  matches: number;
  exposureMinutes: number;
  goalsFor: number;
  goalsAgainst: number;
  confidence: ConfidenceLevel;
};

export type PlayerPositionContextEvidence = {
  playerId: string;
  position: string;
  /** null when the player has zero recorded exposure at this position. */
  player: PositionContextBucket | null;
  /** null when no other player has recorded exposure at this position this team-season. */
  baseline: PositionContextBucket | null;
  /** null unless BOTH player and baseline evidence clear INSUFFICIENT confidence — an
   * outcome comparison is never drawn from a thin sample on either side. */
  outcomeDifference: PositionContextOutcomeDifference | null;
  /**
   * A broader structural explanation for the pattern, surfaced ahead of individual attribution
   * (the addendum's "attribution hierarchy") — currently: a recurring teammate combination that
   * accounts for most of the player's own exposure at this position, reusing the existing
   * season combination-evidence engine rather than a new causal-inference mechanism. null when no
   * such explanation is available; this is never fabricated.
   */
  structuralNote: string | null;
  /** Factual, neutral coach-facing sentence(s). Empty when there is nothing to say yet. */
  explanation: string;
};

type PositionContextSample = {
  intervals: ActualIntervalRow[];
  goalEvents: GoalAttributionEvent[];
};

function emptyBucket(): { matches: number; exposureMinutes: number; goalsFor: number; goalsAgainst: number; matchIds: Set<string> } {
  return { matches: 0, exposureMinutes: 0, goalsFor: 0, goalsAgainst: 0, matchIds: new Set() };
}

function toBucket(raw: ReturnType<typeof emptyBucket>): PositionContextBucket | null {
  if (raw.matchIds.size === 0) return null;
  return {
    matches: raw.matchIds.size,
    exposureMinutes: Math.round(raw.exposureMinutes * 10) / 10,
    goalsFor: raw.goalsFor,
    goalsAgainst: raw.goalsAgainst,
    confidence: classifyMatchPhaseConfidence(raw.matchIds.size),
  };
}

/**
 * A meaningful net-goal-rate differential, expressed per 90 minutes of exposure so the threshold
 * reads in football terms rather than an opaque per-millisecond fraction. Half a goal per 90
 * minutes is a deliberately modest bar at youth-league scale — documented here, not hidden.
 */
const OUTCOME_DIFFERENCE_THRESHOLD_PER_90 = 0.5;

function netRatePer90(bucket: PositionContextBucket): number | null {
  if (bucket.exposureMinutes <= 0) return null;
  return ((bucket.goalsFor - bucket.goalsAgainst) / bucket.exposureMinutes) * 90;
}

function classifyOutcomeDifference(
  player: PositionContextBucket | null,
  baseline: PositionContextBucket | null,
): PositionContextOutcomeDifference | null {
  if (!player || !baseline) return null;
  if (player.confidence === "INSUFFICIENT" || baseline.confidence === "INSUFFICIENT") return null;

  const playerRate = netRatePer90(player);
  const baselineRate = netRatePer90(baseline);
  if (playerRate === null || baselineRate === null) return null;

  const diff = playerRate - baselineRate;
  if (diff > OUTCOME_DIFFERENCE_THRESHOLD_PER_90) return "MORE_FAVORABLE";
  if (diff < -OUTCOME_DIFFERENCE_THRESHOLD_PER_90) return "LESS_FAVORABLE";
  return "SIMILAR";
}

const OUTCOME_DIFFERENCE_PHRASE: Record<PositionContextOutcomeDifference, string> = {
  MORE_FAVORABLE: "more favorable outcomes than",
  SIMILAR: "similar outcomes to",
  LESS_FAVORABLE: "less favorable outcomes than",
};

const CONFIDENCE_PHRASE: Record<ConfidenceLevel, string> = {
  INSUFFICIENT: "insufficient evidence",
  EMERGING: "an emerging pattern",
  ESTABLISHED: "an established pattern",
};

function buildExplanation(
  position: string,
  player: PositionContextBucket | null,
  outcomeDifference: PositionContextOutcomeDifference | null,
  structuralNote: string | null,
): string {
  if (!player || player.confidence === "INSUFFICIENT") return "";

  const sentences: string[] = [
    `${player.exposureMinutes} recorded minutes at ${position} across ${player.matches} match${player.matches === 1 ? "" : "es"} (${CONFIDENCE_PHRASE[player.confidence]}).`,
  ];

  if (outcomeDifference) {
    sentences.push(
      `Recorded outcomes during those intervals were ${OUTCOME_DIFFERENCE_PHRASE[outcomeDifference]} the team's other recorded ${position} intervals this season.`,
    );
  }

  if (structuralNote) sentences.push(structuralNote);

  return sentences.join(" ");
}

/**
 * Pure aggregation — no I/O, unit-testable without a database. Mirrors
 * `aggregateMatchPhasePatterns`'s structure: one bucket for the target player's own exposure at
 * `position`, one baseline bucket for every OTHER player's exposure at the same position across
 * the same samples (team-season).
 */
export function aggregatePositionContextEvidence(
  samples: PositionContextSample[],
  targetPlayerId: string,
  position: string,
  matchIdBySampleIndex: string[],
): { player: PositionContextBucket | null; baseline: PositionContextBucket | null } {
  const playerRaw = emptyBucket();
  const baselineRaw = emptyBucket();

  samples.forEach((sample, index) => {
    const matchId = matchIdBySampleIndex[index] ?? String(index);

    for (const interval of sample.intervals) {
      if (interval.position !== position) continue;
      const durationMs = (interval.endedAtMs ?? interval.startedAtMs) - interval.startedAtMs;
      if (durationMs <= 0) continue;

      const raw = interval.playerId === targetPlayerId ? playerRaw : baselineRaw;
      raw.exposureMinutes += durationMs / 60000;
      raw.matchIds.add(matchId);

      for (const goal of sample.goalEvents) {
        if (goal.matchMs < interval.startedAtMs || goal.matchMs >= (interval.endedAtMs ?? interval.startedAtMs)) continue;
        if (goal.team === "FOR") raw.goalsFor += 1;
        else raw.goalsAgainst += 1;
      }
    }
  });

  return { player: toBucket(playerRaw), baseline: toBucket(baselineRaw) };
}

/**
 * Loads the shared per-match samples for one League team's season once — every (player,
 * position) pair the caller needs is then evaluated against this same in-memory data, rather
 * than re-querying per pair. Bench-candidate scoring (Bundle 7/8) can need dozens of pairs per
 * generation run; re-running the completed-match/interval/goal queries for each pair would be a
 * real N+1 query problem this batching avoids.
 */
async function loadTeamSeasonSamples(
  leagueSeasonId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<{ samples: PositionContextSample[]; matchIds: string[] }> {
  if (orgFilter.type !== "org") return { samples: [], matchIds: [] };

  const matches = await db.match.findMany({
    where: { teamId, matchRound: { leagueSeasonId }, status: "SCHEDULED", ...orgFilter.filter },
    select: { id: true },
  });
  if (matches.length === 0) return { samples: [], matchIds: [] };

  const matchIds = matches.map((m) => m.id);
  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matchIds }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true },
  });
  const completedMatchIds = matches.filter((m) => reports.some((r) => r.matchId === m.id)).map((m) => m.id);
  if (completedMatchIds.length === 0) return { samples: [], matchIds: [] };

  const samples: PositionContextSample[] = [];
  for (const matchId of completedMatchIds) {
    const [intervals, goalEvents] = await Promise.all([
      getActualPositionIntervalsForRef({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId }),
      getGoalAttributionEventsForRef({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId }),
    ]);
    samples.push({ intervals, goalEvents });
  }

  return { samples, matchIds: completedMatchIds };
}

function buildEvidenceFromSamples(
  samples: PositionContextSample[],
  matchIds: string[],
  playerId: string,
  position: string,
): { player: PositionContextBucket | null; baseline: PositionContextBucket | null; outcomeDifference: PositionContextOutcomeDifference | null } {
  const { player, baseline } = aggregatePositionContextEvidence(samples, playerId, position, matchIds);
  return { player, baseline, outcomeDifference: classifyOutcomeDifference(player, baseline) };
}

/**
 * DB-bound loader for one (player, position) pair within one League team's season. Reuses the
 * exact canonical facts Bundle 1/2 already established (`ActualPositionInterval` via
 * `getActualPositionIntervalsForRef`, goal attribution via `getGoalAttributionEventsForRef`) —
 * this module owns no persistence and no separate query shape for those facts.
 *
 * Prefer `getTeamPositionContextEvidenceForPairs()` when evaluating more than one pair for the
 * same team/season (e.g. a whole bench against a whole formation) — it shares the underlying
 * match query instead of repeating it per pair.
 */
export async function getPlayerPositionContextEvidence(
  leagueSeasonId: string,
  teamId: string,
  playerId: string,
  position: string,
  orgFilter: OrgFilterMode,
): Promise<PlayerPositionContextEvidence> {
  const results = await getTeamPositionContextEvidenceForPairs(leagueSeasonId, teamId, [{ playerId, position }], orgFilter);
  return (
    results[0] ?? {
      playerId,
      position,
      player: null,
      baseline: null,
      outcomeDifference: null,
      structuralNote: null,
      explanation: "",
    }
  );
}

/**
 * Batch form: evaluates many (playerId, position) pairs for one League team's season against one
 * shared set of loaded matches/intervals/goals. See `getPlayerPositionContextEvidence`'s doc for
 * what this reuses from Bundle 1/2. Duplicate pairs are only computed once.
 */
export async function getTeamPositionContextEvidenceForPairs(
  leagueSeasonId: string,
  teamId: string,
  pairs: Array<{ playerId: string; position: string }>,
  orgFilter: OrgFilterMode,
): Promise<PlayerPositionContextEvidence[]> {
  const uniquePairs = new Map(pairs.map((p) => [`${p.playerId}:${p.position}`, p]));
  if (uniquePairs.size === 0) return [];

  const { samples, matchIds } = await loadTeamSeasonSamples(leagueSeasonId, teamId, orgFilter);

  const results: PlayerPositionContextEvidence[] = [];
  for (const { playerId, position } of uniquePairs.values()) {
    if (samples.length === 0) {
      results.push({ playerId, position, player: null, baseline: null, outcomeDifference: null, structuralNote: null, explanation: "" });
      continue;
    }

    const { player, baseline, outcomeDifference } = buildEvidenceFromSamples(samples, matchIds, playerId, position);

    let structuralNote: string | null = null;
    if (outcomeDifference && outcomeDifference !== "SIMILAR") {
      structuralNote = await buildStructuralNote(leagueSeasonId, playerId, orgFilter);
    }

    results.push({
      playerId,
      position,
      player,
      baseline,
      outcomeDifference,
      structuralNote,
      explanation: buildExplanation(position, player, outcomeDifference, structuralNote),
    });
  }

  return results;
}

export const MAX_POSITION_CONTEXT_BONUS = 5;

/**
 * Automation integration (Evidence-Informed Match Planning addendum). A small, capped,
 * confidence-gated bonus toward a candidate's score for a role -- reused by both the rotation
 * generator (Bundle 7) and the integrated starting-line-up generator (Bundle 8), the same way
 * `computeOpponentFunctionBonus` already is. Comes after role suitability in both callers'
 * existing precedence order. Only ever a bonus, never a penalty: `MORE_FAVORABLE` evidence adds
 * up to `MAX_POSITION_CONTEXT_BONUS`; `SIMILAR`, `LESS_FAVORABLE`, or unknown/insufficient
 * evidence all contribute 0 -- "is there another reasonable role that gives this player
 * meaningful opportunity", never "should this player receive less opportunity" (AGENTS.md
 * "Position-context evidence"). Guarded further by `assertEvidenceDidNotExcludeCandidates()` at
 * each caller's own scoring step, exactly like every other evidence-informed signal.
 */
export function computePositionContextBonus(evidence: PlayerPositionContextEvidence | undefined): number {
  if (!evidence || evidence.outcomeDifference !== "MORE_FAVORABLE") return 0;
  if (!evidence.player || !isEvidenceConfidentEnoughToInfluence(evidence.player.confidence)) return 0;
  const raw = evidence.player.confidence === "ESTABLISHED" ? MAX_POSITION_CONTEXT_BONUS : MAX_POSITION_CONTEXT_BONUS / 2;
  return capEvidenceBonus(raw, MAX_POSITION_CONTEXT_BONUS);
}

/**
 * Attribution hierarchy (before individual attribution, prefer a broader structural
 * explanation): if the player's own combination evidence already shows an established recurring
 * partnership, surface that as context rather than implying the pattern is about the player
 * alone. Reuses the existing season combination-evidence engine outright — no new inference.
 *
 * Deliberately does NOT reuse `selectRelevantPartnerships()` — that helper answers a different
 * question ("which partnerships are fully contained within this exact set of players", used by
 * the scenario evaluator for "who's on the pitch together"). Here the question is "which
 * partnerships include this one player at all", so partnerships are matched directly against
 * `playerIds.includes(playerId)`.
 */
export function findRelevantPartnershipForPlayer(
  playerId: string,
  summaries: SeasonCombinationSummary[],
): SeasonCombinationSummary | undefined {
  return summaries
    .filter((s) => s.family === "PARTNERSHIP" && s.confidence !== "INSUFFICIENT" && s.playerIds.includes(playerId))
    .sort((a, b) => b.totalMinutesTogether - a.totalMinutesTogether)[0];
}

async function buildStructuralNote(
  leagueSeasonId: string,
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<string | null> {
  if (orgFilter.type !== "org") return null;
  const rows = await getSeasonCombinationEvidence(leagueSeasonId);
  const evidence = aggregateSeasonCombinations(rows);
  const relevant = findRelevantPartnershipForPlayer(playerId, evidence);

  if (!relevant) return null;
  return `Most of this exposure occurred alongside a recurring teammate combination (${relevant.matchCount} match${relevant.matchCount === 1 ? "" : "es"} this season) — a broader structural pattern worth reviewing alongside the individual one.`;
}
