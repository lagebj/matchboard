/**
 * One-time production repair (2026-09-17 live-reporting incident, Hvit vs Graabein City).
 *
 * Incident: the coach's "Finish live reporting" flow blocked on the local outbox
 * (2 commands stuck in an unresolved state — the MATCH_END recorded at the final period
 * transition, plus an accidental rotation "Undo"). Server-side, the MATCH_END event HAD
 * reached canonical persistence (sequence 37 in Neon), and the accidental rotation-undo
 * (an EVENT_REVERSED) never did — which is exactly the outcome the coach wanted anyway
 * (the rotation was correct and must stand; confirmed by the coach). But the client's
 * guard (`handleEndSession`) correctly refuses to call `endSession` while the local
 * outbox has unresolved commands, and the confirmation broadcasts never arrived before
 * the realtime connection was gone — leaving the session ACTIVE, the DRAFT report
 * unseeded, and the coach unable to finish from any device.
 *
 * Root cause (product bug, to be fixed separately in code): the end-of-match flow
 * records MATCH_END and attempts the session end through different channels, and a
 * disconnect between the MATCH_END persistence confirmation and the finish action can
 * wedge the local outbox permanently. This script is the DATA repair only.
 *
 * What this script does (mirroring `endLiveSessionAndCreateReportAction` exactly):
 *   1. Ends the LiveMatchSession (status ACTIVE -> ENDED, endedAt = now) — the same
 *      write `endLiveSession()` performs, done here directly because that function
 *      requires an authenticated actor context.
 *   2. Calls the REAL domain function `seedReportFromLiveSession(matchId, organisationId)`
 *      — not a hand-rolled SQL reimplementation — so the DRAFT report merge is
 *      byte-identical to what the normal flow would have produced (score, PRESENT
 *      attendance for appeared players, LIVE-sourced rotations; merge-safe per
 *      ADR-0133 H1).
 *
 * Explicitly NOT done, with reasons:
 *   - No EVENT_REVERSED is inserted for the accidental rotation undo: it never reached
 *     the server, and the coach confirmed the rotation was correct and must stand.
 *   - No LiveMatchEvent row is modified, deleted, or invented: the canonical event
 *     stream in Neon is already correct (MATCH_END included, no reversal).
 *
 * Idempotent: re-running finds the session already ENDED (skips step 1) and the seed
 * function's own merge guards make step 2 a no-op (counts before creates).
 *
 * Usage (production, deliberate one-off):
 *   DATABASE_URL="$PRODUCTION_DATABASE_URL" npx tsx scripts/repair-stuck-live-session.ts \
 *     --match cmsfxxjlf000504l7w09hn7ac --org <organisationId> [--dry-run]
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { seedReportFromLiveSession } from "@/lib/reports/report-mutations";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

interface Args {
  matchId: string;
  organisationId: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let matchId: string | undefined;
  let organisationId: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--match") matchId = argv[++i];
    else if (argv[i] === "--org") organisationId = argv[++i];
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  if (!matchId || !organisationId) {
    console.error("Usage: --match <matchId> --org <organisationId> [--dry-run]");
    process.exit(1);
  }
  return { matchId, organisationId, dryRun };
}

async function main(): Promise<void> {
  const { matchId, organisationId, dryRun } = parseArgs();

  // ADR-0087 tenant-RLS: every query below is organisation-scoped through the trusted
  // context, exactly like the domain functions' own callers do.
  await runWithTenantOrganisationId(organisationId, async () => {

  // Cross-check the match belongs to the given organisation before touching anything.
  const match = await db.match.findFirst({
    where: { id: matchId, organisationId },
    select: { id: true, opponent: true, homeAway: true },
  });
  if (!match) {
    console.error(`Match ${matchId} not found for organisation ${organisationId} — refusing.`);
    process.exit(1);
  }

  const session = await db.liveMatchSession.findFirst({
    where: { matchId, organisationId },
    select: { id: true, status: true, startedAt: true },
    orderBy: { startedAt: "desc" },
  });
  if (!session) {
    console.error(`No LiveMatchSession found for match ${matchId} — nothing to repair.`);
    process.exit(1);
  }

  // Evidence check: the terminal MATCH_END must already be canonically persisted —
  // this repair must never invent a match end that was never recorded.
  const matchEnd = await db.liveMatchEvent.findFirst({
    where: { sessionId: session.id, eventType: "MATCH_END" },
    select: { id: true, sequence: true, createdAt: true },
  });
  if (!matchEnd) {
    console.error(`No persisted MATCH_END event for session ${session.id} — refusing to end a match that was never ended.`);
    process.exit(1);
  }
  console.log(`MATCH_END verified persisted (sequence=${matchEnd.sequence}, createdAt=${matchEnd.createdAt.toISOString()}).`);

  if (dryRun) {
    console.log(`[dry-run] Would end session ${session.id} (status=${session.status}) and seed the report for match ${matchId} (${match.opponent}, ${match.homeAway}).`);
    return;
  }

  if (session.status === "ACTIVE") {
    await db.liveMatchSession.update({
      where: { id: session.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    console.log(`Session ${session.id} ended (ACTIVE -> ENDED).`);
  } else {
    console.log(`Session ${session.id} already ${session.status} — skipping end.`);
  }

  const seed = await seedReportFromLiveSession(matchId, organisationId);
  if (!seed.success) {
    console.error(`Seed failed: ${seed.error}`);
    process.exit(1);
  }
  console.log(`Report seeded: reportId=${seed.reportId}, status=${seed.status}, alreadyExisted=${seed.alreadyExisted}, merged=${seed.merged}.`);

  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });