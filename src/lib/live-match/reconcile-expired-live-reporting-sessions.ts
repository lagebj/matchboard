/**
 * ADR-0146 §7 — server-side reconciliation for the absolute Live Reporting safety limit. The
 * hard 270-minute fail-safe must work with no browser open (§3/§11 of the architecture
 * contract): a coach who forgets to press "Finish live reporting", loses their device, or
 * abandons a match must not leave the session `ACTIVE` forever. This is the one place the
 * `TIMEOUT` trigger of `finishLiveReporting` is ever invoked — scheduled cadence lives in
 * `src/app/api/cron/live-reporting-reconciliation/route.ts` (§7/§12: "approximately every five
 * minutes").
 *
 * Eligibility is anchored only to the session's own actual `startedAt` — never
 * `Match.startsAt`/`EventMatch.startsAt` (D2: scheduled kickoff has no authority over automatic
 * Live Reporting closure). `LiveMatchSession`/`EventLiveMatchSession` are RLS-scoped tables, so
 * finding every eligible session across every organisation needs the same explicit
 * `runWithSystemPrivilege()` opt-in this repo's other genuinely cross-tenant reads already use
 * (`legacy-session-cutover-check.ts`, `projection-divergence-diagnostic.ts`) — read-only, and
 * only for this one eligibility query. Every actual write (`finishLiveReporting` itself) runs
 * per-session under that session's own `organisationId`, tenant-scoped normally.
 *
 * Deliberately no `import "server-only"` here (matching `legacy-session-cutover-check.ts`'s own
 * exact reasoning) — `finishLiveReporting`, which this always calls, already carries that guard,
 * so nothing about transitive client-bundle safety depends on repeating it here too.
 */

import { db } from "@/lib/db";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { logger } from "@/lib/logger";
import { finishLiveReporting } from "./finish-live-reporting";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";
import { LIVE_REPORTING_AUTO_FINISH_MINUTES } from "./live-reporting-guardrails";

/** Matches `processOutboxBatch`'s own existing bounded-batch convention (`src/lib/email/outbox.ts`)
 * — no established project standard beyond "around 100" (bundle §04.13). */
const BATCH_SIZE = 100;

export interface ReconciliationOutcome {
  /** A session that reached completion via this reconciliation call, whether it had an active
   * period to recover or not. */
  finished: { subjectType: "LEAGUE" | "EVENT"; sessionId: string; matchId: string }[];
  /** A session `finishLiveReporting` failed to complete — logged, left `ACTIVE`, eligible again
   * next run (§7/§13: "one failure does not block the rest"). */
  failed: { subjectType: "LEAGUE" | "EVENT"; sessionId: string; matchId: string; error: string }[];
}

interface EligibleLeagueSession {
  id: string;
  matchId: string;
  organisationId: string;
  startedAt: Date;
}

interface EligibleEventSession {
  id: string;
  eventMatchId: string;
  organisationId: string;
  startedAt: Date;
}

async function findEligibleLeagueSessionsUnscoped(cutoff: Date): Promise<EligibleLeagueSession[]> {
  return db.liveMatchSession.findMany({
    where: { status: "ACTIVE", startedAt: { lte: cutoff } },
    select: { id: true, matchId: true, organisationId: true, startedAt: true },
    orderBy: { startedAt: "asc" },
    take: BATCH_SIZE,
  });
}

async function findEligibleEventSessionsUnscoped(cutoff: Date): Promise<EligibleEventSession[]> {
  return db.eventLiveMatchSession.findMany({
    where: { status: "ACTIVE", startedAt: { lte: cutoff } },
    select: { id: true, eventMatchId: true, organisationId: true, startedAt: true },
    orderBy: { startedAt: "asc" },
    take: BATCH_SIZE,
  });
}

/**
 * Finds every League/Event Live Reporting session that has been `ACTIVE` for at least
 * `LIVE_REPORTING_AUTO_FINISH_MINUTES` (270) and runs `finishLiveReporting(ref, "TIMEOUT", ...)`
 * on each, independently. A failure on one session is caught, logged, and does not stop the
 * batch — it simply remains `ACTIVE` and eligible again on the next scheduled run.
 */
export async function reconcileExpiredLiveReportingSessions(): Promise<ReconciliationOutcome> {
  const cutoff = new Date(Date.now() - LIVE_REPORTING_AUTO_FINISH_MINUTES * 60 * 1000);

  const { leagueSessions, eventSessions } = await runWithSystemPrivilege(
    "live-reporting-reconciliation-eligibility-scan",
    async () => {
      const [leagueSessions, eventSessions] = await Promise.all([
        findEligibleLeagueSessionsUnscoped(cutoff),
        findEligibleEventSessionsUnscoped(cutoff),
      ]);
      return { leagueSessions, eventSessions };
    },
  );

  const outcome: ReconciliationOutcome = { finished: [], failed: [] };

  for (const session of leagueSessions) {
    try {
      await runWithTenantOrganisationId(session.organisationId, async () => {
        const ref = await buildLeagueMatchRef(session.matchId);
        await finishLiveReporting(ref, "TIMEOUT", { organisationId: session.organisationId });
      });
      outcome.finished.push({ subjectType: "LEAGUE", sessionId: session.id, matchId: session.matchId });
      logger.info(
        {
          matchId: session.matchId,
          sessionId: session.id,
          liveReportingStartedAt: session.startedAt.toISOString(),
          finishAttemptAt: new Date().toISOString(),
          elapsedLiveReportingDurationMs: Date.now() - session.startedAt.getTime(),
          trigger: "TIMEOUT",
          success: true,
        },
        "[live-reporting-reconciliation] League session finished",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outcome.failed.push({ subjectType: "LEAGUE", sessionId: session.id, matchId: session.matchId, error: message });
      logger.error(
        { err, matchId: session.matchId, sessionId: session.id, trigger: "TIMEOUT", success: false },
        "[live-reporting-reconciliation] League session finish failed; remains ACTIVE, eligible next run",
      );
    }
  }

  for (const session of eventSessions) {
    try {
      await runWithTenantOrganisationId(session.organisationId, async () => {
        const ref = await buildEventMatchRef(session.eventMatchId);
        await finishLiveReporting(ref, "TIMEOUT", { organisationId: session.organisationId });
      });
      outcome.finished.push({ subjectType: "EVENT", sessionId: session.id, matchId: session.eventMatchId });
      logger.info(
        {
          eventMatchId: session.eventMatchId,
          sessionId: session.id,
          liveReportingStartedAt: session.startedAt.toISOString(),
          finishAttemptAt: new Date().toISOString(),
          elapsedLiveReportingDurationMs: Date.now() - session.startedAt.getTime(),
          trigger: "TIMEOUT",
          success: true,
        },
        "[live-reporting-reconciliation] Event session finished",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outcome.failed.push({ subjectType: "EVENT", sessionId: session.id, matchId: session.eventMatchId, error: message });
      logger.error(
        { err, eventMatchId: session.eventMatchId, sessionId: session.id, trigger: "TIMEOUT", success: false },
        "[live-reporting-reconciliation] Event session finish failed; remains ACTIVE, eligible next run",
      );
    }
  }

  return outcome;
}
