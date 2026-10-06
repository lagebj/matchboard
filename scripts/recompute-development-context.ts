/**
 * Development-context-and-evidence batch recompute (ADR-0155 step B4, source bundle §05's
 * "Batch commands"). A dedicated, narrow recompute -- it only replaces `DerivedMeasurement`
 * rows via `persistMatchContextPack()`, never the other `runPostMatchLearning()` steps
 * (opponent/player-evidence/combinations/position-evolution), which have their own side effects
 * a coach fixing a development-context-specific data issue should not have to also trigger.
 * (`scripts/remediate-*.ts` and `replayPostMatchLearningHistory()` remain the right tool when a
 * full post-match-learning re-run is actually what's wanted.)
 *
 * Idempotent and safe to rerun: persistMatchContextPack() always replaces a match's current
 * rows wholesale.
 *
 * A bare CLI invocation has no ambient request/actor tenant context, so every RLS-scoped query
 * below runs inside an explicit tenant or system-privilege wrap (ADR-0087) -- `--match`/
 * `--event-match`/`--player` don't know their target's organisation up front, so resolving and
 * recomputing for those runs under `runWithSystemPrivilege()`; `--all-completed` already knows
 * each ref's organisation from its own per-org loop, so it uses the tighter
 * `runWithTenantOrganisationId()` instead.
 *
 * Usage:
 *   npx tsx scripts/recompute-development-context.ts --match <matchId>
 *   npx tsx scripts/recompute-development-context.ts --event-match <eventMatchId>
 *   npx tsx scripts/recompute-development-context.ts --player <playerId>
 *   npx tsx scripts/recompute-development-context.ts --all-completed
 *   # add --dry-run to any of the above to report the match refs that would be recomputed
 *   # without writing anything.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";
import { getEligibleCompletedMatchRefs } from "@/lib/evidence/post-match-learning-replay";
import { footballMatchRefSourceId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { persistMatchContextPack } from "@/lib/development-context/persist-match-context";

const SYSTEM_PRIVILEGE_REASON = "development-context-recompute-cli";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function refsForPlayer(playerId: string): Promise<FootballMatchRef[]> {
  const [leagueRows, eventRows] = await Promise.all([
    db.actualPositionInterval.findMany({
      where: { playerId, matchId: { not: null } },
      select: { matchId: true },
      distinct: ["matchId"],
    }),
    db.actualPositionInterval.findMany({
      where: { playerId, eventMatchId: { not: null } },
      select: { eventMatchId: true },
      distinct: ["eventMatchId"],
    }),
  ]);

  const leagueRefs = await Promise.all(leagueRows.map((r) => buildLeagueMatchRef(r.matchId!)));
  const eventRefs = await Promise.all(eventRows.map((r) => buildEventMatchRef(r.eventMatchId!)));
  return [...leagueRefs, ...eventRefs];
}

/** Each ref's organisation is already known from its own per-org loop. */
async function recomputeAllCompleted(dryRun: boolean): Promise<{ matches: number; measurements: number }> {
  const organisations = await db.organisation.findMany({ select: { id: true } });
  let matches = 0;
  let measurements = 0;

  for (const org of organisations) {
    await runWithTenantOrganisationId(org.id, async () => {
      const refs = await getEligibleCompletedMatchRefs(org.id);
      for (const ref of refs) {
        matches++;
        if (dryRun) {
          console.log(`  [dry-run] ${ref.kind} ${footballMatchRefSourceId(ref)}`);
          continue;
        }
        const outcome = await persistMatchContextPack(ref);
        measurements += outcome.measurementsWritten;
        console.log(`  ${ref.kind} ${footballMatchRefSourceId(ref)}: ${outcome.measurementsWritten} measurement(s).`);
      }
    });
  }
  return { matches, measurements };
}

/** The target's organisation isn't known up front -- resolve and recompute under system privilege. */
async function recomputeTargeted(refs: FootballMatchRef[], dryRun: boolean): Promise<{ matches: number; measurements: number }> {
  let measurements = 0;
  await runWithSystemPrivilege(SYSTEM_PRIVILEGE_REASON, async () => {
    for (const ref of refs) {
      if (dryRun) {
        console.log(`  [dry-run] ${ref.kind} ${footballMatchRefSourceId(ref)}`);
        continue;
      }
      const outcome = await persistMatchContextPack(ref);
      measurements += outcome.measurementsWritten;
      console.log(`  ${ref.kind} ${footballMatchRefSourceId(ref)}: ${outcome.measurementsWritten} measurement(s).`);
    }
  });
  return { matches: refs.length, measurements };
}

async function main() {
  const matchId = parseArg("--match");
  const eventMatchId = parseArg("--event-match");
  const playerId = parseArg("--player");
  const allCompleted = process.argv.includes("--all-completed");
  const dryRun = process.argv.includes("--dry-run");

  const selected = [matchId, eventMatchId, playerId, allCompleted].filter(Boolean).length;
  if (selected !== 1) {
    console.error(
      "Usage: npx tsx scripts/recompute-development-context.ts (--match <id> | --event-match <id> | --player <id> | --all-completed) [--dry-run]",
    );
    process.exit(1);
  }

  let result: { matches: number; measurements: number };
  if (allCompleted) {
    // db.organisation.findMany() is RLS-exempt (Organisation is not scoped by itself); every
    // per-org query inside the loop runs under its own runWithTenantOrganisationId() already.
    result = await recomputeAllCompleted(dryRun);
  } else {
    result = await runWithSystemPrivilege(SYSTEM_PRIVILEGE_REASON, async () => {
      let refs: FootballMatchRef[];
      if (matchId) {
        refs = [await buildLeagueMatchRef(matchId)];
      } else if (eventMatchId) {
        refs = [await buildEventMatchRef(eventMatchId)];
      } else {
        refs = await refsForPlayer(playerId!);
      }
      console.log(`${refs.length} match ref(s) to recompute.`);
      return recomputeTargeted(refs, dryRun);
    });
  }

  if (dryRun) {
    console.log("Dry run — no writes performed.");
    return;
  }

  console.log(`\nMatches processed: ${result.matches}`);
  console.log(`Total measurements written: ${result.measurements}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
