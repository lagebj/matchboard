import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { triggerAiCapability } from "@/lib/ai/jobs/triggers";
import { formatIsoWeekKey } from "@/lib/date-utils";
import { buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";
import {
  buildDevelopmentCycleScopeId,
  parseDevelopmentCycleScopeId,
  DEVELOPMENT_CYCLE_WINDOW_DAYS,
} from "@/lib/ai/context/development-cycle-review";

/**
 * Cron-scheduled discovery for capabilities with no domain-mutation trigger
 * (07_EXECUTION_PIPELINE.md "Domain triggers": "Match preparation and weekly review are
 * cron-scheduled" / "A worker run: 1. enqueues due match preparation jobs; 2. enqueues
 * previous-week team reviews; 3. claims eligible jobs atomically ..."). Called from the
 * `/api/cron/ai` route before `processAiJobsBatch()` claims and executes the queue.
 *
 * Scans every organisation's fixtures (cross-tenant by nature — a cron sweep, not a
 * single-tenant request — hence `runWithSystemPrivilege`), then re-enters a per-organisation
 * tenant context for each match before calling `triggerAiCapability`, matching the runner's own
 * `runWithTenantOrganisationId(job.organisationId, ...)` convention for cross-tenant workers.
 * `triggerAiCapability` itself still re-checks AI/capability enablement, domain eligibility (a
 * complete plan exists — `match-prep.ts`'s `buildContext`), and the fingerprint/dedup rule before
 * enqueueing anything, so this scan only needs to supply the *candidate* scope, not re-derive
 * eligibility.
 */
const MATCH_PREP_WINDOW_HOURS = 24;

export async function enqueueDueMatchPrepJobs(): Promise<{ scanned: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + MATCH_PREP_WINDOW_HOURS * 60 * 60 * 1000);

  // ARR-0029 Bug 2: the callback must `await` the query *inside* itself -- returning the bare
  // lazy PrismaPromise from a non-async callback exits `run()` before the extension ever
  // dispatches the query, so `getSystemPrivilegeReason()` reads as unset by the time it matters.
  const dueMatches = await runWithSystemPrivilege("ai-match-prep-scan", async () => {
    return await db.match.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: now, lte: windowEnd } },
      select: { id: true, organisationId: true },
    });
  });

  for (const match of dueMatches) {
    try {
      await runWithTenantOrganisationId(match.organisationId, () =>
        triggerAiCapability({
          organisationId: match.organisationId,
          capability: "MATCH_PREP",
          scopeType: "MATCH",
          scopeId: match.id,
        }),
      );
    } catch (error) {
      // triggerAiCapability itself never throws (it logs and swallows) — this catch is
      // defensive only, so one match's unexpected failure can never abort the whole scan.
      logger.warn({ err: error, matchId: match.id, organisationId: match.organisationId }, "[ai/jobs/scheduled-triggers] Failed to enqueue match_prep");
    }
  }

  return { scanned: dueMatches.length };
}

/**
 * "Once for the previous completed ISO week" (06_AI_CAPABILITY_CONTRACTS.md "5.
 * weekly_team_review") is not a separate guard here: this scan runs every cron cycle and always
 * targets the same, single previous-week `scopeId` per team until that week ends and the next
 * one becomes "previous" — `triggerAiCapability`'s existing SUCCEEDED-review fingerprint check
 * (`enqueue.ts`) already prevents re-enqueueing once a review has succeeded for that exact
 * scope+fingerprint, and the week's underlying facts (and therefore its fingerprint) stop
 * changing once the week's matches are in the past. No new per-team "already ran this week" flag
 * was needed.
 */
/** Exported so the weekly Advisor presentation layer targets the exact same "previous completed
 * ISO week" the cron scan enqueues reviews for — a single shared definition of "previous week". */
export function previousCompletedIsoWeekKey(now: Date): string {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return formatIsoWeekKey(sevenDaysAgo);
}

export async function enqueueDueWeeklyTeamReviewJobs(): Promise<{ scanned: number }> {
  const weekKey = previousCompletedIsoWeekKey(new Date());

  // ARR-0029 Bug 2 (see enqueueDueMatchPrepJobs() above) -- await the query inside the callback.
  const teams = await runWithSystemPrivilege("ai-weekly-team-review-scan", async () => {
    return await db.team.findMany({ select: { id: true, organisationId: true } });
  });

  for (const team of teams) {
    try {
      await runWithTenantOrganisationId(team.organisationId, () =>
        triggerAiCapability({
          organisationId: team.organisationId,
          capability: "WEEKLY_TEAM_REVIEW",
          scopeType: "TEAM_WEEK",
          scopeId: buildWeeklyTeamReviewScopeId(team.id, weekKey),
        }),
      );
    } catch (error) {
      // triggerAiCapability itself never throws (it logs and swallows) — this catch is
      // defensive only, so one team's unexpected failure can never abort the whole scan.
      logger.warn({ err: error, teamId: team.id, organisationId: team.organisationId }, "[ai/jobs/scheduled-triggers] Failed to enqueue weekly_team_review");
    }
  }

  return { scanned: teams.length };
}

/**
 * ADR-0152 §6 "Five-week learning cycle" (bundle `06_OPPONENT_MEMORY_AND_LONGITUDINAL.md` §9):
 * the `DEVELOPMENT_CYCLE_REVIEW` scan. Unlike the weekly scan (which always targets one fixed
 * previous-week scope), the cycle window is anchored at the moment of the scan: every cron cycle
 * computes a fresh `windowEnd = now`, `windowStart = now - 35 days`. The bundle's three
 * eligibility gates are checked here *before* spending a `buildContext` on the team:
 *
 * 1. >=35 days since the previous successful cycle ending before the current date — the latest
 *    SUCCEEDED `TEAM_WINDOW` review for this team, whose own scopeId embeds its window end.
 * 2. at least three completed (locked-report) matches since that previous cycle's window end
 *    (or since the start of recorded history when no previous cycle exists — every completed
 *    match before now counts, since none of them has been cycle-reviewed yet).
 * 3. "source fingerprint differs" / "no more than one successful cycle review per team per
 *    35-day window" — not a separate check here, for the same reason the weekly scan documents:
 *    `triggerAiCapability`'s fingerprint dedup plus the DB unique constraint enforce it. A
 *    subtlety worth recording: two scans minutes apart produce *different* scopeIds (different
 *    `windowEnd`), so the fingerprint dedup alone would not stop a second run — but the
 *    previous-cycle gate (1) does: as soon as one review SUCCEEDED, that team's latest successful
 *    cycle ends within the last 35 days and the team is simply not eligible again. Between the
 *    SUCCEEDED review existing and gate (1) seeing it there is no queue window where a duplicate
 *    could slip in, because the enqueue path for a scope also re-checks the previous-cycle gate
 *    inside `triggerAiCapability`'s own buildContext (a scope whose window has no eligible
 *    matches yields null). The residual race (two cron invocations concurrently for the same
 *    team before either review succeeds) is closed by `AiAdvisorJob`'s unique constraint at worst
 *    producing one redundant review per window — the same bounded-duplicate property the weekly
 *    scan already accepts.
 *
 * "Organisation AI enabled" is `triggerAiCapability`'s own existing settings gate, not checked
 * here (same as the other two scans). The capability toggle
 * (`developmentCycleReviewEnabled`, default false for every organisation — ADR-0152 Migration)
 * is likewise enforced by `triggerAiCapability`.
 */
export async function enqueueDueDevelopmentCycleReviewJobs(now: Date = new Date()): Promise<{ scanned: number }> {
  const windowEnd = now;
  const windowStart = new Date(windowEnd.getTime() - DEVELOPMENT_CYCLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ARR-0029 Bug 2 (see enqueueDueMatchPrepJobs() above) -- await the query inside the callback.
  const teams = await runWithSystemPrivilege("ai-development-cycle-review-scan", async () => {
    return await db.team.findMany({ select: { id: true, organisationId: true } });
  });

  let scanned = 0;
  for (const team of teams) {
    try {
      const eligible = await runWithTenantOrganisationId(team.organisationId, async () =>
        isTeamEligibleForDevelopmentCycleReview(team.id, team.organisationId, windowEnd),
      );
      if (!eligible) continue;

      await runWithTenantOrganisationId(team.organisationId, () =>
        triggerAiCapability({
          organisationId: team.organisationId,
          capability: "DEVELOPMENT_CYCLE_REVIEW",
          scopeType: "TEAM_WINDOW",
          scopeId: buildDevelopmentCycleScopeId(team.id, windowStart, windowEnd),
        }),
      );
      scanned++;
    } catch (error) {
      // One team's unexpected failure can never abort the whole scan (same discipline as the
      // match_prep and weekly scans above).
      logger.warn({ err: error, teamId: team.id, organisationId: team.organisationId }, "[ai/jobs/scheduled-triggers] Failed to enqueue development_cycle_review");
    }
  }

  return { scanned };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Gate 1 + gate 2 for one team. Runs inside the team's own organisation tenant context (the
 * queries are ordinary tenant-scoped reads; only the team discovery above needs system
 * privilege, matching the runner's own `runWithTenantOrganisationId` convention). */
async function isTeamEligibleForDevelopmentCycleReview(
  teamId: string,
  organisationId: string,
  windowEnd: Date,
): Promise<boolean> {
  // Gate 1: >=35 days since the previous successful cycle's window end.
  const previousReviews = await db.aiAdvisorReview.findMany({
    where: { organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW", scopeType: "TEAM_WINDOW", status: "SUCCEEDED" },
    select: { scopeId: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });
  let previousWindowEnd: Date | null = null;
  for (const review of previousReviews) {
    const parsed = parseDevelopmentCycleScopeId(review.scopeId);
    if (!parsed || parsed.teamId !== teamId) continue;
    previousWindowEnd = parsed.windowEnd;
    break;
  }
  if (previousWindowEnd !== null && windowEnd.getTime() - previousWindowEnd.getTime() < DEVELOPMENT_CYCLE_WINDOW_DAYS * DAY_MS) {
    return false;
  }

  // Gate 2: at least three completed (locked-report) matches since the previous cycle's window
  // end — or since the dawn of recorded history when no previous cycle exists (none of this
  // team's completed matches have ever been cycle-reviewed, so all of them are "since").
  const since = previousWindowEnd ?? new Date(0);
  const candidateMatches = await db.match.findMany({
    where: { organisationId, teamId, startsAt: { gt: since, lte: windowEnd }, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (candidateMatches.length === 0) return false;
  const lockedReports = await db.postMatchReport.findMany({
    where: { organisationId, matchId: { in: candidateMatches.map((m) => m.id) }, status: "LOCKED" },
    select: { matchId: true },
  });
  return lockedReports.length >= 3;
}
