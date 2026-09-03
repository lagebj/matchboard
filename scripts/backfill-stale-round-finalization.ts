/**
 * One-time correction (ADR-0109 residue): reverts a `MatchRound.status` of "FINALIZED" — and the
 * `Selection`/`MovementLedger` rows finalized alongside it — that was set by the coach-operated
 * "Finalize round" action that existed *before* ADR-0109 replaced it with automatic,
 * boundary-driven capture.
 *
 * Before ADR-0109, a coach could finalize a round at will, regardless of whether its matches had
 * actually been played. ADR-0109's migration correctly stopped writing new finalizations that
 * way, and `backfill-match-planning-baseline.ts` correctly *captured* the baseline for matches
 * that had already genuinely passed kickoff — but neither step went back and corrected a
 * `MatchRound` that was finalized *early* under the old model, whose matches never actually
 * reached their real planning boundary. Those rounds are stuck showing "Planning closed" and
 * refusing all draft edits forever, even though `planningClosedAt` was never set on any of their
 * matches — a real, observed production bug (a newly registered player could not be added to any
 * remaining round in an active season).
 *
 * Detection: a FINALIZED `MatchRound` where at least one of its non-cancelled matches has
 * `planningClosedAt IS NULL` (i.e. that match's boundary never actually closed) is stale.
 *
 * Correction, per stale round:
 *   - For each of its matches with `planningClosedAt IS NULL`, revert that match's FINALIZED
 *     Selections/MovementLedger entries back to DRAFT (`unfinalizeSelectionsForScope`) — a match
 *     that genuinely already closed (planningClosedAt set) is left untouched, selections and all.
 *   - Revert the round record itself back to DRAFT (`unfinalizeRoundRecord`) — a round is only
 *     validly FINALIZED once every one of its matches has actually closed.
 *
 * This reuses the exact same writers `reopenMatchPlanningForReschedule()` uses for a genuine
 * reschedule (`round-finalization-transitions.ts`), just applied in bulk across every match that
 * never actually closed, instead of one match at a time via the UI.
 *
 * Idempotent and safe to re-run: a round with no matches missing `planningClosedAt` is skipped as
 * already-correct (including one this script itself already corrected).
 *
 * Usage:
 *   npx tsx scripts/backfill-stale-round-finalization.ts            # apply
 *   npx tsx scripts/backfill-stale-round-finalization.ts --dry-run  # report only, no writes
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { unfinalizeSelectionsForScope, unfinalizeRoundRecord } from "@/lib/selection/round-finalization-transitions";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const organisations = await db.organisation.findMany({ select: { id: true, name: true } });

  let roundsExamined = 0;
  let roundsCorrected = 0;
  let matchesReverted = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const finalizedRounds = await db.matchRound.findMany({
        where: { organisationId: org.id, status: "FINALIZED" },
        select: {
          id: true,
          name: true,
          matches: {
            where: { status: { not: "CANCELLED" } },
            select: { id: true, planningClosedAt: true },
          },
        },
      });

      for (const round of finalizedRounds) {
        roundsExamined++;

        const neverClosedMatches = round.matches.filter((m) => m.planningClosedAt === null);
        if (neverClosedMatches.length === 0) continue; // genuinely, fully closed — correct as-is

        console.log(
          `[${org.name}] Round "${round.name}" (${round.id}): ${neverClosedMatches.length}/${round.matches.length} match(es) never actually reached their planning boundary.`,
        );
        roundsCorrected++;
        matchesReverted += neverClosedMatches.length;

        if (dryRun) continue;

        await db.$transaction(async (tx) => {
          for (const match of neverClosedMatches) {
            await unfinalizeSelectionsForScope(tx, { matchId: match.id });
          }
          await unfinalizeRoundRecord(tx, round.id);
        });
      }
    });
  }

  console.log(`\nRounds examined (persisted FINALIZED): ${roundsExamined}`);
  console.log(`Rounds corrected: ${roundsCorrected}`);
  if (dryRun) {
    console.log(`Matches that would be reverted to draft: ${matchesReverted}`);
    console.log("Dry run — no writes performed.");
  } else {
    console.log(`Matches reverted to draft: ${matchesReverted}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
