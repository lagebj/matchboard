import type { MatchTransition } from "@/lib/evidence/match-state-timeline";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

/**
 * Pure, DB-free view-model builders for Completed Match's new ADR-0157 C6 sections (Match story
 * shape changes, Match flow, "What this match added"). Composes already-computed canonical
 * owners (`deriveMatchTransitions`/`diffPlayerStates`, `buildMatchTimeline`) — it never re-derives
 * domain truth itself.
 */

// ---------------------------------------------------------------------------
// Match story -- shape/position changes
// ---------------------------------------------------------------------------

export interface ShapeChangeRow {
  id: string;
  minuteLabel: string | null;
  changes: Array<{ playerId: string; playerName: string; fromPosition: string; toPosition: string }>;
}

/**
 * Concrete on-pitch position changes for players who stayed on the pitch across a transition
 * (`positionOnlyChanges` -- substitutions are already shown as their own "Match story" timeline
 * rows and are deliberately excluded here to avoid showing the same event twice). No formation
 * signature (e.g. "4-3-3 -> 3-2-2") is derived or guessed -- no canonical signature-to-label
 * mapping exists in this codebase, and inventing one from grid coordinates would be exactly the
 * "visual guess" ADR-0157 C6 prohibits. This is the spec's own sanctioned fallback: concrete
 * player/position changes instead of a label.
 */
export function buildShapeChangeRows(
  transitions: readonly MatchTransition[],
  playerNameById: ReadonlyMap<string, string>,
): ShapeChangeRow[] {
  return transitions
    .filter((t) => t.positionOnlyChanges.length > 0)
    .map((t) => ({
      id: `shape-${t.atMs}`,
      // `atMs` is the canonical cumulative absolute match clock `deriveMatchStateIntervals()`
      // already resolves via `resolvePeriodForAbsoluteMs` -- unlike `LiveMatchEvent.matchSeconds`
      // (period-relative, deliberately not used for minute math elsewhere in this codebase), this
      // value is safe to convert directly.
      minuteLabel: `${Math.floor(t.atMs / 60_000)}'`,
      changes: t.positionOnlyChanges.map((c) => ({
        playerId: c.playerId,
        playerName: playerNameById.get(c.playerId) ?? "Unknown player",
        fromPosition: c.fromPosition,
        toPosition: c.toPosition,
      })),
    }));
}

// ---------------------------------------------------------------------------
// Match flow -- factual score/event chronology (never a momentum model)
// ---------------------------------------------------------------------------

export type MatchFlowPointKind = "GOAL_FOR" | "GOAL_AGAINST" | "ROTATION" | "PERIOD_BOUNDARY" | "MATCH_END";

export interface MatchFlowPoint {
  id: string;
  kind: MatchFlowPointKind;
  minuteLabel: string | null;
  label: string;
  ownGoals: number;
  opponentGoals: number;
}

export interface MatchFlowChronology {
  /** `false` when a goal's own minute is unknown -- placing it on a time axis would require
   * interpolating a value that was never recorded, which ADR-0157 C6 explicitly prohibits. The
   * UI degrades to the plain Match story timeline instead of rendering a chronology in that
   * case. */
  trustworthy: boolean;
  points: MatchFlowPoint[];
}

/**
 * Builds the factual score-over-time chronology from the same already-ordered, already-
 * deduplicated `MatchTimelineItem[]` the Match story section renders (`buildMatchTimeline()`) --
 * never a second event feed, never an invented momentum/dominance curve. Cumulative own/opponent
 * goal counts are summed in the timeline's own established chronological order; nothing is
 * interpolated between two known points.
 */
export function buildMatchFlowChronology(timeline: readonly MatchTimelineItem[]): MatchFlowChronology {
  const goalItems = timeline.filter((i) => i.kind === "GOAL_FOR" || i.kind === "GOAL_AGAINST");
  const trustworthy = goalItems.length === 0 || goalItems.every((i) => i.minuteLabel !== null);

  if (!trustworthy) return { trustworthy: false, points: [] };

  let ownGoals = 0;
  let opponentGoals = 0;
  const points: MatchFlowPoint[] = [];

  for (const item of timeline) {
    if (item.kind === "GOAL_FOR") ownGoals++;
    if (item.kind === "GOAL_AGAINST") opponentGoals++;

    const kind: MatchFlowPointKind =
      item.kind === "GOAL_FOR" || item.kind === "GOAL_AGAINST"
        ? item.kind
        : item.kind === "ROTATION"
          ? "ROTATION"
          : item.kind === "PERIOD_BOUNDARY"
            ? "PERIOD_BOUNDARY"
            : item.kind === "MATCH_END"
              ? "MATCH_END"
              : "ROTATION";

    if (
      item.kind !== "GOAL_FOR" &&
      item.kind !== "GOAL_AGAINST" &&
      item.kind !== "ROTATION" &&
      item.kind !== "PERIOD_BOUNDARY" &&
      item.kind !== "MATCH_END"
    ) {
      continue;
    }

    points.push({
      id: item.id,
      kind,
      minuteLabel: item.minuteLabel,
      label: describeFlowPoint(item),
      ownGoals,
      opponentGoals,
    });
  }

  return { trustworthy: true, points };
}

function describeFlowPoint(item: MatchTimelineItem): string {
  if (item.kind === "GOAL_FOR") return item.playerName ? `Goal — ${item.playerName}` : "Goal";
  if (item.kind === "GOAL_AGAINST") return "Opponent goal";
  if (item.kind === "ROTATION") return item.playerName ? `${item.secondaryPlayerName ?? "Player"} off, ${item.playerName} on` : "Substitution";
  if (item.kind === "PERIOD_BOUNDARY") return "Period boundary";
  return "Full time";
}

// ---------------------------------------------------------------------------
// "What this match added" -- material, computed change only
// ---------------------------------------------------------------------------

export interface WhatThisMatchAddedRow {
  id: string;
  label: string;
}

export interface WhatThisMatchAddedInput {
  hasNewObservations: boolean;
  observationCount: number;
  hasNewOpponentEncounter: boolean;
  opponentName: string | null;
  firstTimeCanonicalPositions: Array<{ playerId: string; playerName: string; position: string }>;
}

/**
 * Only the row kinds ADR-0157 C6 explicitly allows, each gated on a real computed/recorded fact
 * from this match -- never a player-ability claim, never "Partially met", never fabricated from
 * one match's correlation. Returns `[]` when nothing material happened, rather than padding the
 * section with a row that isn't true.
 */
export function buildWhatThisMatchAddedRows(input: WhatThisMatchAddedInput): WhatThisMatchAddedRow[] {
  const rows: WhatThisMatchAddedRow[] = [];

  for (const entry of input.firstTimeCanonicalPositions) {
    rows.push({
      id: `position-${entry.playerId}-${entry.position}`,
      label: `${entry.playerName} recorded their first minutes at ${entry.position} this season.`,
    });
  }

  if (input.hasNewOpponentEncounter && input.opponentName) {
    rows.push({
      id: "opponent-encounter",
      label: `Opponent memory gained a new recorded encounter with ${input.opponentName}.`,
    });
  }

  if (input.hasNewObservations) {
    rows.push({
      id: "observations",
      label: `${input.observationCount} coach observation${input.observationCount === 1 ? "" : "s"} recorded from this match.`,
    });
  }

  return rows;
}
