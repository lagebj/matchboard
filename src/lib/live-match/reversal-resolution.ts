// Deliberately no `import "server-only"` gate needed at the pure-function level below; the
// DB-bound query helpers do rely on tenant-scoped `db` access and are only ever called from
// already-server-only call sites (report seeding, evidence reconstruction).

import { db } from "@/lib/db";

/**
 * ADR-0138 Bundle 9 (OBSERVABILITY_RECOVERY_ROLLOUT.md's "verify evidence consumers use
 * persisted canonical stream") — a recurring bug class, now centralized once instead of
 * independently re-fixed a fourth time.
 *
 * A reversal is a *separate* event row (`correctionType: "REVERSAL"`, `correctsEventId`
 * pointing at the original) — the original event itself is never modified and keeps
 * `correctionType: null` forever (ARR-0047's own finding). Any consumer reading raw event rows
 * must therefore exclude a row whose id appears as some *other* row's `correctsEventId`, not
 * just exclude the reversal marker rows themselves. This exact class of bug has already been
 * found and fixed three times independently — the live projection (ARR-0047, Bundle 5),
 * League's own `seedReportFromLiveSession()` (ADR-0133 H1 follow-up) — and, discovered during
 * this bundle's evidence-consumer audit, was still present in two more places: Event's
 * `seedEventReportFromLiveSession()` (goals/scorer/assist) and both League's and Event's
 * actual-timeline reconstruction (`actual-timeline.ts`, position-change/rotation queries).
 * This module is the one shared, reusable fix so a fifth recurrence does not happen.
 */

/** Pure: given a set of raw event rows (already fetched, any shape carrying these three
 * fields), returns the set of ids that some OTHER row in the same set reverses. Does not
 * require a second query when the caller's own query already selected `correctionType`/
 * `correctsEventId` alongside whatever else it needs. */
export function findReversedEventIds<T extends { id: string; correctionType: string | null; correctsEventId: string | null }>(
  events: readonly T[],
): Set<string> {
  const reversed = new Set<string>();
  for (const event of events) {
    if (event.correctionType === "REVERSAL" && event.correctsEventId) {
      reversed.add(event.correctsEventId);
    }
  }
  return reversed;
}

/** DB-bound: a dedicated reversal-rows-only query, for a caller whose own query already
 * narrowed to specific event types (and therefore cannot see the `EVENT_REVERSED` marker rows
 * in its own result set) — mirrors the pattern League's `report-mutations.ts` already used. */
export async function getLeagueReversedEventIds(matchId: string, organisationId: string): Promise<Set<string>> {
  const reversalRows = await db.liveMatchEvent.findMany({
    where: { matchId, organisationId, eventType: "EVENT_REVERSED", correctsEventId: { not: null } },
    select: { correctsEventId: true },
  });
  return new Set(reversalRows.map((r) => r.correctsEventId as string));
}

/** Event equivalent of `getLeagueReversedEventIds()`, against `EventLiveMatchEvent`. */
export async function getEventReversedEventIds(eventMatchId: string, organisationId: string): Promise<Set<string>> {
  const reversalRows = await db.eventLiveMatchEvent.findMany({
    where: { eventMatchId, organisationId, eventType: "EVENT_REVERSED", correctsEventId: { not: null } },
    select: { correctsEventId: true },
  });
  return new Set(reversalRows.map((r) => r.correctsEventId as string));
}
