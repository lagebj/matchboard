export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { TeamDetail } from "@/components/team/team-detail";
import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import { getIncomingCandidatesForTeam, getOutgoingCandidatesForTeam } from "@/lib/selection/movement-candidate";
import { getPlayerLocksForRound } from "@/lib/selection/player-lock";
import { getBestLineup, getFormationsForTeam } from "@/lib/best-lineup/best-lineup";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getTeamsResultsOverview } from "@/lib/teams/get-teams-results-overview";
import { getTeamSeasonProfile } from "@/lib/team-season-profile/service";
import { rankPatterns, selectTopPatternKeys } from "@/lib/team-season-profile/build-profile";
import { presentPattern, type PatternViewModel } from "@/lib/team-season-profile/presentation";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";

type TeamPageProps = {
  params: Promise<{
    orgSlug: string;
    teamId: string;
  }>;
  searchParams: Promise<{
    periodId?: string;
    tab?: string;
  }>;
};

export default async function TeamDetailPage({ params, searchParams }: TeamPageProps) {
  const { orgSlug, teamId } = await params;
  const { periodId, tab } = await searchParams;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const [team, orderedTeamIds] = await Promise.all([
    db.team.findFirst({
      where: { id: teamId, archivedAt: null, ...orgWhere },
      include: {
        group: {
          select: { id: true, name: true, slug: true },
        },
        corePlayers: {
          where: { removedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            secondaryPosition: true,
            tertiaryPosition: true,
            goalkeeperAbility: true,
            nonRotatable: true,
            reducedMatchLoadAllowed: true,
            currentAvailability: true,
            active: true,
            supportSuitability: true,
            developmentReadiness: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        },
        fromRotationPaths: {
          include: { toTeam: { select: { id: true, name: true } } },
          orderBy: [{ priority: "asc" }],
        },
        toRotationPaths: {
          include: { fromTeam: { select: { id: true, name: true } } },
          orderBy: [{ priority: "asc" }],
        },
      },
    }),
    db.team.findMany({
      where: { archivedAt: null, ...orgWhere },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!team) {
    notFound();
  }

  // Touchline Design Atlas (ADR-0136 Phase 6, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md
  // §D`): "current record from canonical matches" -- reuses the same canonical
  // `getTeamsResultsOverview()` the Teams overview page already calls. ADR-0156 §07 §2: the
  // selected League Season is now explicit and URL-backed (`?periodId=`), using the exact same
  // "most recent by startDate when unselected" default Teams overview itself uses, rather than
  // a second independent "most recently started" lookup -- record, Team Season Profile, and the
  // Patterns tab all read the one selected season consistently.
  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...orgWhere },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const selectedLeagueSeasonId = periodId ?? leagueSeasons[0]?.id ?? null;
  const selectedLeagueSeason = selectedLeagueSeasonId ? leagueSeasons.find((s) => s.id === selectedLeagueSeasonId) ?? null : null;

  const teamRecord = selectedLeagueSeasonId
    ? (await getTeamsResultsOverview(selectedLeagueSeasonId, ctx.orgFilter)).rows.find((r) => r.teamId === team.id) ?? null
    : null;

  // ADR-0156: deterministic Team Season Profile for the selected season. Never calls an AI
  // provider; works identically whether or not the organisation has AI enabled (§16).
  const seasonProfile = selectedLeagueSeasonId
    ? await getTeamSeasonProfile({ organisationId: ctx.organisationId, teamId: team.id, leagueSeasonId: selectedLeagueSeasonId, orgFilter: ctx.orgFilter })
    : null;

  const referencedPlayerIds = [...new Set(seasonProfile?.patterns.flatMap((p) => p.subjects.playerIds ?? []) ?? [])];
  const referencedPlayers = referencedPlayerIds.length > 0
    ? await db.player.findMany({ where: { id: { in: referencedPlayerIds }, ...orgWhere }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const playerNameById = new Map(referencedPlayers.map((p) => [p.id, formatPlayerName(p)]));
  const playerName = (id: string) => playerNameById.get(id) ?? id;

  const rankedPatterns = seasonProfile ? rankPatterns(seasonProfile.patterns) : [];
  const summaryKeys = new Set(selectTopPatternKeys(rankedPatterns, 3, true));
  const strongestKeys = new Set(selectTopPatternKeys(rankedPatterns, 5, true));
  const patternViewByKey = new Map<string, PatternViewModel>(rankedPatterns.map((p) => [p.key, presentPattern(p, playerName)]));

  const summaryPatterns = rankedPatterns.filter((p) => summaryKeys.has(p.key)).map((p) => patternViewByKey.get(p.key)!);
  const strongestPatterns = rankedPatterns.filter((p) => strongestKeys.has(p.key)).map((p) => patternViewByKey.get(p.key)!);
  const familyPatterns = (family: string) => rankedPatterns.filter((p) => p.family === family).map((p) => patternViewByKey.get(p.key)!);

  // ADR-0156 §06 §7 / Slice 7: optional latest weekly Assistant Coach excerpt. Reads an already-
  // completed review only -- never generates one for this page load (opening Patterns never
  // calls an AI provider).
  const latestWeeklyReview = await db.aiAdvisorReview.findFirst({
    where: { organisationId: ctx.organisationId, capability: "WEEKLY_TEAM_REVIEW", scopeType: "TEAM_WEEK", scopeId: { startsWith: `${team.id}:` }, status: "SUCCEEDED" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });
  let weeklyExcerpt: { reviewHref: string; insights: Array<{ title: string; body: string }> } | null = null;
  if (latestWeeklyReview) {
    const weeklyInsights = await db.aiAdvisorInsight.findMany({
      where: { organisationId: ctx.organisationId, reviewId: latestWeeklyReview.id, state: "ACTIVE", analysisRole: { in: ["RECURRING_PATTERN", "NEXT_FOCUS"] } },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { title: true, body: true },
    });
    if (weeklyInsights.length > 0) {
      weeklyExcerpt = { reviewHref: `/o/${orgSlug}/teams/${team.id}/review`, insights: weeklyInsights };
    }
  }

  const seasonLabel = selectedLeagueSeason
    ? formatPhaseDisplay({
        seasonName: selectedLeagueSeason.name,
        phaseName: selectedLeagueSeason.name,
        startDate: new Date(selectedLeagueSeason.startDate),
        endDate: new Date(selectedLeagueSeason.endDate),
      }).combinedLabel
    : "No phase";

  const [bestLineup, teamFormations, teamFocuses] = await Promise.all([
    getBestLineup(teamId, ctx.orgFilter),
    getFormationsForTeam(teamId, ctx.orgFilter),
    db.teamFocus.findMany({
      where: { teamId: team.id, ...orgWhere },
      orderBy: [{ startedAt: "desc" }],
      select: {
        id: true,
        statement: true,
        context: true,
        status: true,
        startedAt: true,
        completedAt: true,
        closedAt: true,
        linkedIntentId: true,
      },
    }),
  ]);

  const teamIds = orderedTeamIds.map((t) => t.id);
  const currentIndex = teamIds.indexOf(team.id);
  const previousTeamId = currentIndex > 0 ? teamIds[currentIndex - 1] : null;
  const nextTeamId = currentIndex >= 0 && currentIndex < teamIds.length - 1 ? teamIds[currentIndex + 1] : null;

  const activeRound = await db.matchRound.findFirst({
    where: { status: { in: ["DRAFT"] }, ...orgWhere },
    include: {
      matches: {
        select: { id: true, teamId: true },
        orderBy: { startsAt: "asc" },
      },
      warnings: {
        where: { teamId: team.id },
        select: { id: true, rule: true, message: true, severity: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let currentRoundLabel: string | null = null;
  let currentRoundId: string | null = null;
  let currentRoundStatus = "Not generated";

  if (activeRound) {
    const firstMatch = await db.match.findFirst({
      where: { matchRoundId: activeRound.id, ...orgWhere },
      select: { startsAt: true },
      orderBy: { startsAt: "asc" },
    });
    currentRoundLabel = firstMatch ? formatIsoWeekLabel(firstMatch.startsAt) : activeRound.name;
    currentRoundId = activeRound.id;

    const hasHardBlock = activeRound.warnings.some((w) => w.severity === "HARD_BLOCK");
    currentRoundStatus = hasHardBlock ? "Blocked" : "Draft";
  }

  const matchIdsThisRound = activeRound?.matches.map((m) => m.id) ?? [];
  const _teamMatchIdsThisRound = activeRound?.matches.filter((m) => m.teamId === team.id).map((m) => m.id) ?? [];

  const [selectionsThisRound, movementHistory, finalizedRounds] = await Promise.all([
    matchIdsThisRound.length > 0
      ? db.selection.findMany({
          where: {
            matchId: { in: matchIdsThisRound },
            status: { in: ["DRAFT", "FINALIZED"] },
            ...orgWhere,
          },
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                coreTeamId: true,
                coreTeam: { select: { id: true, name: true } },
              },
            },
            match: {
              select: { id: true, teamId: true, team: { select: { id: true, name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    db.movementLedger.findMany({
      where: {
        OR: [{ fromTeamId: team.id }, { toTeamId: team.id }],
        ...orgWhere,
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
        matchRound: { select: { id: true, name: true } },
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.matchRound.findMany({
      where: {
        status: "FINALIZED",
        matches: { some: { teamId: team.id } },
        ...orgWhere,
      },
      include: {
        matches: {
          where: { teamId: team.id },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const teamSelThisRound = matchIdsThisRound.length > 0 ? selectionsThisRound : [];
  const allMatchTeamMap = new Map<string, string>();
  for (const sel of teamSelThisRound) {
    allMatchTeamMap.set(sel.matchId, sel.match.team.name);
  }

  const playerLocksThisRound = activeRound
    ? await getPlayerLocksForRound(activeRound.id, ctx.orgFilter)
    : [];
  const pinByPlayerId = new Map(playerLocksThisRound.map((lock) => [lock.playerId, lock.lockType]));

  const coreSelected = teamSelThisRound
    .filter((s) => s.role === "CORE" && s.player.coreTeamId === team.id)
    .map((s) => ({
      playerId: s.player.id,
      playerName: formatPlayerName(s.player),
      role: s.role,
      explanation: (s.explanation as Record<string, unknown> | null)?.summary as string | null ?? null,
      pin: pinByPlayerId.get(s.player.id) ?? null,
    }));

  const coreCountThisRound = new Set(coreSelected.map((s) => s.playerId)).size;

  const sentAsSupport = teamSelThisRound
    .filter((s) => s.player.coreTeamId === team.id && (s.role === "SUPPORT" || s.role === "DEVELOPMENT"))
    .map((s) => ({
      playerId: s.player.id,
      playerName: formatPlayerName(s.player),
      role: s.role,
      destinationTeamName: allMatchTeamMap.get(s.matchId) ?? "Unknown",
      explanation: (s.explanation as Record<string, unknown> | null)?.summary as string | null ?? null,
      pin: pinByPlayerId.get(s.player.id) ?? null,
    }));

  const receivedPlayers = teamSelThisRound
    .filter((s) => s.player.coreTeamId !== team.id && ["SUPPORT", "BACKFILL", "DEVELOPMENT"].includes(s.role))
    .map((s) => ({
      playerId: s.player.id,
      playerName: formatPlayerName(s.player),
      role: s.role,
      sourceTeamName: s.player.coreTeam?.name ?? "Unassigned",
      explanation: (s.explanation as Record<string, unknown> | null)?.summary as string | null ?? null,
    }));

  const FLOATING_ROLES = new Set(["SUPPORT", "BACKFILL", "DEVELOPMENT", "CONFIDENCE_REBUILD", "CORE_MATCH_DROP", "REDUCED_MATCH_LOAD_DROP"]);
  const droppedPlayers = teamSelThisRound
    .filter((s) => s.player.coreTeamId === team.id && FLOATING_ROLES.has(s.role) && s.role !== "SUPPORT" && s.role !== "DEVELOPMENT")
    .map((s) => ({
      playerId: s.player.id,
      playerName: formatPlayerName(s.player),
      role: s.role,
      explanation: (s.explanation as Record<string, unknown> | null)?.summary as string | null ?? null,
      pin: pinByPlayerId.get(s.player.id) ?? null,
    }));

  const roundWarnings = (activeRound?.warnings ?? []).map((w) => ({
    id: w.id,
    rule: w.rule,
    message: w.message,
    severity: w.severity,
    matchRoundId: activeRound?.id ?? "",
    roundLabel: currentRoundLabel ?? "",
  }));

  const movementEntries = movementHistory.map((entry) => {
    const roundLabel = entry.match
      ? formatIsoWeekLabel(entry.match.startsAt)
      : entry.matchRound?.name ?? "Unknown round";
    return {
      id: entry.id,
      playerName: formatPlayerName(entry.player),
      playerId: entry.player.id,
      role: entry.role,
      fromTeamName: entry.fromTeam.name,
      toTeamName: entry.toTeam.name,
      roundLabel,
      matchRoundId: entry.matchRoundId ?? "",
      reason: entry.reason,
      isDraft: entry.isDraft,
    };
  });

  const finalizedRoundsWithCounts = await Promise.all(
    finalizedRounds.map(async (round) => {
      const roundMatchIds = round.matches.map((m) => m.id);
      const roundSelections = roundMatchIds.length > 0
        ? await db.selection.findMany({
            where: {
              matchId: { in: roundMatchIds },
              status: "FINALIZED",
              ...orgWhere,
            },
            select: {
              playerId: true,
              role: true,
              player: { select: { coreTeamId: true } },
            },
          })
        : [];
      const firstMatch = await db.match.findFirst({
        where: { matchRoundId: round.id, ...orgWhere },
        select: { startsAt: true },
        orderBy: { startsAt: "asc" },
      });
      return {
        matchRoundId: round.id,
        roundLabel: firstMatch ? formatIsoWeekLabel(firstMatch.startsAt) : round.name,
        coreCount: new Set(
          roundSelections
            .filter((s) => s.player.coreTeamId === team.id && s.role === "CORE")
            .map((s) => s.playerId),
        ).size,
        supportSentCount: roundSelections.filter(
          (s) => s.player.coreTeamId === team.id && s.role === "SUPPORT",
        ).length,
        supportReceivedCount: roundSelections.filter(
          (s) => s.player.coreTeamId !== team.id && s.role === "SUPPORT",
        ).length,
        squadRepairReceivedCount: roundSelections.filter(
          (s) => s.role === "BACKFILL",
        ).length,
        developmentReceivedCount: roundSelections.filter(
          (s) => s.player.coreTeamId !== team.id && s.role === "DEVELOPMENT",
        ).length,
      };
    }),
  );

  const allRotationPaths = [
    ...team.fromRotationPaths.map((p) => ({
      id: p.id,
      role: p.role,
      direction: "outgoing" as const,
      fromTeamId: team.id,
      fromTeamName: team.name,
      toTeamId: p.toTeam.id,
      toTeamName: p.toTeam.name,
      purpose: p.purpose,
      priority: p.priority,
      minimumCount: p.minimumCount,
      targetCount: p.targetCount,
      maximumCount: p.maximumCount,
      cooldownRounds: p.cooldownRounds,
      active: p.active,
    })),
    ...team.toRotationPaths.map((p) => ({
      id: p.id,
      role: p.role,
      direction: "incoming" as const,
      fromTeamId: p.fromTeam.id,
      fromTeamName: p.fromTeam.name,
      toTeamId: team.id,
      toTeamName: team.name,
      purpose: p.purpose,
      priority: p.priority,
      minimumCount: p.minimumCount,
      targetCount: p.targetCount,
      maximumCount: p.maximumCount,
      cooldownRounds: p.cooldownRounds,
      active: p.active,
    })),
  ];

  const [incomingCandidates, outgoingCandidates, eligibleCandidates, unassignedPlayers] = await Promise.all([
    getIncomingCandidatesForTeam(team.id, ctx.orgFilter),
    getOutgoingCandidatesForTeam(team.id, ctx.orgFilter),
    db.player.findMany({
      where: {
        removedAt: null,
        active: true,
        coreTeamId: { in: [team.id, ...team.toRotationPaths.filter((p) => p.active).map((p) => p.fromTeam.id)] },
        ...orgWhere,
      },
      select: { id: true, firstName: true, lastName: true, coreTeamId: true, nonRotatable: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.player.findMany({
      where: {
        removedAt: null,
        active: true,
        coreTeamId: null,
        ...orgWhere,
      },
      select: { id: true, firstName: true, lastName: true, primaryPosition: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const data = {
    teamId: team.id,
    teamName: team.name,
    groupId: team.group.id,
    groupName: team.group.name,
    groupSlug: team.group.slug,
    targetSquadSize: team.targetSquadSize,
    minAcceptedSquadSize: team.minAcceptedSquadSize,
    maxSquadSize: team.maxSquadSize,
    minCorePlayers: team.minCorePlayers,
    supportPriority: team.supportPriority,
    minSupportPlayers: team.minSupportPlayers,
    targetSupportCount: team.targetSupportCount,
    maxSupportCount: team.maxSupportCount,
    minSupportCount: team.minSupportCount,
    developmentSlots: team.developmentSlots,
    corePlayers: team.corePlayers,
    currentRoundStatus,
    currentRoundLabel,
    currentRoundId,
    coreCountThisRound,
    record: teamRecord
      ? { matchesPlayed: teamRecord.matchesPlayed, wins: teamRecord.wins, draws: teamRecord.draws, losses: teamRecord.losses }
      : null,
    selectedPeriodId: selectedLeagueSeasonId,
    periodOptions: leagueSeasons.map((s) => ({
      id: s.id,
      label: formatPhaseDisplay({ seasonName: s.name, phaseName: s.name, startDate: new Date(s.startDate), endDate: new Date(s.endDate) }).combinedLabel,
    })),
    initialTab: tab === "patterns" ? ("patterns" as const) : null,
    summaryPatterns,
    patternsTabData: {
      seasonLabel,
      completedMatches: seasonProfile?.sample.completedMatches ?? 0,
      hasApproximateTiming: rankedPatterns.some((p) => p.approximateTiming),
      strongest: strongestPatterns,
      rhythm: familyPatterns("MATCH_RHYTHM"),
      themes: familyPatterns("TACTICAL_THEME"),
      playerContributions: familyPatterns("PLAYER_CONTRIBUTION"),
      combinations: familyPatterns("COMBINATION"),
      weeklyExcerpt,
    },
    sentAsSupportCount: sentAsSupport.length,
    receivedSupportCount: receivedPlayers.filter((p) => p.role === "SUPPORT").length,
    receivedSquadRepairCount: receivedPlayers.filter((p) => p.role === "BACKFILL").length,
    receivedDevelopmentCount: receivedPlayers.filter((p) => p.role === "DEVELOPMENT").length,
    warningCount: roundWarnings.length,
    selectedPlayers: coreSelected,
    sentPlayers: sentAsSupport,
    receivedPlayers,
    droppedPlayers,
    roundWarnings,
    movementHistory: movementEntries,
    finalizedRounds: finalizedRoundsWithCounts,
    rotationPaths: allRotationPaths,
    incomingCandidates,
    outgoingCandidates,
    eligibleCandidates,
    teamOptions: orderedTeamIds.map((t) => ({ id: t.id, name: t.name })),
    unassignedPlayers,
    previousTeamId,
    nextTeamId,
    bestLineup,
    bestLineupFormations: teamFormations,
    bestLineupPlayers: team.corePlayers.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: p.goalkeeperAbility,
    })),
    teamFocuses: teamFocuses.map((f) => ({
      id: f.id,
      statement: f.statement,
      context: f.context,
      status: f.status as "ACTIVE" | "COMPLETED" | "CLOSED",
      startedAt: f.startedAt.toISOString(),
      completedAt: f.completedAt?.toISOString() ?? null,
      closedAt: f.closedAt?.toISOString() ?? null,
      linkedIntentId: f.linkedIntentId,
    })),
  };

  return <TeamDetail data={data} />;
}