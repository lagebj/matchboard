/**
 * One-time, opt-in backfill (ADR-0138, Bundle 2 — "Canonical Live Operations &
 * Delayed-Concurrency" programme).
 *
 * Establishes deterministic historical replay order for existing `LiveMatchEvent`/
 * `EventLiveMatchEvent` rows written before the persisted canonical `sequence` column existed —
 * every row predating this migration, and any row written via the direct-HTTP path that
 * bypasses the Durable Object coordinator entirely (ARR-0045, still active until Bundle 4's
 * single-mutation-path cutover). This does **not** prove original realtime acceptance order —
 * it is deterministic historical reconstruction only, exactly as `PROTOCOL_SCHEMA_MIGRATION.md`
 * §4 documents. Strong sequence guarantees begin at protocol v2 cutover, for events actually
 * assigned a sequence by the coordinator.
 *
 * Per session: an existing non-null `sequence` is never touched. Null-sequence rows are
 * assigned sequential integers starting just after the highest existing sequence already
 * present in that session, ordered by `(createdAt asc, id asc)` as the stable tie-breaker — the
 * same rule `evaluateReconciliation()` (`workers/live-match/src/state.ts`) uses for a
 * newly-discovered sequence-less row, so a backfilled session and a freshly-reconciled one order
 * identically.
 *
 * Idempotent: rerunning finds no remaining null-sequence rows and writes nothing. Never mutates
 * a locked report or any other historical fact beyond this one column.
 *
 * Not run automatically by any deploy or migration — run it deliberately when ready to accept
 * deterministic (not proven-original) historical ordering for existing sessions, matching the
 * same opt-in convention as `backfill-round-availability.ts`/`backfill-stale-round-finalization.ts`.
 *
 * Usage:
 *   npx tsx scripts/backfill-live-event-sequence.ts            # apply
 *   npx tsx scripts/backfill-live-event-sequence.ts --dry-run  # report only, no writes
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

interface BackfillTotals {
  sessions: number;
  rows: number;
}

async function backfillLeague(dryRun: boolean): Promise<BackfillTotals> {
  const organisations = await db.organisation.findMany({ select: { id: true } });
  let sessions = 0;
  let rows = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const sessionsWithGaps = await db.liveMatchSession.findMany({
        where: { organisationId: org.id, events: { some: { sequence: null } } },
        select: { id: true },
      });

      for (const session of sessionsWithGaps) {
        sessions++;

        const [maxSequence, nullSequenceEvents] = await Promise.all([
          db.liveMatchEvent.aggregate({
            where: { sessionId: session.id, sequence: { not: null } },
            _max: { sequence: true },
          }),
          db.liveMatchEvent.findMany({
            where: { sessionId: session.id, sequence: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true },
          }),
        ]);

        if (dryRun) {
          rows += nullSequenceEvents.length;
          continue;
        }

        let next = (maxSequence._max.sequence ?? 0) + 1;
        for (const event of nullSequenceEvents) {
          await db.liveMatchEvent.update({ where: { id: event.id }, data: { sequence: next } });
          next += 1;
          rows += 1;
        }
      }
    });
  }

  return { sessions, rows };
}

async function backfillEvent(dryRun: boolean): Promise<BackfillTotals> {
  const organisations = await db.organisation.findMany({ select: { id: true } });
  let sessions = 0;
  let rows = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const sessionsWithGaps = await db.eventLiveMatchSession.findMany({
        where: { organisationId: org.id, events: { some: { sequence: null } } },
        select: { id: true },
      });

      for (const session of sessionsWithGaps) {
        sessions++;

        const [maxSequence, nullSequenceEvents] = await Promise.all([
          db.eventLiveMatchEvent.aggregate({
            where: { sessionId: session.id, sequence: { not: null } },
            _max: { sequence: true },
          }),
          db.eventLiveMatchEvent.findMany({
            where: { sessionId: session.id, sequence: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true },
          }),
        ]);

        if (dryRun) {
          rows += nullSequenceEvents.length;
          continue;
        }

        let next = (maxSequence._max.sequence ?? 0) + 1;
        for (const event of nullSequenceEvents) {
          await db.eventLiveMatchEvent.update({ where: { id: event.id }, data: { sequence: next } });
          next += 1;
          rows += 1;
        }
      }
    });
  }

  return { sessions, rows };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const league = await backfillLeague(dryRun);
  const event = await backfillEvent(dryRun);

  console.log(`\nLeague sessions with a sequence gap: ${league.sessions}`);
  console.log(`Event sessions with a sequence gap: ${event.sessions}`);
  if (dryRun) {
    console.log(`Dry run — ${league.rows + event.rows} row(s) would be assigned a deterministic sequence. No writes performed.`);
  } else {
    console.log(`Sequence values written: ${league.rows + event.rows}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
