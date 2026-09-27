import "server-only";

import { db } from "@/lib/db";
import type { QualitativeEvidenceSourceType } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { getOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { triggerAiCapability } from "@/lib/ai/jobs/triggers";
import { buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";
import { formatIsoWeekKey } from "@/lib/date-utils";
import { normalizeSourceText } from "@/lib/post-match/debrief/map-to-qualitative-evidence";
import { enqueueQualitativeExtraction } from "./qualitative-evidence-enqueue";
import { buildDevelopmentCycleScopeId, parseDevelopmentCycleScopeId, DEVELOPMENT_CYCLE_WINDOW_DAYS } from "@/lib/ai/context/development-cycle-review";
import type { JsonValue } from "@/lib/ai/fingerprints";

/**
 * Bounded historical AI backfill (ADR-0152 Slice 7; bundle `04_QUALITATIVE_EVIDENCE_MODEL.md`
 * §18 "Backfill" + `11_IMPLEMENTATION_SEQUENCE.md` "bounded backfill command, selected 90-day
 * backfill"): an idempotent, org-scoped, manually-triggered command that enqueues AI work for
 * *already existing* data — never a cron, never run at deployment, and never unbounded.
 *
 * Two families of work:
 *
 * 1. **AI_STRUCTURED extraction of legacy free text** — the bundle §4 source types with no
 *    current write path: locked reports' own teamNote, legacy TeamReflection.note, Match.notes,
 *    still-unstructured QuickObservation notes, and the opponent-encounter factual summary.
 *    Each becomes one `QualitativeEvidenceExtractionRun` via the same idempotent
 *    `enqueueQualitativeExtraction` the debrief submit path uses (bundle §9: "Same normalized
 *    source content must not enqueue again" — the fingerprint unique index makes reruns no-ops).
 *    League-only, like every other qualitative-evidence writer: Event has no `teamId` to key
 *    the required `QualitativeEvidenceObservation.teamId` off (issue #691).
 *
 * 2. **Advisor reviews over existing data** (the user-requested widening: "run all AI functions
 *    on all possible scenarios" — safe as a manual trigger because every capability dedupes by
 *    normalized source fingerprint, so unchanged historical data never re-runs, and enqueueing
 *    never calls a provider synchronously): post-match reviews for locked reports in window,
 *    weekly reviews for each ISO week the window touches, and the development-cycle scan.
 *    Enqueued through the same `triggerAiCapability` every domain trigger uses, which
 *    independently re-checks org-AI-enabled, per-capability toggle, handler existence, context
 *    eligibility, and the SUCCEEDED-review/fingerprint dedup before queueing anything.
 *
 * Bounds (bundle §18): organisation-scoped, optional team filter, date range (default window
 * 90 days), max sources per invocation (default 25). "Stop safely on outage": if AI is
 * disabled or has no READY active connection the command returns a summary saying so without
 * enqueueing anything at all — `enqueueQualitativeExtraction`'s own AI_DISABLED discipline,
 * applied up front so a backfill never litters QUEUED rows it cannot process.
 */

/** Bundle §18: "Initial recommended window is previous 90 days, batches of 25." */
export const BACKFILL_DEFAULT_WINDOW_DAYS = 90;
export const BACKFILL_DEFAULT_MAX_SOURCES = 25;

export type AiBackfillOptions = {
  /** Inclusive lower bound for a source's match date. Default: 90 days ago. */
  from?: Date;
  /** Inclusive upper bound for a source's match date. Default: now. */
  to?: Date;
  /** Restrict to one team. */
  teamId?: string;
  /** Hard cap on extraction sources enqueued in this invocation (bundle §18 "max sources"). */
  maxSources?: number;
  /** Skip the AI_STRUCTURED extraction family (legacy free text). */
  skipExtraction?: boolean;
  /** Skip the Advisor review family (post-match, weekly, development-cycle). */
  skipAdvisorReviews?: boolean;
};

export type AiBackfillSourceSummary = {
  sourceType: QualitativeEvidenceSourceType;
  /** Sources inspected within the bounds (empty-text sources included — the operator sees the
   * inspection happened even when nothing was worth enqueueing). */
  considered: number;
  enqueued: number;
  alreadyTracked: number;
  /** Sources whose current text is empty — nothing to extract, no run enqueued. */
  empty: number;
  /** Sources not reached because the invocation's max-sources budget ran out. */
  outOfBudget: number;
  failed: number;
};

export type AiBackfillAdvisorSummary = {
  lockedMatchesConsidered: number;
  matchReviewsEnqueued: number;
  weeksConsidered: number;
  weeklyReviewsEnqueued: number;
  developmentCycleScanned: number;
  developmentCycleEnqueued: number;
};

export type AiBackfillReport = {
  organisationId: string;
  /** True when AI is disabled or no READY connection exists — nothing was enqueued. */
  aiDisabled: boolean;
  window: { from: Date; to: Date };
  extraction: AiBackfillSourceSummary[];
  advisor: AiBackfillAdvisorSummary;
};

type ResolvedLegacySource = {
  sourceId: string;
  matchId: string;
  teamId: string;
  fingerprintPayload: JsonValue;
};

const LEGACY_SOURCE_TYPES: QualitativeEvidenceSourceType[] = [
  "POST_MATCH_TEAM_NOTE",
  "TEAM_REFLECTION_NOTE",
  "MATCH_NOTE",
  "QUICK_OBSERVATION",
  "OPPONENT_ENCOUNTER_TEXT",
];

/** Collects every legacy free-text source within the bounds, grouped by source type. Empty-text
 * sources are counted as `considered` + `empty` at enqueue time. */
async function resolveLegacySources(
  organisationId: string,
  bounds: { from: Date; to: Date; teamId?: string },
): Promise<Map<QualitativeEvidenceSourceType, ResolvedLegacySource[]>> {
  const { from, to } = bounds;
  const teamFilter = bounds.teamId ? { teamId: bounds.teamId } : {};
  const matchWindow = { startsAt: { gte: from, lte: to } };

  const leagueMatches = await db.match.findMany({
    where: { organisationId, ...teamFilter, ...matchWindow, status: { not: "CANCELLED" } },
    select: { id: true, teamId: true, notes: true },
    orderBy: { startsAt: "asc" },
  });
  const matchIds = leagueMatches.map((m) => m.id);

  const [lockedReports, teamReflections, opponentObservations, quickObservations] = await Promise.all([
    matchIds.length
      ? db.postMatchReport.findMany({ where: { organisationId, matchId: { in: matchIds }, status: "LOCKED" }, select: { matchId: true, teamNote: true } })
      : Promise.resolve([] as { matchId: string; teamNote: string | null }[]),
    matchIds.length
      ? db.teamReflection.findMany({ where: { organisationId, matchId: { in: matchIds }, note: { not: null } }, select: { matchId: true, note: true } })
      : Promise.resolve([] as { matchId: string; note: string | null }[]),
    matchIds.length
      ? db.opponentEncounterObservation.findMany({ where: { organisationId, matchId: { in: matchIds }, factualSummary: { not: null } }, select: { matchId: true, factualSummary: true } })
      : Promise.resolve([] as { matchId: string; factualSummary: string | null }[]),
    matchIds.length
      ? db.quickObservation.findMany({
          where: { organisationId, matchId: { in: matchIds }, convertedToType: null },
          select: { id: true, matchId: true, note: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([] as { id: string; matchId: string | null; note: string }[]),
  ]);

  const teamIdByMatchId = new Map(leagueMatches.map((m) => [m.id, m.teamId]));

  const byType = new Map<QualitativeEvidenceSourceType, ResolvedLegacySource[]>();
  for (const type of LEGACY_SOURCE_TYPES) byType.set(type, []);

  function push(type: QualitativeEvidenceSourceType, matchId: string, sourceId: string, rawText: string | null | undefined) {
    const teamId = teamIdByMatchId.get(matchId);
    if (!teamId) return;
    const text = normalizeSourceText(rawText);
    if (!text) return;
    byType.get(type)!.push({ sourceId, matchId, teamId, fingerprintPayload: { sourceType: type, text } });
  }

  for (const report of lockedReports) {
    push("POST_MATCH_TEAM_NOTE", report.matchId, report.matchId, report.teamNote);
  }
  for (const reflection of teamReflections) {
    push("TEAM_REFLECTION_NOTE", reflection.matchId, reflection.matchId, reflection.note);
  }
  for (const match of leagueMatches) {
    push("MATCH_NOTE", match.id, match.id, match.notes);
  }
  for (const observation of opponentObservations) {
    push("OPPONENT_ENCOUNTER_TEXT", observation.matchId, observation.matchId, observation.factualSummary);
  }
  for (const quick of quickObservations) {
    if (!quick.matchId) continue; // unattached notes have no match to bind evidence to
    push("QUICK_OBSERVATION", quick.matchId, quick.id, quick.note);
  }

  return byType;
}

/** Every ISO week key touched by [from, to] — one weekly-review scope per week per team. */
function isoWeeksBetween(from: Date, to: Date): string[] {
  const weeks: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor.getTime() <= to.getTime()) {
    weeks.push(formatIsoWeekKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return [...new Set(weeks)];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runAiBackfill(organisationId: string, options?: AiBackfillOptions): Promise<AiBackfillReport> {
  const now = new Date();
  const from = options?.from ?? new Date(now.getTime() - BACKFILL_DEFAULT_WINDOW_DAYS * DAY_MS);
  const to = options?.to ?? now;
  const maxSources = options?.maxSources ?? BACKFILL_DEFAULT_MAX_SOURCES;

  const settings = await getOrganisationAiSettings(organisationId);
  const aiDisabled = !settings?.enabled || !settings.activeConnectionId;
  const emptyAdvisor: AiBackfillAdvisorSummary = {
    lockedMatchesConsidered: 0,
    matchReviewsEnqueued: 0,
    weeksConsidered: 0,
    weeklyReviewsEnqueued: 0,
    developmentCycleScanned: 0,
    developmentCycleEnqueued: 0,
  };
  if (aiDisabled) {
    return { organisationId, aiDisabled: true, window: { from, to }, extraction: [], advisor: emptyAdvisor };
  }

  const extraction: AiBackfillSourceSummary[] = [];
  let budget = maxSources;

  if (!options?.skipExtraction) {
    const sourcesByType = await resolveLegacySources(organisationId, { from, to, teamId: options?.teamId });

    for (const sourceType of LEGACY_SOURCE_TYPES) {
      const sources = sourcesByType.get(sourceType) ?? [];
      const summary: AiBackfillSourceSummary = { sourceType, considered: sources.length, enqueued: 0, alreadyTracked: 0, empty: 0, outOfBudget: 0, failed: 0 };
      for (const source of sources) {
        if (budget <= 0) {
          summary.outOfBudget++;
          continue;
        }
        budget--;
        try {
          const result = await enqueueQualitativeExtraction({
            organisationId,
            sourceType,
            sourceId: source.sourceId,
            fingerprintPayload: source.fingerprintPayload,
          });
          if (result.status === "QUEUED") summary.enqueued++;
          else if (result.status === "ALREADY_TRACKED") summary.alreadyTracked++;
        } catch (error) {
          summary.failed++;
          logger.warn({ err: error, organisationId, sourceType, sourceId: source.sourceId }, "[ai-backfill] Failed to enqueue legacy extraction");
        }
      }
      extraction.push(summary);
    }
  }

  const advisor: AiBackfillAdvisorSummary = { ...emptyAdvisor };

  if (!options?.skipAdvisorReviews) {
    const teamFilter = options?.teamId ? { teamId: options.teamId } : {};
    const matches = await db.match.findMany({
      where: { organisationId, ...teamFilter, startsAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: { id: true },
      orderBy: { startsAt: "asc" },
    });
    const matchIds = matches.map((m) => m.id);
    const lockedReports = matchIds.length
      ? await db.postMatchReport.findMany({ where: { organisationId, matchId: { in: matchIds }, status: "LOCKED" }, select: { matchId: true } })
      : [];
    const lockedMatchIds = [...new Set(lockedReports.map((r) => r.matchId))].sort();
    advisor.lockedMatchesConsidered = lockedMatchIds.length;

    for (const matchId of lockedMatchIds) {
      const outcome = await triggerAiCapability({ organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: matchId });
      if (outcome === "ENQUEUED") advisor.matchReviewsEnqueued++;
    }

    const weeks = isoWeeksBetween(from, to);
    advisor.weeksConsidered = weeks.length;

    const teams = await db.team.findMany({
      where: { organisationId, ...(options?.teamId ? { id: options.teamId } : {}) },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const team of teams) {
      for (const weekKey of weeks) {
        const outcome = await triggerAiCapability({
          organisationId,
          capability: "WEEKLY_TEAM_REVIEW",
          scopeType: "TEAM_WEEK",
          scopeId: buildWeeklyTeamReviewScopeId(team.id, weekKey),
        });
        if (outcome === "ENQUEUED") advisor.weeklyReviewsEnqueued++;
      }
    }

    // Development-cycle: the 35-day / >=3-matches eligibility gates live in the cron scan;
    // this is the same rule evaluated for this one organisation (the scan itself is cross-tenant
    // and takes no org filter, so it cannot be reused verbatim here).
    const cycleTeams = await db.team.findMany({
      where: { organisationId, ...(options?.teamId ? { id: options.teamId } : {}) },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const team of cycleTeams) {
      advisor.developmentCycleScanned++;
      if (!(await isTeamEligibleForDevelopmentCycleReview(team.id, organisationId, now))) continue;
      const outcome = await triggerAiCapability({
        organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId: buildDevelopmentCycleScopeId(team.id, new Date(now.getTime() - DEVELOPMENT_CYCLE_WINDOW_DAYS * DAY_MS), now),
      });
      if (outcome === "ENQUEUED") advisor.developmentCycleEnqueued++;
    }
  }

  return { organisationId, aiDisabled: false, window: { from, to }, extraction, advisor };
}

/** Same 35-day / >=3-completed-matches gates as the cron scan's own
 * `isTeamEligibleForDevelopmentCycleReview` (scheduled-triggers.ts) — re-evaluated here for a
 * single already-tenant-scoped organisation rather than imported, because the scan's version is
 * module-private and wrapped in cross-tenant discovery. */
async function isTeamEligibleForDevelopmentCycleReview(teamId: string, organisationId: string, now: Date): Promise<boolean> {
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
  if (previousWindowEnd !== null && now.getTime() - previousWindowEnd.getTime() < DEVELOPMENT_CYCLE_WINDOW_DAYS * DAY_MS) {
    return false;
  }

  const since = previousWindowEnd ?? new Date(0);
  const candidateMatches = await db.match.findMany({
    where: { organisationId, teamId, startsAt: { gt: since, lte: now }, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (candidateMatches.length === 0) return false;
  const lockedReports = await db.postMatchReport.findMany({
    where: { organisationId, matchId: { in: candidateMatches.map((m) => m.id) }, status: "LOCKED" },
    select: { matchId: true },
  });
  return lockedReports.length >= 3;
}