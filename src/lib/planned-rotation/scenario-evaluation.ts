import type { OpponentPlayingStyleTag } from "@/generated/prisma/client";
import {
  diffPlayerStates,
  type MatchPhaseWindow,
  type MatchStatePlayer,
  type PlayerStateDiff,
} from "@/lib/evidence/match-state-timeline";
import {
  selectRelevantPartnerships,
  type SeasonCombinationSummary,
} from "@/lib/evidence/combination-aggregation";
import type { MatchPhasePatternRow } from "@/lib/evidence/match-phase-pattern-evidence";
import type { OpponentTacticalTendency } from "@/lib/opponents/playing-style-aggregation";
import { PLAYING_STYLE_TAG_LABELS } from "@/lib/opponents/playing-style-tags";
import { projectPlannedLineup } from "@/lib/planned-rotation/planned-rotation";
import type { PlayerPositionContextEvidence } from "@/lib/evidence/position-context-evidence";

/**
 * Evidence-Informed Match Planning programme, Bundle 4: the shared "what happens if I change
 * this?" evaluator for a hypothetical (not-yet-played) plan — starting line-up + planned
 * rotation sequence. Projects exact on-field state at every planned time and attaches whatever
 * historical evidence (Bundles 1-3) is actually relevant to what changes at each point, using
 * the confidence/exposure discipline those bundles already established. Pure and read-only —
 * never mutates a `PlannedRotation`/`PlannedRotationChange` row, and reruns cleanly whenever any
 * input changes (starter, position, incoming/outgoing player, transition time, batch size, or
 * an earlier transition), since it is a pure function of its inputs.
 *
 * Extends existing owners rather than duplicating them:
 * - `projectPlannedLineup` (`planned-rotation.ts`) computes the on-pitch snapshot at one instant;
 *   this module calls it once per planned change boundary to build the full sequence.
 * - `diffPlayerStates` (`match-state-timeline.ts`, extracted from `deriveMatchTransitions` when
 *   this bundle was built) is the same structural-diff primitive Bundle 1 uses for actual
 *   history — a planned transition and an actual transition are diffed identically.
 * - `selectRelevantPartnerships`/`SeasonCombinationSummary` (existing combination evidence) and
 *   `MatchPhasePatternRow`/`OpponentTacticalTendency` (Bundle 2) are read, never recomputed.
 *
 * `approximateMatchSeconds` on a planned change is coach-entered as one flat "minutes since
 * kickoff" value (confirmed against the existing UI's own placeholder, "e.g. 1500 (25')") — a
 * single absolute match clock, not period-relative like a live-recorded event. No period-offset
 * conversion is needed here the way Bundle 1 needed for live-recorded data.
 */

export type PlannedScenarioPlayer = { playerId: string; position: string };

export type PlannedScenarioChange = {
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
};

export type PlannedScenarioInterval = {
  startSeconds: number;
  endSeconds: number;
  players: PlannedScenarioPlayer[];
};

export type PlanSignalKind = "OBSERVED_FACT" | "HISTORICAL_PATTERN";

export type PlanEvidenceSignal = {
  kind: PlanSignalKind;
  text: string;
};

export type PlannedScenarioTransition = PlayerStateDiff & {
  atSeconds: number;
  signals: PlanEvidenceSignal[];
};

export type PlannedScenarioEvaluation = {
  intervals: PlannedScenarioInterval[];
  transitions: PlannedScenarioTransition[];
  /** Match-level, not per-transition — Bundle 4 has no role-fit reasoning yet (Bundle 5), so an
   * opponent tendency is shown as context for the whole plan, never attached to one player. */
  opponentContext: PlanEvidenceSignal[];
  /** Position-context evidence addendum: one signal per starting player whose starting position
   * has recorded evidence, keyed by player so the UI can attach each to its own starter — a
   * starting assignment is a position decision too, evaluated on the same terms as any later one. */
  startingLineupSignals: Array<{ playerId: string; signal: PlanEvidenceSignal }>;
};

function toMatchStatePlayers(players: PlannedScenarioPlayer[]): MatchStatePlayer[] {
  return players.map((p) => ({ playerId: p.playerId, position: p.position, line: null, lane: null }));
}

const CONFIDENCE_LABELS: Record<string, string> = {
  EMERGING: "emerging",
  ESTABLISHED: "established",
};

function confidenceLabel(confidence: string): string {
  return CONFIDENCE_LABELS[confidence] ?? confidence.toLowerCase();
}

/**
 * Builds the full planned on-field sequence from a starting line-up and rotation changes,
 * reusing `projectPlannedLineup` at each change's own boundary time — never re-implementing
 * the projection logic. An interval boundary exists only where a coach actually planned a
 * change (an untimed change contributes no boundary and is simply not reflected in the
 * sequence, matching D-002/MIGRATION.md's "do not synthesize timing that was never recorded").
 */
export function buildPlannedScenarioIntervals(
  starters: PlannedScenarioPlayer[],
  changes: PlannedScenarioChange[],
  totalMatchSeconds: number | null,
): PlannedScenarioInterval[] {
  const timedChangeSeconds = changes
    .map((c) => c.approximateMatchSeconds)
    .filter((s): s is number => s !== null);

  const boundaries = new Set<number>([0, ...timedChangeSeconds]);
  if (totalMatchSeconds !== null) boundaries.add(totalMatchSeconds);

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

  function snapshotAt(seconds: number): PlannedScenarioPlayer[] {
    const lineup = projectPlannedLineup(starters, changes, seconds);
    return [...lineup.entries()]
      .filter(([, state]) => state.onPitch)
      .map(([playerId, state]) => ({ playerId, position: state.position }));
  }

  if (sortedBoundaries.length < 2) {
    // No timed changes and no known total duration — still return the starting state as one
    // open-ended interval so the plan remains inspectable at all.
    return [{ startSeconds: 0, endSeconds: totalMatchSeconds ?? 0, players: snapshotAt(0) }];
  }

  const intervals: PlannedScenarioInterval[] = [];
  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const startSeconds = sortedBoundaries[i]!;
    const endSeconds = sortedBoundaries[i + 1]!;
    intervals.push({ startSeconds, endSeconds, players: snapshotAt(startSeconds) });
  }
  return intervals;
}

/**
 * Pure transitions between consecutive planned intervals, via the shared `diffPlayerStates`
 * primitive (no score/period concept exists for a hypothetical plan, unlike Bundle 1's actual
 * transitions, so no score/natural-break fields are attached here).
 */
export function buildPlannedScenarioTransitions(
  intervals: PlannedScenarioInterval[],
): Array<PlayerStateDiff & { atSeconds: number }> {
  const transitions: Array<PlayerStateDiff & { atSeconds: number }> = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    const before = toMatchStatePlayers(intervals[i]!.players);
    const after = toMatchStatePlayers(intervals[i + 1]!.players);
    const diff = diffPlayerStates(before, after);
    transitions.push({ atSeconds: intervals[i + 1]!.startSeconds, ...diff });
  }
  return transitions;
}

/**
 * The top-level shared evaluator (PROGRAMME.md Bundle 4): projects the full planned sequence
 * and attaches whatever historical evidence Bundles 1-3 already make available. Weak/absent
 * evidence produces no signal at all rather than a forced, empty-sounding one — "unknown stays
 * quiet" (PRINCIPLES.md).
 */
/**
 * Looks up position-context evidence for a (playerId, position) pair from a pre-loaded array —
 * this module stays pure/DB-free like the rest of Bundle 4, so the caller loads evidence for
 * every pair the plan can possibly touch ahead of time (mirroring how `matchPhasePatterns`/
 * `combinationEvidence` are already pre-loaded plain data, not fetched here).
 */
function findPositionContextEvidence(
  rows: PlayerPositionContextEvidence[],
  playerId: string,
  position: string,
): PlayerPositionContextEvidence | undefined {
  return rows.find((r) => r.playerId === playerId && r.position === position);
}

export function evaluatePlannedScenario(input: {
  starters: PlannedScenarioPlayer[];
  changes: PlannedScenarioChange[];
  totalMatchSeconds: number | null;
  phaseWindows?: MatchPhaseWindow[];
  matchPhasePatterns?: MatchPhasePatternRow[];
  combinationEvidence?: SeasonCombinationSummary[];
  opponentTendencies?: OpponentTacticalTendency[];
  /** Position-context evidence addendum: one row per (playerId, position) pair the plan may
   * touch, pre-loaded by the caller. Absent/empty produces no position-context signals at all. */
  positionContextEvidence?: PlayerPositionContextEvidence[];
}): PlannedScenarioEvaluation {
  const phaseWindows = input.phaseWindows ?? [];
  const matchPhasePatterns = input.matchPhasePatterns ?? [];
  const combinationEvidence = input.combinationEvidence ?? [];
  const opponentTendencies = input.opponentTendencies ?? [];
  const positionContextEvidence = input.positionContextEvidence ?? [];

  const intervals = buildPlannedScenarioIntervals(input.starters, input.changes, input.totalMatchSeconds);
  const rawTransitions = buildPlannedScenarioTransitions(intervals);

  const transitions: PlannedScenarioTransition[] = rawTransitions.map((t, i) => {
    const signals: PlanEvidenceSignal[] = [];

    if (t.playersRemaining.length >= 2) {
      for (const partnership of selectRelevantPartnerships(t.playersRemaining, combinationEvidence)) {
        signals.push({
          kind: "OBSERVED_FACT",
          text: `${partnership.playerIds.length} players staying on together here have shared ${Math.round(partnership.totalMinutesTogether)} minutes across ${partnership.matchCount} match${partnership.matchCount === 1 ? "" : "es"} this season (${confidenceLabel(partnership.confidence)} confidence).`,
        });
      }
    }

    if (phaseWindows.length > 0 && matchPhasePatterns.length > 0) {
      const atMs = t.atSeconds * 1000;
      const matchingWindows = phaseWindows.filter((w) => atMs >= w.startMs && atMs < w.endMs);
      const seenKeys = new Set<string>();
      for (const window of matchingWindows) {
        const key = `${window.period}:${window.key}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const pattern = matchPhasePatterns.find((p) => p.period === window.period && p.phase === window.key);
        if (!pattern || pattern.confidence === "INSUFFICIENT") continue;
        signals.push({
          kind: "HISTORICAL_PATTERN",
          text: `Across ${pattern.matches} recorded matches, this team has recorded ${pattern.goalsFor} goal${pattern.goalsFor === 1 ? "" : "s"} for and ${pattern.goalsAgainst} against in this phase of the match (${confidenceLabel(pattern.confidence)} confidence).`,
        });
      }
    }

    // Position-context evidence addendum: evaluated for every player whose position is newly
    // relevant at this transition — entering the pitch, or changing position while remaining on
    // it. A player simply continuing at an unchanged position produces no repeated signal here
    // (their position-context evidence was already surfaced at the transition where they took
    // up that position).
    if (positionContextEvidence.length > 0) {
      const afterInterval = intervals[i + 1];
      for (const playerId of t.playersOn) {
        const position = afterInterval?.players.find((p) => p.playerId === playerId)?.position;
        if (!position) continue;
        const evidence = findPositionContextEvidence(positionContextEvidence, playerId, position);
        if (evidence?.explanation) {
          signals.push({ kind: "HISTORICAL_PATTERN", text: evidence.explanation });
        }
      }
      for (const change of t.positionOnlyChanges) {
        const evidence = findPositionContextEvidence(positionContextEvidence, change.playerId, change.toPosition);
        if (evidence?.explanation) {
          signals.push({ kind: "HISTORICAL_PATTERN", text: evidence.explanation });
        }
      }
    }

    return { ...t, signals };
  });

  const opponentContext: PlanEvidenceSignal[] = opponentTendencies
    .filter((tendency) => tendency.confidence !== "INSUFFICIENT")
    .map((tendency) => ({
      kind: "HISTORICAL_PATTERN" as const,
      text: `Recent observations repeatedly show ${(PLAYING_STYLE_TAG_LABELS[tendency.tag as OpponentPlayingStyleTag] ?? tendency.tag).toLowerCase()} from this opponent, across ${tendency.occurrences} recorded encounter${tendency.occurrences === 1 ? "" : "s"} (${confidenceLabel(tendency.confidence)} confidence).`,
    }));

  const startingLineupSignals: Array<{ playerId: string; signal: PlanEvidenceSignal }> = [];
  if (positionContextEvidence.length > 0) {
    for (const starter of input.starters) {
      const evidence = findPositionContextEvidence(positionContextEvidence, starter.playerId, starter.position);
      if (evidence?.explanation) {
        startingLineupSignals.push({
          playerId: starter.playerId,
          signal: { kind: "HISTORICAL_PATTERN", text: evidence.explanation },
        });
      }
    }
  }

  return { intervals, transitions, opponentContext, startingLineupSignals };
}
