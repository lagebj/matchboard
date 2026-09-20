import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { triggerAiCapability } from "@/lib/ai/jobs/triggers";
import { formatIsoWeekKey } from "@/lib/date-utils";
import { buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";

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

  const dueMatches = await runWithSystemPrivilege("ai-match-prep-scan", () =>
    db.match.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: now, lte: windowEnd } },
      select: { id: true, organisationId: true },
    }),
  );

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
function previousCompletedIsoWeekKey(now: Date): string {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return formatIsoWeekKey(sevenDaysAgo);
}

export async function enqueueDueWeeklyTeamReviewJobs(): Promise<{ scanned: number }> {
  const weekKey = previousCompletedIsoWeekKey(new Date());

  const teams = await runWithSystemPrivilege("ai-weekly-team-review-scan", () =>
    db.team.findMany({ select: { id: true, organisationId: true } }),
  );

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
