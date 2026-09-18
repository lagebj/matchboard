import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { MatchReportStatus } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { canTransitionTo, hasUnknownAttendance } from "./report-domain";
import { getEventReversedEventIds } from "@/lib/live-match/reversal-resolution";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export type SeedEventReportFromLiveSessionResult =
  | { success: true; eventMatchId: string; reportId: string; status: MatchReportStatus; alreadyExisted: boolean }
  | { success: false; error: string };

/**
 * Event-side Run -> Learn handoff (ADR-0088), parallel to
 * `seedReportFromLiveSession()` in `report-mutations.ts` for League matches. Event and League
 * reporting are deliberately separate models (AGENTS.md) with different schemas
 * (`EventPostMatchReport`/`playerReports` vs `PostMatchReport`/`playerActuals`), so this is not
 * a duplicate to merge with the League function — it is the Event domain's own owning
 * implementation, extracted out of the server action that previously reimplemented it inline.
 * The caller (`endEventLiveSessionAndCreateReportAction`) validates session/match/organisation
 * consistency before calling this — `organisationId` here is trusted, not re-derived.
 */
export async function seedEventReportFromLiveSession(
  eventMatchId: string,
  organisationId: string,
): Promise<SeedEventReportFromLiveSessionResult> {
  // Every read below is explicitly scoped by the caller-verified `organisationId` parameter
  // (not just whatever tenant context happens to be ambient via AsyncLocalStorage) — the
  // same defense-in-depth convention ADR-0087 documents (getExplicitOrgId()), and the only
  // way to be certain these RLS-scoped queries stay correctly scoped regardless of how many
  // awaits separate this call from wherever its caller last established context.
  const existingReport = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId, organisationId },
    select: { id: true, status: true },
  });

  if (existingReport) {
    return {
      success: true,
      eventMatchId,
      reportId: existingReport.id,
      status: existingReport.status,
      alreadyExisted: true,
    };
  }

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, organisationId },
    select: {
      eventId: true,
      eventSquadId: true,
      eventSquad: {
        select: {
          id: true,
          name: true,
          players: {
            select: {
              playerId: true,
              assignedRoleType: true,
              source: true,
            },
          },
        },
      },
    },
  });

  if (!eventMatch) {
    return { success: false, error: "Event match not found." };
  }

  const supportAssignments = await db.eventMatchSupportAssignment.findMany({
    where: { eventMatchId, organisationId },
    select: { playerId: true, plannedRole: true },
  });

  // ADR-0106: EventSquadPlayer.playerId/EventMatchSupportAssignment.playerId are now nullable
  // (a GuestPlayer participant uses guestPlayerId instead). GuestPlayer participation is not yet
  // wired into this seeding path (Event GuestPlayer integration is a later, separate change) --
  // filtering nulls here is a no-op today (no write path produces one yet) and keeps this
  // function's existing Player-only behaviour unchanged in the meantime.
  const squadPlayerIds = new Set(
    eventMatch.eventSquad.players.map((sp) => sp.playerId).filter((id): id is string => id !== null),
  );
  const allPlayerIds = new Set<string>([
    ...squadPlayerIds,
    ...supportAssignments.map((sa) => sa.playerId).filter((id): id is string => id !== null),
  ]);

  const supportPlayerRoles = new Map<string, string>();
  for (const sa of supportAssignments) {
    if (sa.plannedRole && sa.playerId) {
      supportPlayerRoles.set(sa.playerId, sa.plannedRole);
    }
  }

  const liveEventRows = await db.eventLiveMatchEvent.findMany({
    where: {
      eventMatchId,
      organisationId,
      OR: [
        { correctionType: null },
        { correctionType: "CORRECTION" },
      ],
      eventType: { in: ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET"] },
    },
    select: {
      id: true,
      eventType: true,
      playerId: true,
      secondaryPlayerId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // A reversed goal/scorer/assist must not survive into the seeded report — the same class of
  // bug League's own seedReportFromLiveSession() already fixed (ADR-0133 H1 follow-up), found
  // here independently during ADR-0138 Bundle 9's evidence-consumer audit and now closed with
  // the shared `getEventReversedEventIds()` helper rather than a fourth re-derivation.
  const reversedEventIds = await getEventReversedEventIds(eventMatchId, organisationId);
  const liveEvents = liveEventRows.filter((e) => !reversedEventIds.has(e.id));

  const goalsFor = liveEvents.filter((e) => e.eventType === "GOAL_FOR").length;
  const goalsAgainst = liveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length;

  const scorerEvents = liveEvents.filter((e) => e.eventType === "SCORER_SET" && e.playerId !== null);
  const assistEvents = liveEvents.filter((e) => e.eventType === "ASSIST_SET" && e.playerId !== null);

  try {
    const report = await db.eventPostMatchReport.create({
      data: {
        eventMatchId,
        status: "DRAFT",
        ourScore: goalsFor,
        opponentScore: goalsAgainst,
        organisationId,
        playerReports: {
          create: Array.from(allPlayerIds).map((playerId) => ({
            playerId,
            attendanceStatus: "PRESENT",
            role: supportPlayerRoles.get(playerId) ?? undefined,
            organisationId,
          })),
        },
        goalEvents: {
          create: scorerEvents.map((e) => ({
            playerId: e.playerId!,
            type: "NORMAL",
            organisationId,
          })),
        },
        assistEvents: {
          create: assistEvents.map((e) => ({
            playerId: e.playerId!,
            type: "NORMAL",
            organisationId,
          })),
        },
      },
    });

    return {
      success: true,
      eventMatchId,
      reportId: report.id,
      status: report.status,
      alreadyExisted: false,
    };
  } catch (error) {
    // ADR-0146 §12 — a genuine race (manual and TIMEOUT `finishLiveReporting` both reaching this
    // branch for the same event match): both compute identical derived data from the same,
    // already-persisted EventLiveMatchEvent rows, so adopting whichever create() actually won is
    // correct, not a data loss — mirrors League's seedReportFromLiveSession() hardening above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingAfterRace = await db.eventPostMatchReport.findFirst({
        where: { eventMatchId, organisationId },
        select: { id: true, status: true },
      });
      if (!existingAfterRace) throw error;
      return {
        success: true,
        eventMatchId,
        reportId: existingAfterRace.id,
        status: existingAfterRace.status,
        alreadyExisted: true,
      };
    }
    throw error;
  }
}

export type CompleteEventReportResult =
  | {
      success: true;
      eventMatchId: string;
      /** Non-blocking post-match learning outcome (ADR-0127); `undefined` if it was not run. */
      learning?: import("@/lib/evidence/post-match-learning").PostMatchLearningResult;
    }
  | { success: false; error: string };

/**
 * Event-side completion transition (DRAFT/REPORTED -> LOCKED), owning what
 * `completeEventMatchReportAction` previously reimplemented inline (ARR-0030). Reuses
 * League's `canTransitionTo`/`hasUnknownAttendance` from `report-domain.ts` directly --
 * verified reusable as-is (ARR-0030's own containment note said not to assume this
 * without checking): both operate purely on the shared `MatchReportStatus` enum and a
 * generic `{ attendanceStatus: string }[]` shape, and Event's actual completion pattern
 * (DRAFT or REPORTED -> LOCKED directly, no separate submit step) is already exactly
 * what `canTransitionTo`'s existing transition table allows.
 *
 * After the status write, resolves opponent identity and runs the shared post-match
 * learning pipeline (ADR-0104) -- the same `runPostMatchLearning()` League's
 * `completeReport()` calls, not a second implementation.
 */
export async function completeEventReport(
  reportId: string,
  orgFilter: OrgFilterMode,
): Promise<CompleteEventReportResult> {
  const report = await db.eventPostMatchReport.findFirst({
    where: { id: reportId, ...orgFilter.filter },
    include: { playerReports: true },
  });

  if (!report) return { success: false, error: "Report not found." };

  if (!canTransitionTo(report.status, "LOCKED").allowed) {
    return { success: false, error: "Only DRAFT or REPORTED reports can be completed." };
  }

  if (hasUnknownAttendance(report.playerReports)) {
    return {
      success: false,
      error: "Cannot complete report: some players have unknown attendance. Mark all players as Present, No show, or absent.",
    };
  }

  // ADR-0146 §8/§15/D14 — see report-mutations.ts's completeReport() for the full rationale
  // (League/Event parity, D13). Wrapped in runWithTenantOrganisationId -- MatchPeriodTimingResolution
  // is RLS-scoped and this check runs before any tenant context this function otherwise sets.
  const timingBlockers = await runWithTenantOrganisationId(orgFilter.organisationId, async () => {
    const { getTimingSubmissionBlockers } = await import("@/lib/live-match/timing-review");
    const { buildEventMatchRef } = await import("@/lib/evidence/adapters/event-evidence-adapter");
    return getTimingSubmissionBlockers(await buildEventMatchRef(report.eventMatchId));
  });
  if (timingBlockers.length > 0) {
    return { success: false, error: `Cannot complete report: ${timingBlockers.join(" ")}` };
  }

  await db.eventPostMatchReport.update({
    where: { id: reportId },
    data: { status: "LOCKED" as MatchReportStatus, completedAt: new Date() },
  });

  const { resolveEventOpponentOnReportCompletion } = await import("@/lib/opponents/resolve-opponent");
  await resolveEventOpponentOnReportCompletion(report.eventMatchId);

  let learning: import("@/lib/evidence/post-match-learning").PostMatchLearningResult | undefined;
  try {
    const { buildEventMatchRef } = await import("@/lib/evidence/adapters/event-evidence-adapter");
    const { runPostMatchLearning } = await import("@/lib/evidence/post-match-learning");
    const ref = await buildEventMatchRef(report.eventMatchId);
    learning = await runPostMatchLearning(ref, orgFilter, "REPORT_COMPLETION");
  } catch {
    // Post-match learning must not block report completion -- ADR-0104/ADR-0127, mirrors
    // League's completeReport(). Authoritative outcome is the PostMatchLearningRun row.
  }

  return { success: true, eventMatchId: report.eventMatchId, learning };
}
