import "server-only";

/**
 * ADR-0146 §5/§6 — the one shared `finishLiveReporting` operation. Both today's manual
 * completion path (`endLiveSessionAndCreateReportAction`/`endEventLiveSessionAndCreateReportAction`)
 * and the future automatic timeout path (slice 4, `reconcileExpiredLiveReportingSessions`) call
 * this — never a second, trigger-specific completion implementation (D11/D12: `trigger` is
 * audit/log metadata only, never a distinct business state).
 *
 * Deliberately does NOT delegate the session-ending write to the existing actor-gated
 * `endLiveSession()`/`endEventLiveSession()` (`live-match-session.ts`/`event-live-match-session.ts`)
 * — those call `requireActorContext()`, which needs a real signed-in browser session and
 * structurally cannot run from slice 4's server-side cron (no browser, no user). This is the
 * smallest adaptation that preserves every behavioral invariant in the bundle (its own explicit
 * allowance, AGENT-PROMPT.md's closing clause): this function performs the same two-field
 * `status`/`endedAt` write directly, as an atomic compare-and-set (`updateMany` guarded by
 * `status: "ACTIVE"`) rather than a separate find-then-update — which additionally makes it the
 * concurrency-safe lock ADR-0146 §12 requires, something the original find-then-update
 * `endLiveSession()` never was. `endLiveSession()`/`endEventLiveSession()` remain unchanged and
 * are still used by their own existing (unrelated, non-report-creating) caller.
 *
 * Everything else this calls (`seedReportFromLiveSession`/`seedEventReportFromLiveSession`,
 * `rebuildActualTimelineForRef`) already takes a plain `organisationId`, not an actor context —
 * already safe to call from a system trigger with no changes needed here.
 *
 * If any step after the compare-and-set throws, the session is reverted back to `ACTIVE` (see
 * `revertLeagueSessionToActiveOnFailure`/`revertEventSessionToActiveOnFailure`) so it remains
 * eligible for the next manual attempt or reconciliation tick, per the acceptance checklist's
 * "failed matches remain eligible for retry" — the compare-and-set is a lock on *who* gets to
 * run the operation, not a point of no return.
 */

import { db } from "@/lib/db";
import type { MatchPeriod } from "@/generated/prisma/client";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { logger } from "@/lib/logger";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { rebuildActualTimelineForRef } from "@/lib/evidence/actual-timeline";
import { seedReportFromLiveSession } from "@/lib/reports/report-mutations";
import { seedEventReportFromLiveSession } from "@/lib/reports/event-report-mutations";
import { getElapsedMs } from "./match-clock";
import { snapshotToFormat } from "./resolve-live-period-config";
import { getLeagueMatchPeriodConfig, getEventPeriodConfig, buildPeriodConfigFromFormat, type PeriodConfig } from "./period-config";
import { getEffectiveEventSquadMatchTiming } from "@/lib/events/event-types";
import { resolveActivePeriodForFinish, type ActivePeriodResolution } from "./resolve-active-period-for-finish";
import type { MatchReportStatus } from "@/generated/prisma/client";

export type FinishLiveReportingTrigger = "MANUAL" | "TIMEOUT";

export interface FinishLiveReportingResult {
  ref: FootballMatchRef;
  sessionId: string;
  reportId: string | null;
  reportStatus: MatchReportStatus | null;
  /** True when this call observed the session already `ENDED` — either a genuine repeat call,
   * or the losing side of a manual/TIMEOUT race (ADR-0146 §12). No further work was done; the
   * transition and its report were already produced by whichever call actually won. */
  alreadyCompleted: boolean;
  /** Set only when this call itself resolved a still-active period (never set on the
   * already-completed/race-loser path — that period, if any, was resolved by the winner). */
  activePeriodResolution: ActivePeriodResolution | null;
}

/** A caller-known organisationId is required either way: a real coach's own org (the manual
 * handoff actions already resolve this via `requireActorContext()`), or the org the slice-4
 * scheduler already read off the eligible session row before calling this per-match. Neither
 * needs a full `ActorContext` — nothing below this point reads anything else about the caller. */
export interface FinishLiveReportingContext {
  organisationId: string;
}

export async function finishLiveReporting(
  ref: FootballMatchRef,
  trigger: FinishLiveReportingTrigger,
  context: FinishLiveReportingContext,
): Promise<FinishLiveReportingResult> {
  return runWithTenantOrganisationId(context.organisationId, () =>
    ref.kind === "LEAGUE_MATCH"
      ? finishLeagueLiveReporting(ref, trigger, context.organisationId)
      : finishEventLiveReporting(ref, trigger, context.organisationId),
  );
}

// ---------------------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------------------

async function finishLeagueLiveReporting(
  ref: Extract<FootballMatchRef, { kind: "LEAGUE_MATCH" }>,
  trigger: FinishLiveReportingTrigger,
  organisationId: string,
): Promise<FinishLiveReportingResult> {
  const matchId = ref.matchId;

  const match = await db.match.findFirst({
    where: { id: matchId, organisationId },
    select: { id: true, matchType: true },
  });
  if (!match) throw new Error("Match not found.");

  const session = await db.liveMatchSession.findFirst({
    where: { matchId, organisationId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      clockPeriod: true,
      clockRunning: true,
      clockPeriodStartedAt: true,
      clockElapsedBeforeMs: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
  });
  if (!session) throw new Error("No live session found for this match.");

  if (session.status !== "ACTIVE") {
    return alreadyCompletedResult(ref, session.id, await awaitLeagueReport(matchId, organisationId));
  }

  const now = new Date();

  // Compare-and-set (ADR-0146 §12): the concurrency lock. Only the caller whose update actually
  // transitions the row (count === 1) proceeds to resolve the active period and produce the
  // report; a racing caller's update lands at count === 0 and takes the already-completed path
  // above, exactly as it would on a genuine repeat call.
  const transitioned = await db.liveMatchSession.updateMany({
    where: { id: session.id, status: "ACTIVE", organisationId },
    data: { status: "ENDED", endedAt: now },
  });
  if (transitioned.count === 0) {
    return alreadyCompletedResult(ref, session.id, await awaitLeagueReport(matchId, organisationId));
  }

  try {
    const format = snapshotToFormat(session);
    const periodConfig = getLeagueMatchPeriodConfig(match.matchType, format);
    const activePeriodResolution = await resolveAndPersistActivePeriod({
      organisationId,
      matchId,
      eventMatchId: null,
      periodConfig,
      hasFormatSnapshot: format != null,
      session,
      now,
    });

    const seedResult = await seedReportFromLiveSession(matchId, organisationId);
    if (!seedResult.success) {
      throw new Error(`finishLiveReporting: failed to seed report for match ${matchId}: ${seedResult.error}`);
    }

    await rebuildActualTimelineForRef(ref);

    logFinish({ sourceId: matchId, sessionId: session.id, trigger, liveReportingStartedAt: session.startedAt, finishAttemptAt: now, activePeriodResolution });

    return {
      ref,
      sessionId: session.id,
      reportId: seedResult.reportId,
      reportStatus: seedResult.status,
      alreadyCompleted: false,
      activePeriodResolution,
    };
  } catch (error) {
    await revertLeagueSessionToActiveOnFailure(session.id, organisationId, matchId, error);
    throw error;
  }
}

function findLeagueReport(matchId: string, organisationId: string) {
  return db.postMatchReport.findFirst({ where: { matchId, organisationId }, select: { id: true, status: true } });
}

/** ADR-0146 §12 — the race-loser path (this call observed the session already `ENDED`, whether
 * from a genuine repeat call or from losing the compare-and-set above) must still "observe
 * completion", but the actual winner may still be mid-flight through its own seed/rebuild work
 * when this call reaches here. A short bounded retry closes that narrow visibility window rather
 * than returning `reportId: null` for a transition that genuinely already succeeded. */
async function awaitLeagueReport(matchId: string, organisationId: string) {
  return awaitReport(() => findLeagueReport(matchId, organisationId));
}

// ---------------------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------------------

async function finishEventLiveReporting(
  ref: Extract<FootballMatchRef, { kind: "EVENT_MATCH" }>,
  trigger: FinishLiveReportingTrigger,
  organisationId: string,
): Promise<FinishLiveReportingResult> {
  const eventMatchId = ref.eventMatchId;

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, organisationId },
    select: {
      id: true,
      eventSquad: {
        select: {
          numberOfHalvesOverride: true,
          matchDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
          event: { select: { numberOfHalves: true, matchDurationMinutes: true, breakDurationMinutes: true } },
        },
      },
    },
  });
  if (!eventMatch) throw new Error("Event match not found.");

  const session = await db.eventLiveMatchSession.findFirst({
    where: { eventMatchId, organisationId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      clockPeriod: true,
      clockRunning: true,
      clockPeriodStartedAt: true,
      clockElapsedBeforeMs: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
  });
  if (!session) throw new Error("No live session found for this event match.");

  if (session.status !== "ACTIVE") {
    return alreadyCompletedResult(ref, session.id, await awaitEventReport(eventMatchId, organisationId));
  }

  const now = new Date();

  const transitioned = await db.eventLiveMatchSession.updateMany({
    where: { id: session.id, status: "ACTIVE", organisationId },
    data: { status: "ENDED", endedAt: now },
  });
  if (transitioned.count === 0) {
    return alreadyCompletedResult(ref, session.id, await awaitEventReport(eventMatchId, organisationId));
  }

  try {
    const format = snapshotToFormat(session);
    const timing = getEffectiveEventSquadMatchTiming(eventMatch.eventSquad.event, eventMatch.eventSquad);
    const periodConfig = format
      ? buildPeriodConfigFromFormat(format)
      : getEventPeriodConfig(timing.matchDurationMinutes, timing.numberOfHalves, timing.breakDurationMinutes);
    const activePeriodResolution = await resolveAndPersistActivePeriod({
      organisationId,
      matchId: null,
      eventMatchId,
      periodConfig,
      hasFormatSnapshot: format != null,
      session,
      now,
    });

    const seedResult = await seedEventReportFromLiveSession(eventMatchId, organisationId);
    if (!seedResult.success) {
      throw new Error(`finishLiveReporting: failed to seed report for event match ${eventMatchId}: ${seedResult.error}`);
    }

    await rebuildActualTimelineForRef(ref);

    logFinish({ sourceId: eventMatchId, sessionId: session.id, trigger, liveReportingStartedAt: session.startedAt, finishAttemptAt: now, activePeriodResolution });

    return {
      ref,
      sessionId: session.id,
      reportId: seedResult.reportId,
      reportStatus: seedResult.status,
      alreadyCompleted: false,
      activePeriodResolution,
    };
  } catch (error) {
    await revertEventSessionToActiveOnFailure(session.id, organisationId, eventMatchId, error);
    throw error;
  }
}

function findEventReport(eventMatchId: string, organisationId: string) {
  return db.eventPostMatchReport.findFirst({ where: { eventMatchId, organisationId }, select: { id: true, status: true } });
}

/** Event equivalent of `awaitLeagueReport` — see its own doc comment. */
async function awaitEventReport(eventMatchId: string, organisationId: string) {
  return awaitReport(() => findEventReport(eventMatchId, organisationId));
}

/** Bounded retry (a handful of short, fixed waits — this closes a race window measured in
 * milliseconds, not a general-purpose backoff policy) for a report a concurrent winner may still
 * be in the middle of creating. */
async function awaitReport<T>(lookup: () => Promise<T | null>): Promise<T | null> {
  const ATTEMPTS = 10;
  const DELAY_MS = 50;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const report = await lookup();
    if (report) return report;
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------------------

/**
 * ADR-0146 §7/§12/acceptance-checklist ("Failed matches remain eligible for retry") — the
 * compare-and-set above already flipped `status` to `ENDED` before any of the report-seeding or
 * timeline-recompute work below it runs. If that later work throws (a transient DB error, not a
 * validation failure — `seedReportFromLiveSession`'s own `success: false` path is the expected,
 * already-handled outcome and is thrown as a plain `Error` above, same as this), the session must
 * not be left stranded `ENDED` with no report: the reconciliation cron's eligibility query only
 * ever matches `status: "ACTIVE"`, so a session stuck `ENDED` here would silently stop being
 * retried by anything. Best-effort compare-and-set back to `ACTIVE` (only if still `ENDED` — a
 * concurrent winner may have already produced a real completion by the time this runs) restores
 * exactly the state finishLiveReporting started from, so the next manual click or cron tick
 * retries the whole operation from scratch — every step it repeats
 * (`resolveAndPersistActivePeriod`'s `upsert`, `seedReportFromLiveSession`'s P2002 handling,
 * `rebuildActualTimelineForRef`'s deterministic recompute) is already idempotent per ADR-0133 H1
 * and this ADR's own §12 concurrency design, so a retry after a reverted failure is safe.
 */
async function revertLeagueSessionToActiveOnFailure(sessionId: string, organisationId: string, matchId: string, error: unknown): Promise<void> {
  try {
    await db.liveMatchSession.updateMany({
      where: { id: sessionId, status: "ENDED", organisationId },
      data: { status: "ACTIVE", endedAt: null },
    });
  } catch (revertError) {
    logger.error({ matchId, sessionId, error, revertError }, "[finishLiveReporting] failed to revert session to ACTIVE after a finish-step failure");
    return;
  }
  logger.warn({ matchId, sessionId, error }, "[finishLiveReporting] reverted session to ACTIVE after a finish-step failure — eligible for retry");
}

/** Event equivalent of `revertLeagueSessionToActiveOnFailure` — see its own doc comment. */
async function revertEventSessionToActiveOnFailure(sessionId: string, organisationId: string, eventMatchId: string, error: unknown): Promise<void> {
  try {
    await db.eventLiveMatchSession.updateMany({
      where: { id: sessionId, status: "ENDED", organisationId },
      data: { status: "ACTIVE", endedAt: null },
    });
  } catch (revertError) {
    logger.error({ eventMatchId, sessionId, error, revertError }, "[finishLiveReporting] failed to revert session to ACTIVE after a finish-step failure");
    return;
  }
  logger.warn({ eventMatchId, sessionId, error }, "[finishLiveReporting] reverted session to ACTIVE after a finish-step failure — eligible for retry");
}

function alreadyCompletedResult(
  ref: FootballMatchRef,
  sessionId: string,
  report: { id: string; status: MatchReportStatus } | null,
): FinishLiveReportingResult {
  return {
    ref,
    sessionId,
    reportId: report?.id ?? null,
    reportStatus: report?.status ?? null,
    alreadyCompleted: true,
    activePeriodResolution: null,
  };
}

interface SessionClockRow {
  clockPeriod: MatchPeriod;
  clockRunning: boolean;
  clockPeriodStartedAt: Date | null;
  clockElapsedBeforeMs: number;
}

/**
 * ADR-0146 §6/§9 — if the session's clock was left in a "playing" period (never advanced past
 * it to the next break/period, i.e. never explicitly ended), resolve it now via
 * `resolveActivePeriodForFinish` and persist a `MatchPeriodTimingResolution` row. A period the
 * coach already explicitly ended is not "still active" by the time finish runs — its clock
 * already moved to a break/next-period slot — so this only ever fires for the one genuinely
 * abandoned period, if any.
 *
 * `upsert` (not `create`): idempotent against a retried/racing call for the same session —
 * `LiveMatchSession.matchId`/`EventLiveMatchSession.eventMatchId` are each unique, so no two
 * sessions ever contend for the same `(matchId, period)`/`(eventMatchId, period)` row, but a
 * genuine race between this function's own two triggers reaching this exact line for the *same*
 * session is still possible in the narrow window before the compare-and-set above has fully
 * excluded one side — `update: {}` on conflict keeps whichever `create()` won, discarding this
 * call's own (immaterially different, computed a few milliseconds apart) values.
 *
 * `hasFormatSnapshot` is passed separately from `periodConfig`: `periodConfig` always resolves to
 * *some* usable period durations (the legacy hardcoded 25-minute-halves default when no session
 * snapshot exists — "Legacy fallback stays byte-identical to today", ADR-0146 §1), but the
 * *recovery ceiling* must only ever treat a period duration as "intended" when it came from a
 * real configured Match/Team/Season snapshot — never the hardcoded legacy default, which is
 * itself a guess about a team's actual period length. Passing `periodEntry.durationMs` here
 * unconditionally would silently apply a 35-minute ceiling (25m + 10m allowance) to every
 * unconfigured legacy match instead of the deliberately more generous, guess-free 60-minute
 * legacy ceiling ADR-0146 §3/D9 actually specifies.
 */
async function resolveAndPersistActivePeriod(params: {
  organisationId: string;
  matchId: string | null;
  eventMatchId: string | null;
  periodConfig: PeriodConfig[];
  hasFormatSnapshot: boolean;
  session: SessionClockRow;
  now: Date;
}): Promise<ActivePeriodResolution | null> {
  const periodEntry = params.periodConfig.find((p) => p.key === params.session.clockPeriod);
  if (periodEntry?.type !== "playing") return null;

  const clock = {
    period: params.session.clockPeriod,
    running: params.session.clockRunning,
    startedAt: params.session.clockRunning ? params.session.clockPeriodStartedAt : null,
    elapsedBeforeStartMs: params.session.clockElapsedBeforeMs,
  };
  const rawElapsedMs = getElapsedMs(clock, params.now.getTime());

  const resolution = resolveActivePeriodForFinish({
    period: params.session.clockPeriod,
    rawElapsedMs,
    intendedPeriodDurationMs: params.hasFormatSnapshot ? periodEntry.durationMs : null,
  });

  await db.matchPeriodTimingResolution.upsert({
    where: params.matchId
      ? { matchId_period: { matchId: params.matchId, period: resolution.period } }
      : { eventMatchId_period: { eventMatchId: params.eventMatchId!, period: resolution.period } },
    create: {
      organisationId: params.organisationId,
      matchId: params.matchId,
      eventMatchId: params.eventMatchId,
      period: resolution.period,
      // ADR-0146 §8: raw elapsed is retained only when it was actually clamped — a
      // FINISH_LIVE_REPORTING (unclamped) row has nothing to diagnose.
      rawElapsedMs: resolution.resolutionSource === "RECOVERED_BOUNDED" ? resolution.rawElapsedMs : null,
      resolvedDurationMs: resolution.resolvedDurationMs,
      resolutionSource: resolution.resolutionSource,
      reviewStatus: resolution.reviewStatus,
    },
    update: {},
  });

  return resolution;
}

function logFinish(params: {
  sourceId: string;
  sessionId: string;
  trigger: FinishLiveReportingTrigger;
  liveReportingStartedAt: Date;
  finishAttemptAt: Date;
  activePeriodResolution: ActivePeriodResolution | null;
}): void {
  logger.info(
    {
      sourceId: params.sourceId,
      sessionId: params.sessionId,
      trigger: params.trigger,
      liveReportingStartedAt: params.liveReportingStartedAt.toISOString(),
      finishAttemptAt: params.finishAttemptAt.toISOString(),
      elapsedLiveReportingDurationMs: params.finishAttemptAt.getTime() - params.liveReportingStartedAt.getTime(),
    },
    "[finishLiveReporting] session finished",
  );
  if (params.activePeriodResolution?.resolutionSource === "RECOVERED_BOUNDED") {
    logger.warn(
      {
        sourceId: params.sourceId,
        period: params.activePeriodResolution.period,
        rawElapsedMs: params.activePeriodResolution.rawElapsedMs,
        resolvedDurationMs: params.activePeriodResolution.resolvedDurationMs,
        resolution: "RECOVERED_BOUNDED",
      },
      "[finishLiveReporting] active period recovered/bounded",
    );
  }
}
