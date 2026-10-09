/**
 * A04 additional mandatory data-truth invariants (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`, "Additional
 * mandatory data-truth tests"). Pure, dev-only, test-exercised logic — no production import.
 */

export type ClosedInterval = { start: number; end: number };

/**
 * Two intervals overlapping in the same match are not safely additive (data-truth test #2).
 * Throws rather than silently summing or rewriting the source intervals.
 */
export function assertNonOverlappingIntervals(intervals: readonly ClosedInterval[]): void {
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
