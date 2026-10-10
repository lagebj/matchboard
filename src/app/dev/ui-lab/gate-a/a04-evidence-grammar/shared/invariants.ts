/**
 * A04 additional mandatory data-truth invariants (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`, "Additional
 * mandatory data-truth tests"). Pure, dev-only, test-exercised logic — no production import.
 */

export type ClosedInterval = { start: number; end: number };

/**
 * A closed interval must have a nonnegative start and a strictly later end — a reversed
 * (`end <= start`) or negative-duration interval is not a valid recorded playing interval, even
 * if it happens not to overlap anything else (independent review round 1, PR #778, finding
 * adjacent to #R3: `assertNonOverlappingIntervals` alone accepted such records as long as they
 * didn't overlap).
 */
export function assertValidClosedInterval(interval: ClosedInterval): void {
  if (interval.start < 0) {
    throw new Error(`Invalid interval [${interval.start},${interval.end}) — start must be nonnegative.`);
  }
  if (interval.end <= interval.start) {
    throw new Error(`Invalid interval [${interval.start},${interval.end}) — end must be strictly after start.`);
  }
}

/**
 * Two intervals overlapping in the same match are not safely additive (data-truth test #2).
 * Throws rather than silently summing or rewriting the source intervals. Validates each interval
 * individually first (nonnegative, strictly increasing bounds) before checking overlap.
 */
export function assertNonOverlappingIntervals(intervals: readonly ClosedInterval[]): void {
  for (const interval of intervals) assertValidClosedInterval(interval);
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.start < prev.end) {
      throw new Error(
        `Overlapping intervals [${prev.start},${prev.end}) and [${cur.start},${cur.end}) cannot be safely summed — reject, do not silently mask the duplicate.`,
      );
    }
  }
}

/**
 * Rejects a duplicated or mismatched identifier instead of silently double-counting it — a
 * denominator must count distinct records, not raw array length (independent review round 1, PR
 * #778, finding R1).
 */
export function assertUniqueIds(ids: readonly string[], label = "record"): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} id "${id}" — a denominator must count distinct records, not raw entries.`);
    }
    seen.add(id);
  }
}

/** A historical coach-authored note. Retraction keeps the note visible as history without it
 * remaining active evidence (data-truth test #4) — no numeric change, no inferred cause. */
export type HistoricalCoachNote = {
  noteId: string;
  text: string;
  /** A tentative note stays tentative and attributed — never silently promoted to a certain fact (data-truth test #5). */
  tentative: boolean;
  authoredBy: string;
  retracted: boolean;
  retractedAt?: string;
};

export function isActiveEvidence(note: HistoricalCoachNote): boolean {
  return !note.retracted;
}

/** Two source records describing the "same" fact that disagree in value. No source-priority
 * order is invented here (data-truth test #3) — a disagreement is flagged, never silently
 * resolved. */
export type ConflictingValue = { sourceId: string; value: string };

export function describeConflict(a: ConflictingValue, b: ConflictingValue): "CONFLICT" | "AGREEMENT" {
  return a.value === b.value ? "AGREEMENT" : "CONFLICT";
}
