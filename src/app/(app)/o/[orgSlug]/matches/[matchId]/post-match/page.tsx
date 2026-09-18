import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { getMatchCombinationEvidence } from "@/lib/evidence/combination-aggregation";
import { computeGoalAttributionGap } from "@/lib/reports/report-mutations";
import { getMatchTimingReviewItems, getOutOfRangeEventCount } from "@/lib/live-match/timing-review";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { ALL_OBSERVATION_CODES } from "@/lib/evidence/observation-vocabulary";
import { PostMatchReportPageShell } from "@/components/matches/match-detail/post-match-report-page-shell";
import { getMatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { derivePostMatchReportSurfaceState } from "@/lib/matches/match-detail-tabs";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; matchId: string }>;
};

export default async function PostMatchRoute({ params }: PageProps) {
  const { orgSlug, matchId } = await params;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findFirst({
    where: {
      id: matchId,
      ...ctx.orgFilter.filter,
    },
    select: {
      id: true,
      teamId: true,
      opponent: true,
      homeAway: true,
      matchFit: true,
      startsAt: true,
      team: { select: { id: true, name: true, kitColor: true } },
      selections: {
        where: { status: "FINALIZED" },
        select: {
          playerId: true,
          role: true,
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) notFound();

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...ctx.orgFilter.filterNullable },
    include: {
      playerActuals: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
      },
      goals: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ minute: "asc" }],
      },
      assists: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      absences: {
        include: {
          player: {
            select: { firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
      },
      playerStats: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  const plannedSelections = match.selections.map((s) => ({
    playerId: s.playerId,
    playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
    coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
    role: s.role,
  }));

  const initialReport = report ? {
    id: report.id,
    matchId: report.matchId,
    status: report.status,
    homeGoals: report.homeGoals,
    awayGoals: report.awayGoals,
    teamNote: report.teamNote,
    completedBy: report.completedBy,
    completedAt: report.completedAt?.toISOString() ?? null,
    // ADR-0106: PostMatchPlayerActual.playerId/player and Assist.playerId/player are now
    // nullable (a GuestPlayer appearance/assist uses guestPlayerId instead). GuestPlayer-aware
    // post-match reporting UI is a later, separate change; filtered to Player-backed rows as a
    // no-op today (no write path produces a guest row yet).
    playerActuals: report.playerActuals
      .filter((p): p is typeof p & { playerId: string; player: NonNullable<typeof p.player> } =>
        p.playerId !== null && p.player !== null,
      )
      .map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
      coreTeamName: p.player.coreTeam?.name ?? "Unassigned",
      source: p.source,
      attendanceStatus: p.attendanceStatus,
      unplannedAppearanceReason: p.unplannedAppearanceReason,
    })),
    goals: report.goals.map((g) => ({
      id: g.id,
      playerId: g.playerId,
      playerName: g.player ? `${g.player.firstName} ${g.player.lastName ?? ""}`.trim() : undefined,
      minute: g.minute,
      type: g.type,
    })),
    assists: report.assists
      .filter((a): a is typeof a & { playerId: string; player: NonNullable<typeof a.player> } =>
        a.playerId !== null && a.player !== null,
      )
      .map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      type: a.type,
    })),
    absences: report.absences.map((a) => ({
      id: a.id,
      playerId: a.playerId,
      playerName: `${a.player.firstName} ${a.player.lastName ?? ""}`.trim(),
      coreTeamName: a.player.coreTeam?.name ?? "Unassigned",
      reason: a.reason,
      note: a.note,
    })),
    playerStats: report.playerStats.map((s) => ({
      id: s.id,
      playerId: s.playerId,
      playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      goals: s.goals,
      assists: s.assists,
    })),
    teamName: match.team.name,
    opponent: match.opponent,
    homeAway: match.homeAway,
    plannedSelections,
  } : null;

  // 2026-09-17 incident follow-up — a report-review-time signal, independent of the live-
  // reporting outbox's own surfacing, that a match was live-reported but goals are missing
  // scorer attribution (`computeGoalAttributionGap`'s own doc comment). Only meaningful once a
  // report exists to compare against.
  //
  // ADR-0146 §8/§13 — recovered-timing review items and out-of-range event count for the
  // post-match callout/submission gate. Also only meaningful once a report exists; a match that
  // was never live-reported has no MatchPeriodTimingResolution rows to compare against.
  const leagueMatchRef = report ? await buildLeagueMatchRef(matchId) : null;
  const [feedbackEntries, teamReflection, existingObservation, footballObservations, goalAttributionGap, rawTimingReview, outOfRangeEventCount] = await Promise.all([
    db.matchExecutionFeedback.findMany({
      where: { matchId },
      orderBy: [{ category: "asc" }, { playerId: "asc" }],
      select: {
        id: true,
        playerId: true,
        category: true,
        value: true,
        observableBehavior: true,
        nextAction: true,
        note: true,
      },
    }),
    db.teamReflection.findFirst({
      where: { matchId, ...ctx.orgFilter.filterNullable },
      select: { id: true, effort: true, teamCohesion: true, positionalShape: true, recoveryBehavior: true, note: true },
    }),
    db.opponentEncounterObservation.findFirst({
      where: { matchId, ...ctx.orgFilter.filterNullable },
      select: {
        id: true,
        overallEnvironment: true,
        opponentPlayersContext: true,
        opponentStaffContext: true,
        spectatorSidelineContext: true,
        concernCategories: true,
        playingStyleTags: true,
        factualSummary: true,
        followUp: true,
      },
    }),
    db.playerDevelopmentObservation.findMany({
      where: {
        matchId,
        kind: "ATTRIBUTE",
        attributeKey: { in: [...ALL_OBSERVATION_CODES] },
        ...ctx.orgFilter.filter,
      },
      orderBy: { observedAt: "desc" },
      select: {
        id: true,
        playerId: true,
        attributeKey: true,
        direction: true,
        observableNote: true,
        observedAt: true,
      },
    }),
    report ? computeGoalAttributionGap(matchId, ctx.organisationId) : Promise.resolve(null),
    leagueMatchRef ? getMatchTimingReviewItems(leagueMatchRef) : Promise.resolve([]),
    leagueMatchRef ? getOutOfRangeEventCount(leagueMatchRef) : Promise.resolve(0),
  ]);

  const timingReview = rawTimingReview.map((item) => ({
    period: item.period,
    periodLabel: item.periodLabel,
    resolvedDurationMinutes: Math.round(item.resolvedDurationMs / 60000),
    needsReview: item.reviewStatus === "NEEDS_REVIEW",
  }));

  const feedbackData = feedbackEntries.map((f) => ({
    id: f.id,
    playerId: f.playerId,
    category: f.category,
    value: f.value,
    observableBehavior: f.observableBehavior,
    nextAction: f.nextAction,
    note: f.note,
  }));

  // ADR-0106: PostMatchPlayerActual.playerId/player are now nullable (a GuestPlayer appearance
  // uses guestPlayerId instead). GuestPlayer-aware feedback/observation player pickers are a
  // later, separate change; filtered to Player-backed rows as a no-op today (no write path
  // produces a guest row yet).
  const playerOptions = report
    ? report.playerActuals
        .filter(
          (p): p is typeof p & { playerId: string; player: NonNullable<typeof p.player> } =>
            p.attendanceStatus === "PRESENT" && p.playerId !== null && p.player !== null,
        )
        .map((p) => ({
          id: p.playerId,
          name: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
        }))
    : match.selections.map((s) => ({
        id: s.playerId,
        name: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      }));

  const allPlayers = await db.player.findMany({
    where: { removedAt: null, active: true },
    select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const allPlayerOptions = allPlayers.map((p) => ({
    id: p.id,
    name: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
    teamName: p.coreTeam?.name ?? "Unassigned",
  }));

  const reflectionData = teamReflection
    ? {
        effort: teamReflection.effort,
        teamCohesion: teamReflection.teamCohesion,
        positionalShape: teamReflection.positionalShape,
        recoveryBehavior: teamReflection.recoveryBehavior,
        note: teamReflection.note,
      }
    : null;

  const combinationEvidence = initialReport?.status === "LOCKED" ? await getMatchCombinationEvidence(matchId) : [];

  const footballObservationData = footballObservations.map((o) => ({
    id: o.id,
    playerId: o.playerId,
    observationCode: o.attributeKey ?? "",
    polarity: o.direction,
    note: o.observableNote,
    observedAt: o.observedAt.toISOString(),
  }));

  // Header/score orientation — reused, never forked (ADR-0125). Post-Match Report's own surface
  // state (draft/completed) drives phase display here, not the root Match Details lifecycle
  // vocabulary — see `02_PRODUCT_MODEL_AND_LIFECYCLE.md` "Surface B".
  const isHome = match.homeAway === "HOME";
  const ownGoals = initialReport ? (isHome ? initialReport.homeGoals : initialReport.awayGoals) : null;
  const opponentGoals = initialReport ? (isHome ? initialReport.awayGoals : initialReport.homeGoals) : null;
  const outcome =
    ownGoals == null || opponentGoals == null
      ? null
      : ownGoals > opponentGoals
        ? "WON"
        : ownGoals < opponentGoals
          ? "LOST"
          : "DRAWN";

  const surfaceState = derivePostMatchReportSurfaceState(initialReport?.status);
  const presentation = buildMatchPresentation({
    id: match.id,
    teamName: match.team.name,
    opponentName: match.opponent,
    isHome,
    kickoffAt: match.startsAt,
    lifecycleStatus: initialReport?.status === "LOCKED" ? "done" : initialReport ? "report_incomplete" : "played",
    ownGoals,
    opponentGoals,
    outcome,
  });

  // Bounded, surface-scoped read model — shared with Match Details AFTER
  // (`get-match-detail-after-data.ts`), so Summary/Timeline/attendance/aggregate facts are
  // identical wherever they appear, never a second interpretation of the same report.
  const afterData = await getMatchDetailAfterData({ matchId, organisationId: ctx.organisationId, orgFilter: ctx.orgFilter });

  const completedByLabel =
    initialReport?.status === "LOCKED" && initialReport.completedBy
      ? `Completed ${initialReport.completedAt ? new Date(initialReport.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""} by ${initialReport.completedBy}`
      : null;

  return (
    <PostMatchReportPageShell
      matchId={matchId}
      breadcrumbHref={`/o/${orgSlug}/matches/${matchId}`}
      title={`${match.team.name} vs ${match.opponent}`}
      surfaceState={surfaceState}
      completedByLabel={completedByLabel}
      presentation={presentation}
      ownKitColor={match.team.kitColor}
      afterData={afterData}
      reviewHref={`/o/${orgSlug}/matches/${matchId}/review`}
      matchDetailHref={`/o/${orgSlug}/matches/${matchId}`}
      ownTeamName={match.team.name}
      opponentName={match.opponent}
      postMatchPageProps={{
        matchId,
        initialReport,
        allPlayers: allPlayerOptions,
        hasFinalizedSelections: match.selections.length > 0,
        goalAttributionGap,
        timingReview,
        outOfRangeEventCount,
      }}
      observationSectionProps={{
        matchId,
        existingObservation,
        isLocked: initialReport?.status === "LOCKED",
        matchFit: match.matchFit,
      }}
      teamReflectionProps={{ matchId, reflection: reflectionData }}
      footballObservationProps={{
        matchId,
        players: playerOptions,
        existingObservations: footballObservationData,
        isLocked: initialReport?.status === "LOCKED",
      }}
      legacyFeedbackProps={{ feedback: feedbackData, players: playerOptions }}
      combinationEvidenceProps={{ evidence: combinationEvidence, players: playerOptions }}
    />
  );
}