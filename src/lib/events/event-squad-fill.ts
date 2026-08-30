import type { PlayerAttributeProfile } from './event-types';
import { isGoalkeeperCapable } from './event-types';
import { NEUTRAL_UNRATED_RATING } from '@/lib/ratings/player-rating';
import { computeCompositeRatings } from './event-types';

/**
 * "Fill remaining places" (ADR-0109 §5, D15/D16/D17) — the non-destructive residual-allocation
 * operation, deliberately separate from "regenerate automatic plan"
 * (`generateEventSquads`/`generateEventSquadsAction`):
 *
 *   - preserves every existing assignment, AUTO included — never moves anyone;
 *   - considers only currently-unassigned eligible players;
 *   - computes each squad's own `residualTarget = max(0, targetSize - currentCount)` and fills
 *     that before adding to a squad already at/above its own target;
 *   - never exceeds a squad's own `maxSize`;
 *   - uses each squad's own min/target/max — never a shared/first-squad value.
 *
 * Mandatory fixture (TEST-MATRIX.md §5A):
 *   targets 12/9/9, current 11/5/5, 9 unassigned eligible -> additions 1/4/4, final 12/9/9.
 */

export type FillSquadInput = {
  squadId: string;
  /** Ascending sort order used only to break exact ties deterministically. */
  generationOrder: number;
  currentCount: number;
  targetSize: number;
  minSize: number | null;
  maxSize: number | null;
  /** True if this squad already has at least one goalkeeper-capable player assigned. */
  hasGoalkeeper: boolean;
};

export type FillCandidatePlayer = PlayerAttributeProfile;

export type FillAddition = {
  playerId: string;
  squadId: string;
  reason: string;
};

export type FillSquadResult = {
  squadId: string;
  currentCount: number;
  finalCount: number;
  additions: number;
  /** Residual target need this squad had before the fill ran (never negative). */
  residualTargetBefore: number;
  /** True if this squad still has unmet target need after the fill ran (scarcity). */
  belowTargetAfter: boolean;
};

export type FillPlan = {
  additions: FillAddition[];
  squadResults: FillSquadResult[];
  unassignedPlayerIds: string[];
  /** Coach-facing explanations for any remaining shortage or surplus (D16/D17). */
  notes: string[];
};

function effectiveRating(player: PlayerAttributeProfile): number {
  const ratings = computeCompositeRatings(player);
  return ratings.overallLevel ?? NEUTRAL_UNRATED_RATING;
}

function squadMax(squad: FillSquadInput): number {
  return squad.maxSize ?? squad.targetSize;
}

function squadMin(squad: FillSquadInput): number {
  return squad.minSize ?? 0;
}

/**
 * Picks the best remaining candidate for a squad that currently has no goalkeeper: a
 * goalkeeper-capable player first (D17 fixture G — a sporting hard constraint can alter WHICH
 * player fills a residual slot, without changing HOW MANY players a squad receives), otherwise
 * the highest-rated remaining candidate.
 */
function pickCandidateFor(squad: { hasGoalkeeper: boolean }, pool: FillCandidatePlayer[]): FillCandidatePlayer | null {
  if (pool.length === 0) return null;
  if (!squad.hasGoalkeeper) {
    const gk = pool.find((p) => isGoalkeeperCapable(p));
    if (gk) return gk;
  }
  return pool[0];
}

export function computeEventSquadFillPlan(
  squads: FillSquadInput[],
  unassignedPlayers: FillCandidatePlayer[],
): FillPlan {
  const additions: FillAddition[] = [];
  const notes: string[] = [];

  // Highest-rated first, so a genuine "best available player" ordering is used within whichever
  // squad a player is routed to; pickCandidateFor() can still promote a GK-capable player ahead
  // of a higher-rated outfield player when a squad still lacks goalkeeper coverage.
  let pool = [...unassignedPlayers].sort((a, b) => effectiveRating(b) - effectiveRating(a));

  const state = new Map<string, { currentCount: number; hasGoalkeeper: boolean }>();
  for (const s of squads) {
    state.set(s.squadId, { currentCount: s.currentCount, hasGoalkeeper: s.hasGoalkeeper });
  }

  // --- Phase 1: hard minimums first. A squad below its own minSize is a viability floor,
  // filled before any squad's target residual, regardless of relative target size. ---
  fillPhase(
    squads,
    state,
    pool,
    additions,
    (squad, st) => Math.max(0, squadMin(squad) - st.currentCount),
    'Filled toward minimum accepted squad size',
  );
  pool = pool.filter((p) => !additions.some((a) => a.playerId === p.playerId));

  // --- Phase 2: target residual. Largest remaining residual is served first; when supply
  // exactly matches total residual (the mandatory fixture shape), this converges to giving each
  // squad exactly its own residual — never a shared/global count. ---
  const residualBefore = new Map<string, number>();
  for (const s of squads) {
    const st = state.get(s.squadId)!;
    residualBefore.set(s.squadId, Math.max(0, s.targetSize - st.currentCount));
  }

  fillPhase(
    squads,
    state,
    pool,
    additions,
    (squad, st) => Math.max(0, squad.targetSize - st.currentCount),
    'Filled toward target squad size',
  );
  pool = pool.filter((p) => !additions.some((a) => a.playerId === p.playerId));

  // --- Phase 3: surplus. Every squad has reached its own target (or ran out of supply trying);
  // distribute any remaining players to squads with room below their own max, preferring the
  // squad with the fewest players so surplus doesn't pile onto one squad. Never exceeds max. ---
  fillPhase(
    squads,
    state,
    pool,
    additions,
    (squad, st) => Math.max(0, squadMax(squad) - st.currentCount),
    'Added as surplus capacity below maximum squad size',
    { preferFewestCurrent: true },
  );
  pool = pool.filter((p) => !additions.some((a) => a.playerId === p.playerId));

  const squadResults: FillSquadResult[] = squads.map((s) => {
    const st = state.get(s.squadId)!;
    const before = squads.find((x) => x.squadId === s.squadId)!.currentCount;
    return {
      squadId: s.squadId,
      currentCount: before,
      finalCount: st.currentCount,
      additions: st.currentCount - before,
      residualTargetBefore: residualBefore.get(s.squadId) ?? 0,
      belowTargetAfter: st.currentCount < s.targetSize,
    };
  });

  for (const result of squadResults) {
    if (result.belowTargetAfter) {
      notes.push(
        `Squad still below target after fill: ${result.finalCount}/${squads.find((s) => s.squadId === result.squadId)!.targetSize} — not enough eligible unassigned players.`,
      );
    }
  }

  if (pool.length > 0) {
    notes.push(
      `${pool.length} eligible player${pool.length === 1 ? '' : 's'} left unassigned — every squad is at its maximum size.`,
    );
  }

  return {
    additions,
    squadResults,
    unassignedPlayerIds: pool.map((p) => p.playerId),
    notes,
  };
}

/**
 * Repeatedly assigns one player at a time to whichever squad currently has the largest need
 * (by `needFn`), until no squad has remaining need or the pool is exhausted. Deterministic:
 * ties break by ascending `generationOrder`, then squad id.
 */
function fillPhase(
  squads: FillSquadInput[],
  state: Map<string, { currentCount: number; hasGoalkeeper: boolean }>,
  pool: FillCandidatePlayer[],
  additions: FillAddition[],
  needFn: (squad: FillSquadInput, st: { currentCount: number; hasGoalkeeper: boolean }) => number,
  reason: string,
  options?: { preferFewestCurrent: boolean },
): void {
  const remainingPool = [...pool];

  while (remainingPool.length > 0) {
    const ranked = squads
      .map((s) => ({ squad: s, need: needFn(s, state.get(s.squadId)!) }))
      .filter((r) => r.need > 0)
      .sort((a, b) => {
        if (options?.preferFewestCurrent) {
          const aCount = state.get(a.squad.squadId)!.currentCount;
          const bCount = state.get(b.squad.squadId)!.currentCount;
          if (aCount !== bCount) return aCount - bCount;
        } else if (a.need !== b.need) {
          return b.need - a.need;
        }
        if (a.squad.generationOrder !== b.squad.generationOrder) {
          return a.squad.generationOrder - b.squad.generationOrder;
        }
        return a.squad.squadId.localeCompare(b.squad.squadId);
      });

    if (ranked.length === 0) break;

    const target = ranked[0].squad;
    const st = state.get(target.squadId)!;
    const candidate = pickCandidateFor(st, remainingPool);
    if (!candidate) break;

    additions.push({ playerId: candidate.playerId, squadId: target.squadId, reason });
    st.currentCount += 1;
    if (isGoalkeeperCapable(candidate)) st.hasGoalkeeper = true;

    const idx = remainingPool.findIndex((p) => p.playerId === candidate.playerId);
    remainingPool.splice(idx, 1);
  }
}
