/**
 * One-time, opt-in backfill (ADR-0121, resolving the historical half of ARR-0041).
 *
 * `finalizeRoundRecord()` now freezes a per-round `Availability` snapshot when a round's
 * planning boundary closes, so every round finalized from ADR-0121 onward has accurate
 * historical availability. Rounds finalized *before* ADR-0121 have no snapshot — historical
 * readers (`compute-plan-integrity.ts`'s `repeatedContext`, `get-planning-period-fairness.ts`'s
 * "unavailable rounds excluded from fairness debt", the Insights `opportunity-*`/`load-timeline`
 * surfaces) treat them as "no data" and assert nothing, which is safe but loses recoverable
 * signal.
 *
 * This script recovers the *provable* subset: a player who held a FINALIZED `Selection` in a
 * past round was, by definition, available enough to be planned, so it writes an `AVAILABLE`
 * row for them. Players who were NOT selected are left with no row — we genuinely cannot
 * reconstruct whether they were available and omitted, or simply unavailable, so we do not
 * guess (writing their *current* availability would stamp "now" onto history — the exact bug
 * ADR-0121 exists to prevent). A manual override that planned a player despite an unavailable
 * mark is a rare exception this heuristic accepts; live capture (all future rounds) reads the
 * real `Player.currentAvailability` and has no such approximation.
 *
 * Idempotent: a round that already has any `Availability` row is skipped entirely.
 *
 * Usage:
 *   npx tsx scripts/backfill-round-availability.ts            # apply
 *   npx tsx scripts/backfill-round-availability.ts --dry-run  # report only, no writes
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const organisations = await db.organisation.findMany({ select: { id: true, name: true } });

  let totalRounds = 0;
  let totalRowsWritten = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const rounds = await db.matchRound.findMany({
        where: {
          organisationId: org.id,
          status: "FINALIZED",
          availabilities: { none: {} },
        },
        select: { id: true, name: true },
      });

      if (rounds.length === 0) return;

      for (const round of rounds) {
        const selected = await db.selection.findMany({
          where: { matchRoundId: round.id, status: "FINALIZED" },
          select: { playerId: true, player: { select: { removedAt: true } } },
          distinct: ["playerId"],
        });
        const playerIds = selected.filter((s) => s.player.removedAt == null).map((s) => s.playerId);

        totalRounds++;
        console.log(
          `[${org.name}] round "${round.name}": ${playerIds.length} finalized-selection player(s) -> AVAILABLE`,
        );

        if (dryRun || playerIds.length === 0) continue;

        const res = await db.availability.createMany({
          data: playerIds.map((playerId) => ({
            playerId,
            matchRoundId: round.id,
            status: "AVAILABLE" as const,
            organisationId: org.id,
          })),
          skipDuplicates: true,
        });
        totalRowsWritten += res.count;
      }
    });
  }

  console.log(`\nFINALIZED rounds without a snapshot: ${totalRounds}`);
  if (dryRun) {
    console.log("Dry run — no writes performed.");
  } else {
    console.log(`Availability rows written: ${totalRowsWritten}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
