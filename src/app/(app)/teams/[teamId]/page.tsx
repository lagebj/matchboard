export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { TeamDetail } from "@/components/team/team-detail";
import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { formatPlayerName } from "@/lib/player-metrics";

type TeamPageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: TeamPageProps) {
  const { teamId } = await params;

  const [team, orderedTeamIds] = await Promise.all([
    db.team.findUnique({
      where: { id: teamId, archivedAt: null },
      include: {
        corePlayers: {
          where: { removedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
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
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!team) {
    notFound();
  }

  const teamIds = orderedTeamIds.map((t) => t.id);
  const currentIndex = teamIds.indexOf(team.id);
  const previousTeamId = currentIndex > 0 ? teamIds[currentIndex - 1] : null;
  const nextTeamId = currentIndex >= 0 && currentIndex < teamIds.length - 1 ? teamIds[currentIndex + 1] : null;

  const activeRound = await db.matchRound.findFirst({
    where: { status: { in: ["DRAFT"] } },
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
      where: { matchRoundId: activeRound.id },
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

  const coreSelected = teamSelThisRound
    .filter((s) => s.role === "CORE" && s.player.coreTeamId === team.id)
    .map((s) => ({
      playerId: s.player.id,
      playerName: formatPlayerName(s.player),
      role: s.role,
      explanation: (s.explanation as Record<string, unknown> | null)?.summary as string | null ?? null,
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
            },
            select: {
              playerId: true,
              role: true,
              player: { select: { coreTeamId: true } },
            },
          })
        : [];
      const firstMatch = await db.match.findFirst({
        where: { matchRoundId: round.id },
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
        backfillReceivedCount: roundSelections.filter(
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
      allowDoubleLoad: p.allowDoubleLoad,
      minRestSpacingHours: p.minRestSpacingHours,
      maxDoubleLoadsPerPeriod: p.maxDoubleLoadsPerPeriod,
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
      allowDoubleLoad: p.allowDoubleLoad,
      minRestSpacingHours: p.minRestSpacingHours,
      maxDoubleLoadsPerPeriod: p.maxDoubleLoadsPerPeriod,
    })),
  ];

  const data = {
    teamId: team.id,
    teamName: team.name,
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
    sentAsSupportCount: sentAsSupport.length,
    receivedSupportCount: receivedPlayers.filter((p) => p.role === "SUPPORT").length,
    receivedBackfillCount: receivedPlayers.filter((p) => p.role === "BACKFILL").length,
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
    teamOptions: orderedTeamIds.map((t) => ({ id: t.id, name: t.name })),
    previousTeamId,
    nextTeamId,
  };

  return <TeamDetail data={data} />;
}