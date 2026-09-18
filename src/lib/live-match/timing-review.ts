import "server-only";

/**
 * ADR-0146 §8/D14/D15 — post-match review and correction of recovered period timing, and the
 * final-submission gate built on it. A `MatchPeriodTimingResolution` row with
 * `reviewStatus: NEEDS_REVIEW` (written only by `finishLiveReporting`'s active-period recovery,
 * slice 3) must be explicitly confirmed or corrected by the coach before the report can reach
 * its final `LOCKED` state — derived minutes/evidence must never become final while resting on
 * an unreviewed safety assumption (D14).
 */

import { db } from "@/lib/db";
import type { MatchPeriod } from "@/generated/prisma/client";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { rebuildActualTimelineForRef } from "@/lib/evidence/actual-timeline";
import { getPeriodLabels } from "./period-config";
import { getLeagueMatchPeriodConfig } from "./period-config";
import { snapshotToFormat } from "./match-format";
import { MATCH_PERIOD_ORDER } from "./live-match-types";

export interface TimingReviewItem {
  id: string;
  period: MatchPeriod;
  periodLabel: string;
  resolvedDurationMs: number;
  rawElapsedMs: number | null;
  resolutionSource: "EXPLICIT_PERIOD_END" | "FINISH_LIVE_REPORTING" | "RECOVERED_BOUNDED";
  reviewStatus: "NOT_REQUIRED" | "NEEDS_REVIEW" | "REVIEWED";
}

async function periodLabelsForRef(ref: FootballMatchRef): Promise<Record<string, string>> {
  if (ref.kind === "LEAGUE_MATCH") {
    const match = await db.match.findFirst({ where: { id: ref.matchId }, select: { matchType: true } });
    const session = await db.liveMatchSession.findUnique({
      where: { matchId: ref.matchId },
      select: { formatNumberOfPeriods: true, formatPeriodDurationMinutes: true, formatBreakDurationMinutes: true },
    });
    return getPeriodLabels(getLeagueMatchPeriodConfig(match?.matchType ?? "LEAGUE", snapshotToFormat(session)));
  }
  // Event period labels are the same fixed set regardless of format (no CUP-style extra-time
  // splicing on the Event side) -- the League config's labels are byte-identical for the shared
  // BEFORE/FIRST_HALF/HALF_TIME/SECOND_HALF/FULL_TIME slots Event actually uses.
  return getPeriodLabels(getLeagueMatchPeriodConfig("FRIENDLY", null));
}

/** Every resolved period for this match/event-match, for the post-match timing-review callout
 * — includes reviewed and not-required rows too (diagnostic history), not just NEEDS_REVIEW;
 * callers filter for what they need to display. */
export async function getMatchTimingReviewItems(ref: FootballMatchRef): Promise<TimingReviewItem[]> {
  const rows = await db.matchPeriodTimingResolution.findMany({
    where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];
  const labels = await periodLabelsForRef(ref);
  return rows.map((row) => ({
    id: row.id,
    period: row.period,
    periodLabel: labels[row.period] ?? row.period,
    resolvedDurationMs: row.resolvedDurationMs,
    rawElapsedMs: row.rawElapsedMs,
    resolutionSource: row.resolutionSource,
    reviewStatus: row.reviewStatus,
  }));
}

/**
 * ADR-0146 §12/D15 — a recorded event whose period-relative timestamp now exceeds its period's
 * *current* resolved duration (only periods with a resolution row are checked — a period that
 * simply closed normally, with no recovery/correction involved, has nothing to check against).
 * Counted, not deleted or auto-shifted; the coach corrects the event through the existing
 * event-editing workflow (bundle §03.12/§05.14) — this only ever surfaces that a conflict
 * exists and blocks submission, never silently resolves it.
 */
export async function getOutOfRangeEventCount(ref: FootballMatchRef): Promise<number> {
  const resolutions = await db.matchPeriodTimingResolution.findMany({
    where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
    select: { period: true, resolvedDurationMs: true },
  });
  if (resolutions.length === 0) return 0;

  let total = 0;
  if (ref.kind === "LEAGUE_MATCH") {
    for (const resolution of resolutions) {
      const periodIndex = MATCH_PERIOD_ORDER.indexOf(resolution.period);
      total += await db.liveMatchEvent.count({
        where: {
          matchId: ref.matchId,
          period: periodIndex,
          matchSeconds: { gt: resolution.resolvedDurationMs },
          correctionType: null,
        },
      });
    }
  } else {
    for (const resolution of resolutions) {
      total += await db.eventLiveMatchEvent.count({
        where: {
          eventMatchId: ref.eventMatchId,
          period: resolution.period,
          matchSeconds: { gt: resolution.resolvedDurationMs },
          correctionType: null,
        },
      });
    }
  }
  return total;
}

/** ADR-0146 §8/§15 — reasons final report submission (the DRAFT/REPORTED -> LOCKED transition)
 * must be blocked. Empty array means clear to submit. */
export async function getTimingSubmissionBlockers(ref: FootballMatchRef): Promise<string[]> {
  const items = await getMatchTimingReviewItems(ref);
  const needsReview = items.filter((i) => i.reviewStatus === "NEEDS_REVIEW");
  const blockers: string[] = [];
  if (needsReview.length > 0) {
    const labels = needsReview.map((i) => i.periodLabel).join(", ");
    blockers.push(
      `${needsReview.length} period${needsReview.length > 1 ? "s" : ""} (${labels}) had automatically bounded timing and ${needsReview.length > 1 ? "need" : "needs"} review before this report can be completed.`,
    );
  }
  const outOfRangeCount = await getOutOfRangeEventCount(ref);
  if (outOfRangeCount > 0) {
    blockers.push(
      `${outOfRangeCount} recorded event${outOfRangeCount > 1 ? "s fall" : " falls"} outside the corrected period duration — correct ${outOfRangeCount > 1 ? "them" : "it"} through the live-event editor before this report can be completed.`,
    );
  }
  return blockers;
}

export interface ReviewMatchPeriodTimingResult {
  success: boolean;
  error?: string;
}

/**
 * ADR-0146 §8/§16 — confirm a `NEEDS_REVIEW` period's current resolved duration as-is
 * (`correctedDurationMinutes` omitted), or replace it with a coach-supplied duration. Either way
 * this is the *only* correction surface: derived player/position minutes are never patched
 * directly (bundle §04.16 "the period duration is the source correction; derived values are
 * recomputed") — `rebuildActualTimelineForRef` (the same recompute `finishLiveReporting` itself
 * already uses) re-derives them deterministically from the corrected resolution row.
 */
export async function reviewMatchPeriodTiming(
  ref: FootballMatchRef,
  period: MatchPeriod,
  organisationId: string,
  reviewedBy: string,
  correctedDurationMinutes?: number,
): Promise<ReviewMatchPeriodTimingResult> {
  return runWithTenantOrganisationId(organisationId, async () => {
    const existing = await db.matchPeriodTimingResolution.findFirst({
      where: {
        organisationId,
        period,
        ...(ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId }),
      },
      select: { id: true, reviewStatus: true },
    });
    if (!existing) {
      return { success: false, error: "No recovered timing found for this period." };
    }

    if (correctedDurationMinutes != null) {
      if (!Number.isFinite(correctedDurationMinutes) || correctedDurationMinutes <= 0) {
        return { success: false, error: "Duration must be a positive number of minutes." };
      }
      if (correctedDurationMinutes > 300) {
        return { success: false, error: "Duration must be 300 minutes or less." };
      }
    }

    await db.matchPeriodTimingResolution.update({
      where: { id: existing.id },
      data: {
        ...(correctedDurationMinutes != null ? { resolvedDurationMs: Math.round(correctedDurationMinutes * 60 * 1000) } : {}),
        reviewStatus: "REVIEWED",
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    await rebuildActualTimelineForRef(ref);

    return { success: true };
  });
}
