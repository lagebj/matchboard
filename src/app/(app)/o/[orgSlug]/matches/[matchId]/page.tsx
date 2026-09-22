import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { MatchDetailShell } from "@/components/matches/match-detail/match-detail-shell";
import { getActiveCoachingIntentForMatch } from "@/lib/coaching/coaching-intent";
import { requirePageActorContext, hasGroupAccess } from "@/lib/auth/actor-context";
import { getOpponentHistory } from "@/lib/audit/opponent-history";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getPlannedRotation } from "@/lib/planned-rotation/planned-rotation";
import { getMatchFormatOverrideState } from "@/lib/matches/match-format-override";
import { deriveMatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { hasLeagueMatchPassed } from "@/lib/match-date-utils";
import { canStartLiveReporting } from "@/lib/matches/can-live-report";
import { deriveMatchDetailSurfaceState } from "@/lib/matches/match-detail-view-model";
import { getMatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import { formatKickoffTime } from "@/lib/date-utils";
import { getCompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; matchId: string }>;
}) {
  const { orgSlug, matchId } = await params;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const match = await db.match.findUnique({
    where: { id: matchId, ...orgWhere },
    include: {
      team: { select: { id: true, name: true, footballGroupId: true, kitColor: true } },
      matchRound: { select: { id: true, name: true, status: true, leagueSeasonId: true, leagueSeason: { select: { id: true, startDate: true, endDate: true } } } },
      selections: {
        where: { status: { in: ["DRAFT", "FINALIZED"] } },
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              secondaryPosition: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) notFound();

  const activeIntent = await getActiveCoachingIntentForMatch(matchId, ctx.orgFilter);

  const postMatchReport = await db.postMatchReport.findUnique({
    where: { matchId, ...orgWhere },
    select: { status: true, homeGoals: true, awayGoals: true },
  });

  const liveSession = await db.liveMatchSession.findUnique({
    where: { matchId, ...orgWhere },
    select: { status: true },
  });
  const isLive = liveSession?.status === "ACTIVE";

  // ADR-0146 — match-format override state for the Match detail's format control
  // (complete-or-inherit, frozen once Live Reporting has started).
  const matchFormatState = await getMatchFormatOverrideState(matchId, ctx.organisationId);

  const lifecycleStatus = deriveMatchLifecycleStatus({
    matchStatus: match.status,
    reportStatus: postMatchReport?.status ?? "NONE",
    hasPassed: hasLeagueMatchPassed({ startsAt: match.startsAt, status: match.status }),
    isLive,
    roundStatus: match.matchRound.status,
    planningClosedAt: match.planningClosedAt,
    startsAt: match.startsAt,
  });
  const surfaceState = deriveMatchDetailSurfaceState(lifecycleStatus);

  // "Follow live" is a read-only viewer entry point (ADR-0086 amendment) — gated server-side
  // on the same GroupAccess (GROUP_COACH or GROUP_VIEWER) chain the realtime ticket route
  // itself enforces independently. Hiding the button when false is a UX convenience, not the
  // actual security boundary (AGENTS.md: "UI-only protection is insufficient").
  const canFollowLive = match.team.footballGroupId
    ? hasGroupAccess(ctx, match.team.footballGroupId)
    : false;

  // Match-specific player absence (production consistency pass item #3) — factual state for
  // this one match, independent of the player's round/team assignment above.
  const absences = await db.matchReportAbsence.findMany({
    where: { matchId, organisationId: ctx.organisationId },
    select: { playerId: true, reason: true },
  });
  const absenceReasonByPlayerId = new Map(absences.map((a) => [a.playerId, a.reason as string]));

  const selectionData = match.selections.map((s) => {
    const explanation = s.explanation as Record<string, unknown> | null;
    return {
      id: s.id,
      playerId: s.playerId,
      playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      playerFirstName: s.player.firstName,
      playerLastName: s.player.lastName,
      coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
      role: s.role,
      primaryPosition: s.player.primaryPosition,
      secondaryPosition: s.player.secondaryPosition,
      status: s.status,
      manualOverride: (explanation?.manualOverride as boolean) ?? false,
      selectionReason: (explanation?.summary as string) ?? "",
      priorityScore: (explanation?.priorityScore as number | null) ?? null,
      overrideReason: s.overrideReason,
      controlledDoubleLoad: s.controlledDoubleLoad ?? false,
      matchdayResponsibility: s.matchdayResponsibility ?? undefined,
      absenceReason: absenceReasonByPlayerId.get(s.playerId) ?? null,
    };
  });

  const helpers = await db.matchHelperAssignment.findMany({
    where: { matchId: match.id },
    select: {
      id: true,
      playerId: true,
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          secondaryPosition: true,
          coreTeam: { select: { id: true, name: true } },
        },
      },
    },
  });

  const helperSelectionData = helpers.map((h) => ({
    id: `helper-${h.id}`,
    playerId: h.playerId,
    playerName: `${h.player.firstName} ${h.player.lastName ?? ""}`.trim(),
    playerFirstName: h.player.firstName,
    playerLastName: h.player.lastName,
    coreTeamName: h.player.coreTeam?.name ?? "Unassigned",
    role: "HELPER" as const,
    primaryPosition: h.player.primaryPosition,
    secondaryPosition: h.player.secondaryPosition,
    status: "FINALIZED" as const,
    manualOverride: false,
    selectionReason: "Helper assignment",
    priorityScore: null,
    overrideReason: null,
    controlledDoubleLoad: false,
    matchdayResponsibility: undefined,
    absenceReason: absenceReasonByPlayerId.get(h.playerId) ?? null,
  }));

  const warnings = await db.warning.findMany({
    where: { matchId: match.id, ...orgWhere },
    orderBy: [{ severity: "desc" }],
  });

  // Lineup existence only (Touchline Design Atlas, ADR-0136) — one bounded, single-row query, not
  // the unbounded-tree class that caused Today's own performance issue
  // (docs/domain/touchline-atlas-provenance.md §17). Feeds only the Match preparation checklist's
  // "Lineup set" item; the real lineup content renders directly via `MatchTacticsPanel` on
  // Overview (post-launch correction, 2026-09-18 — see match-detail-tabs.ts), which fetches its
  // own data and is never read further here.
  const lineup = await db.matchLineup.findFirst({ where: { matchId, ...orgWhere }, select: { id: true } });

  const warningData = warnings.map((w) => ({
    id: w.id,
    code: w.rule,
    severity: w.severity,
    message: w.message,
  }));

  const matchIntent = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: matchId, ...orgWhere },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  const plannedRotation = await getPlannedRotation(match.id, match.teamId, ctx.orgFilter);

  let opponentHistory: Awaited<ReturnType<typeof getOpponentHistory>> = null;
  let opponentConcernCount = 0;
  let opponentLatestConcernDate: string | null = null;
  let currentMatchStyleTags: string[] = [];

  if (match.opponentTeamId && match.team.footballGroupId) {
    opponentHistory = await getOpponentHistory(match.opponentTeamId, match.team.footballGroupId, ctx.orgFilter);
    if (match.opponentTeamId) {
      const [cc, lcd, currentObs] = await Promise.all([
        db.opponentEncounterObservation.count({
          where: { opponentTeamId: match.opponentTeamId, overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] } },
        }),
        db.opponentEncounterObservation.findFirst({
          where: { opponentTeamId: match.opponentTeamId, overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        db.opponentEncounterObservation.findFirst({
          where: { matchId: match.id, ...ctx.orgFilter.filterNullable },
          select: { playingStyleTags: true },
        }),
      ]);
      opponentConcernCount = cc;
      opponentLatestConcernDate = lcd?.createdAt.toISOString() ?? null;
      currentMatchStyleTags = currentObs?.playingStyleTags ?? [];
    }
  }

  // Bounded, surface-scoped read model (`08_COMPONENT_AND_ROUTE_ARCHITECTURE.md`: "Do not fetch
  // the complete post-match graph for an upcoming match.") — only queried once the match has
  // actually moved into the AFTER composition.
  const afterData =
    surfaceState === "AFTER"
      ? await getMatchDetailAfterData({ matchId, organisationId: ctx.organisationId, orgFilter: ctx.orgFilter })
      : undefined;

  // ADR-0149: the BEFORE-match contextual Advisor panel is gone -- Match Insights (self-fetched
  // client-side by MatchTacticsPanel, see match-insights-actions.ts) supersedes it, including its
  // AI-enrichment content (via getMatchInsights() -> getPlannedMatchAdvisorViewModel()
  // internally). No page-load-time Advisor query is needed for the BEFORE surface any more.

  // Completed-match Advisor panel (`post_match_review`) — never queried for the BEFORE surface.
  const completedMatchAdvisorViewModel =
    surfaceState === "AFTER"
      ? await getCompletedMatchAdvisorViewModel({ organisationId: ctx.organisationId, matchId: match.id })
      : null;

  const allSelections = [...selectionData, ...helperSelectionData];

  // Header/meta presentation — reused, never forked (ADR-0125).
  const headerIsHome = match.homeAway === "HOME";
  const headerHasScore = postMatchReport?.homeGoals != null && postMatchReport?.awayGoals != null;
  const headerOwnGoals = !headerHasScore ? null : headerIsHome ? (postMatchReport?.homeGoals ?? null) : (postMatchReport?.awayGoals ?? null);
  const headerOpponentGoals = !headerHasScore ? null : headerIsHome ? (postMatchReport?.awayGoals ?? null) : (postMatchReport?.homeGoals ?? null);
  const headerOutcome =
    headerOwnGoals == null || headerOpponentGoals == null
      ? null
      : headerOwnGoals > headerOpponentGoals
        ? "WON"
        : headerOwnGoals < headerOpponentGoals
          ? "LOST"
          : "DRAWN";

  const presentation = buildMatchPresentation({
    id: match.id,
    teamName: match.team.name,
    opponentName: match.opponent,
    isHome: headerIsHome,
    kickoffAt: match.startsAt,
    lifecycleStatus,
    ownGoals: headerOwnGoals,
    opponentGoals: headerOpponentGoals,
    outcome: headerOutcome,
    cancelledReason: match.status === "CANCELLED" ? match.cancelledReason : null,
  });

  const dateLabel = match.startsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const kickoffTimeLabel = formatKickoffTime(match.startsAt);

  return (
    <MatchDetailShell
      surfaceState={surfaceState}
      matchId={match.id}
      teamId={match.teamId}
      teamName={match.team.name}
      opponent={match.opponent}
      ownKitColor={match.team.kitColor}
      presentation={presentation}
      lifecycleStatus={lifecycleStatus}
      isCancelled={match.status === "CANCELLED"}
      cancelledReason={match.cancelledReason}
      isLive={isLive}
      canLiveReport={canStartLiveReporting({
        lifecycleStatus,
        isCancelled: match.status === "CANCELLED",
        isLive,
      })}
      canFollowLive={canFollowLive}
      venue={match.homeAway}
      matchType={match.matchType}
      gameFormat={match.gameFormat}
      matchFit={match.matchFit}
      dateLabel={dateLabel}
      kickoffTimeLabel={kickoffTimeLabel}
      roundLabel={null}
      matchRoundId={match.matchRoundId}
      matchRoundName={match.matchRound.name}
      notes={match.notes}
      selections={allSelections}
      warnings={warningData}
      hasLineup={Boolean(lineup)}
      plannedRotation={plannedRotation}
      opponentTeamId={match.opponentTeamId ?? null}
      opponentHistory={opponentHistory}
      opponentConcernCount={opponentConcernCount}
      opponentLatestConcernDate={opponentLatestConcernDate}
      currentMatchStyleTags={currentMatchStyleTags}
      coachingIntent={activeIntent?.category ?? undefined}
      coachingIntentId={matchIntent[0]?.id ?? undefined}
      matchFormatState={
        matchFormatState
          ? {
              matchOverride: matchFormatState.matchOverride,
              inheritedFormat: matchFormatState.inheritedFormat,
              liveReportingStarted: matchFormatState.liveReportingStarted,
              frozenFormat: matchFormatState.frozenFormat,
            }
          : undefined
      }
      afterData={afterData}
      phaseStartDate={match.matchRound.leagueSeason?.startDate}
      phaseEndDate={match.matchRound.leagueSeason?.endDate}
      startsAt={match.startsAt}
      completedMatchAdvisorViewModel={completedMatchAdvisorViewModel}
    />
  );
}
