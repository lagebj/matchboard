/**
 * One-time backfill (ADR-0109, Migration Rule #5/#19): captures the planned baseline for every
 * existing match whose scheduled kickoff has already passed but whose `planningClosedAt` is
 * still null.
 *
 * `planningClosedAt` was added the same day this programme starts, so every pre-existing match
 * has it null — including ones already played. Going forward, `ensureMatchPlanningBaselineCaptured()`
 * captures this lazily the next time a coach interacts with the match/round, but a match nobody
 * ever revisits again would otherwise silently keep DRAFT selections that fairness/evidence
 * queries filtering on `Selection.status === "FINALIZED"` would wrongly exclude. This script
 * closes that gap once, immediately, for all existing data, without waiting on a lazy trigger.
 *
 * Idempotent and safe to re-run: `ensureMatchPlanningBaselineCaptured()` is a no-op for any match
 * that already has `planningClosedAt` set (including one this script itself already processed).
 *
 * Usage:
 *   npx tsx scripts/backfill-match-planning-baseline.ts            # apply
 *   npx tsx scripts/backfill-match-planning-baseline.ts --dry-run  # report only, no writes
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { ensureMatchPlanningBaselineCaptured } from "@/lib/selection/capture-planning-baseline";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const now = new Date();

  const organisations = await db.organisation.findMany({ select: { id: true, name: true } });

  let totalCandidates = 0;
  let totalCaptured = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const candidates = await db.match.findMany({
        where: {
          organisationId: org.id,
          status: { not: "CANCELLED" },
          planningClosedAt: null,
          startsAt: { lte: now },
        },
        select: { id: true, startsAt: true, matchRoundId: true },
      });

      if (candidates.length === 0) return;

      totalCandidates += candidates.length;
      console.log(`[${org.name}] ${candidates.length} past match(es) with no captured baseline.`);

      if (dryRun) return;

      for (const match of candidates) {
        const result = await ensureMatchPlanningBaselineCaptured(match.id, { now });
        if (result.captured) totalCaptured++;
      }
    });
  }

  console.log(`\nCandidates found: ${totalCandidates}`);
  if (dryRun) {
    console.log("Dry run — no writes performed.");
  } else {
    console.log(`Baselines captured: ${totalCaptured}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
