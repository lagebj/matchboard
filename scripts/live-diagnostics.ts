/**
 * ADR-0138 Bundle 9 (OBSERVABILITY_RECOVERY_ROLLOUT.md §4, §8) — two related read-only
 * diagnostics:
 *
 * 1. "Projection divergence diagnostic" (§4) — replays one match's canonical live-event stream
 *    through the shared reducer (`reduceLiveEvents()`, Bundle 5) and compares it against the
 *    corresponding materialized post-match report score.
 * 2. "Production cutover checklist" (§8) — "no active legacy League/Event sessions" — lists any
 *    currently-ACTIVE session with unsequenced (pre-coordinator) history.
 *
 * Neither writes to Neon or mutates a report/session.
 *
 * Usage:
 *   npx tsx scripts/live-diagnostics.ts --league <matchId>
 *   npx tsx scripts/live-diagnostics.ts --event <eventMatchId>
 *   npx tsx scripts/live-diagnostics.ts --cutover-check
 *
 * Output is JSON on stdout (ids/counts only — never player names, per both diagnostics' own
 * scope rule). Exit code is 0 always (this is a report, not an assertion) — a caller wanting to
 * fail a check on divergence/legacy sessions should inspect the printed fields itself.
 */
import "dotenv/config";
import {
  checkLeagueProjectionDivergence,
  checkEventProjectionDivergence,
} from "@/lib/live-match/projection-divergence-diagnostic";
import { checkActiveLegacySessions } from "@/lib/live-match/legacy-session-cutover-check";

async function main() {
  const args = process.argv.slice(2);
  const leagueIndex = args.indexOf("--league");
  const eventIndex = args.indexOf("--event");

  if (args.includes("--cutover-check")) {
    const result = await checkActiveLegacySessions();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (leagueIndex !== -1 && args[leagueIndex + 1]) {
    const result = await checkLeagueProjectionDivergence(args[leagueIndex + 1]);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (eventIndex !== -1 && args[eventIndex + 1]) {
    const result = await checkEventProjectionDivergence(args[eventIndex + 1]);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(
    "Usage: npx tsx scripts/live-diagnostics.ts --league <matchId> | --event <eventMatchId> | --cutover-check",
  );
  process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
