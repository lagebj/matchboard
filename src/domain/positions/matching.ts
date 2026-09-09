// ─────────────────────────────────────────────────────────────────
// Deterministic bounded bipartite slot↔candidate matching for exact
// automatic planning (ADR-0129 §9/§10/§11).
//
// NEVER a single unbounded additive score across position fit +
// fairness + evidence. Ordering is lexicographic:
//   1. maximize the number of required slots filled by an ELIGIBLE
//      player (NATURAL / STRONG / PLAUSIBLE only);
//   2. maximize the NATURAL count;
//   3. maximize the STRONG count;
//   4. maximize the caller's fairness objective;
//   5. maximize exact suitability score;
//   6. maximize the caller's tactical / coaching-intent / evidence
//      preference;
//   7. stable deterministic tie-break.
//
// A lower tier can never beat a higher tier because of fairness or
// evidence. If no eligible candidate exists for a required slot the
// slot is left UNRESOLVED (never filled by DEVELOPMENTAL / UNSUPPORTED
// to satisfy a count) and the caller surfaces the gap.
//
// Implemented as exact max-weight bipartite assignment (Kuhn–Munkres,
// BigInt costs) on a padded square so slots/candidates may be left
// unmatched. Sizes here are tiny (≤ ~15 slots, ≤ ~30 candidates) so
// the O(n³) cost is negligible.
// ─────────────────────────────────────────────────────────────────

import type { DeclaredPositions } from "./suitability";
import { classifyExactSuitability } from "./suitability";
import type { ExactRole } from "./roles";
import { clampScore, type SuitabilityTier } from "./matrix";

export interface SafeMatchSlot {
  slotId: string;
  /** The exact role this slot requires (from `deriveExactTargetRole`). */
  targetRole: ExactRole;
}

export interface SafeMatchCandidate {
  candidateId: string;
  declaredPositions: DeclaredPositions;
}

export interface SafeMatchScoring {
  /**
   * Within-tier fairness need for a (candidate, slot) pair — higher means the
   * candidate is more in need of this opportunity. Clamped to `0..999_999`.
   * Objective 4. Default 0.
   */
  fairness?: (candidateId: string, slotId: string, role: ExactRole) => number;
  /**
   * Within-tier tactical / coaching-intent / evidence-informed preference for a
   * (candidate, slot) pair. Clamped to `0..999`. Objective 6. Default 0.
   * Can only re-order already-eligible candidates — never widens eligibility.
   */
  preference?: (candidateId: string, slotId: string, role: ExactRole) => number;
  /** Stable seed for the deterministic tie-break (objective 7). */
  seed: string;
}

export interface SafeMatchAssignment {
  slotId: string;
  candidateId: string;
  role: ExactRole;
  tier: SuitabilityTier;
  suitabilityScore: number;
}

export interface SafeMatchResult {
  assignments: SafeMatchAssignment[];
  /** Required slots with no automatically eligible candidate — left unresolved. */
  unfilledSlots: { slotId: string; role: ExactRole }[];
  /** Candidates not assigned to any slot. */
  benchedCandidateIds: string[];
}

const TEN = BigInt(10);
const ZERO = BigInt(0);

// Lexicographic band scales (BigInt, exact). Each band's maximum summed
// contribution across a whole matching stays strictly below the next band's
// unit, so the packed integer weight is a faithful lexicographic key.
const BAND_TIER = TEN ** BigInt(24);
const BAND_FAIRNESS = TEN ** BigInt(15);
const BAND_SUITABILITY = TEN ** BigInt(10);
const BAND_PREFERENCE = TEN ** BigInt(5);
const BAND_TIEBREAK = BigInt(1);
// Dominates any full-matching lexicographic weight, so cardinality wins first.
const ELIGIBLE_BONUS = TEN ** BigInt(30);
// Pushes an ineligible real pair below "leave unmatched" (weight 0).
const INELIGIBLE = -(TEN ** BigInt(30));

function tierRank(tier: SuitabilityTier): bigint {
  if (tier === "NATURAL") return BigInt(100);
  if (tier === "STRONG") return BigInt(1);
  return ZERO; // PLAUSIBLE (still eligible, counted via ELIGIBLE_BONUS)
}

function clampInt(value: number, max: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return ZERO;
  const rounded = Math.round(value);
  return BigInt(rounded > max ? max : rounded);
}

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function matchSlotsToCandidates(
  slots: SafeMatchSlot[],
  candidates: SafeMatchCandidate[],
  scoring: SafeMatchScoring,
): SafeMatchResult {
  const S = slots.length;
  const C = candidates.length;

  if (S === 0) {
    return { assignments: [], unfilledSlots: [], benchedCandidateIds: candidates.map((c) => c.candidateId) };
  }

  // Per-pair suitability + eligibility.
  type Cell = { eligible: boolean; tier: SuitabilityTier; score: number };
  const cells: Cell[][] = slots.map((slot) =>
    candidates.map((cand) => {
      const s = classifyExactSuitability(cand.declaredPositions, slot.targetRole);
      return { eligible: s.automaticallyEligible, tier: s.tier, score: s.score };
    }),
  );

  // Deterministic global tie-break rank over eligible edges only.
  const eligibleEdges: { si: number; ci: number; hash: number }[] = [];
  for (let si = 0; si < S; si++) {
    for (let ci = 0; ci < C; ci++) {
      if (cells[si][ci].eligible) {
        eligibleEdges.push({
          si,
          ci,
          hash: fnv1a(`${scoring.seed}:${slots[si].slotId}:${candidates[ci].candidateId}`),
        });
      }
    }
  }
  eligibleEdges.sort((a, b) =>
    a.hash !== b.hash
      ? a.hash - b.hash
      : slots[a.si].slotId < slots[b.si].slotId
        ? -1
        : slots[a.si].slotId > slots[b.si].slotId
          ? 1
          : candidates[a.ci].candidateId < candidates[b.ci].candidateId
            ? -1
            : 1,
  );
  const tiebreakByEdge = new Map<string, bigint>();
  eligibleEdges.forEach((e, rank) => {
    tiebreakByEdge.set(`${e.si}:${e.ci}`, BigInt(eligibleEdges.length - rank));
  });

  // Padded square: rows = S slots + C dummy slots; cols = C candidates + S dummy cols.
  const N = S + C;
  const weight: bigint[][] = Array.from({ length: N }, () => Array<bigint>(N).fill(ZERO));

  for (let si = 0; si < S; si++) {
    const slot = slots[si];
    for (let ci = 0; ci < C; ci++) {
      const cell = cells[si][ci];
      if (!cell.eligible) {
        weight[si][ci] = INELIGIBLE;
        continue;
      }
      const fairness = clampInt(scoring.fairness?.(candidates[ci].candidateId, slot.slotId, slot.targetRole) ?? 0, 999_999);
      const preference = clampInt(scoring.preference?.(candidates[ci].candidateId, slot.slotId, slot.targetRole) ?? 0, 999);
      const suitability = clampInt(clampScore(cell.score), 100);
      weight[si][ci] =
        ELIGIBLE_BONUS +
        tierRank(cell.tier) * BAND_TIER +
        fairness * BAND_FAIRNESS +
        suitability * BAND_SUITABILITY +
        preference * BAND_PREFERENCE +
        (tiebreakByEdge.get(`${si}:${ci}`) ?? ZERO) * BAND_TIEBREAK;
    }
    // dummy cols (C..N-1): slot left unfilled, weight 0 — already filled.
  }
  // dummy rows (S..N-1) against every col: weight 0 — already filled.

  const colForRow = maxWeightAssignment(weight);

  const assignments: SafeMatchAssignment[] = [];
  const benched = new Set(candidates.map((c) => c.candidateId));
  const unfilledSlots: { slotId: string; role: ExactRole }[] = [];

  for (let si = 0; si < S; si++) {
    const ci = colForRow[si];
    if (ci >= 0 && ci < C && cells[si][ci].eligible) {
      const cell = cells[si][ci];
      assignments.push({
        slotId: slots[si].slotId,
        candidateId: candidates[ci].candidateId,
        role: slots[si].targetRole,
        tier: cell.tier,
        suitabilityScore: cell.score,
      });
      benched.delete(candidates[ci].candidateId);
    } else {
      unfilledSlots.push({ slotId: slots[si].slotId, role: slots[si].targetRole });
    }
  }

  return { assignments, unfilledSlots, benchedCandidateIds: [...benched] };
}

/**
 * Kuhn–Munkres (Hungarian) max-weight perfect matching on a square BigInt
 * matrix. Returns the column index assigned to each row. Deterministic:
 * fixed iteration order and (for real eligible edges) distinct weights via
 * the tie-break band.
 */
function maxWeightAssignment(weight: bigint[][]): number[] {
  const n = weight.length;
  // Convert max-weight → min-cost.
  let maxW = ZERO;
  for (const row of weight) for (const w of row) if (w > maxW) maxW = w;
  const cost: bigint[][] = weight.map((row) => row.map((w) => maxW - w));

  const INF = (maxW + BigInt(1)) * BigInt(n + 1) + BigInt(1);
  const u = new Array<bigint>(n + 1).fill(ZERO);
  const v = new Array<bigint>(n + 1).fill(ZERO);
  const p = new Array<number>(n + 1).fill(0); // p[j] = row matched to col j (1-indexed rows)
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<bigint>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const colForRow = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] >= 1 && p[j] <= n) colForRow[p[j] - 1] = j - 1;
  }
  return colForRow;
}
