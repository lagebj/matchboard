export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RoundBoard } from "@/components/round/round-board";
import type { PlayerInMatch } from "@/lib/round-types";
import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { formatPlayerName } from "@/lib/player-metrics";

type RoundBoardPageProps = {
  params: Promise<{
    matchRoundId: string;
  }>;
  searchParams: Promise<{
    finalized?: string;
    generated?: string;
    error?: string;
  }>;
};

export default async function RoundBoardPage({
  params,
  searchParams,
}: RoundBoardPageProps) {
  const { matchRoundId } = await params;
  const { finalized, generated, error } = await searchParams;

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              targetSquadSize: true,
              minAcceptedSquadSize: true,
              minSupportPlayers: true,
              developmentSlots: true,
            },
          },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      },
      warnings: {
        select: {
          id: true,
          rule: true,
          message: true,
          severity: true,
          matchId: true,
          playerId: true,
          teamId: true,
          resolved: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!matchRound) {
    notFound();
  }

  const matchIds = matchRound.matches.map((m) => m.id);

  const [selections, allPlayers, rotationPaths] = await Promise.all([
    db.selection.findMany({
      where: {
        matchId: { in: matchIds },
        status: { in: ["DRAFT", "FINALIZED"] },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            coreTeamId: true,
            nonRotatable: true,
            currentAvailability: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }],
    }),
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
        currentAvailability: {
          in: ["INJURED", "SICK", "AWAY"],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        currentAvailability: true,
        coreTeam: { select: { id: true, name: true } },
      },
    }),
    db.rotationPath.findMany({
      where: { active: true },
      select: {
        fromTeamId: true,
        toTeamId: true,
        role: true,
      },
    }),
  ]);

  const eligiblePlayers = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const availablePlayerList = eligiblePlayers.map((p) => ({
    id: p.id,
    name: formatPlayerName(p),
    coreTeamName: p.coreTeam.name,
    coreTeamId: p.coreTeamId,
  }));

  const selectionsByMatchId = new Map<string, typeof selections>();
  for (const sel of selections) {
    const existing = selectionsByMatchId.get(sel.matchId) ?? [];
    existing.push(sel);
    selectionsByMatchId.set(sel.matchId, existing);
  }

  const roundLabel = matchRound.matches.length > 0
    ? formatIsoWeekLabel(matchRound.matches[0]!.startsAt)
    : matchRound.name;

  const supportSentByTeamId = new Map<string, number>();
  const supportReceivedByTeamId = new Map<string, number>();
  const devSentByTeamId = new Map<string, number>();
  const devReceivedByTeamId = new Map<string, number>();
  const backfillReceivedCountByTeamId = new Map<string, number>();
  const dropsCountByTeamId = new Map<string, number>();

  const FLOATING_ROLES = new Set(["SUPPORT", "BACKFILL", "DEVELOPMENT", "CONFIDENCE_REBUILD"]);
  let crossTeamMoverCount = 0;
  for (const sel of selections) {
    if (FLOATING_ROLES.has(sel.role)) {
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match && sel.player.coreTeamId !== match.teamId) {
        crossTeamMoverCount++;
      }
    }
  }
  for (const sel of selections) {
    if (sel.role === "SUPPORT") {
      supportSentByTeamId.set(sel.player.coreTeamId, (supportSentByTeamId.get(sel.player.coreTeamId) ?? 0) + 1);
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        supportReceivedByTeamId.set(match.teamId, (supportReceivedByTeamId.get(match.teamId) ?? 0) + 1);
      }
    } else if (sel.role === "DEVELOPMENT") {
      devSentByTeamId.set(sel.player.coreTeamId, (devSentByTeamId.get(sel.player.coreTeamId) ?? 0) + 1);
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        devReceivedByTeamId.set(match.teamId, (devReceivedByTeamId.get(match.teamId) ?? 0) + 1);
      }
    } else if (sel.role === "BACKFILL") {
      const match = matchRound.matches.find((m) => m.id === sel.matchId);
      if (match) {
        backfillReceivedCountByTeamId.set(match.teamId, (backfillReceivedCountByTeamId.get(match.teamId) ?? 0) + 1);
      }
    }
  }

  const unavailableByTeamId = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    const existing = unavailableByTeamId.get(p.coreTeamId) ?? [];
    existing.push(p);
    unavailableByTeamId.set(p.coreTeamId, existing);
  }

  const unresolvedWarnings = matchRound.warnings.filter((w) => !w.resolved);

  const SELECTED_ROLES = new Set(["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT", "CONFIDENCE_REBUILD", "MANUAL_OVERRIDE"]);

  const squads = matchRound.matches.map((match) => {
    const matchSels = (selectionsByMatchId.get(match.id) ?? [])
      .filter((s) => {
        const explanation = (s.explanation ?? {}) as Record<string, unknown>;
        return explanation.manuallyRemoved !== true;
      });

    const seenPlayerIds = new Set<string>();
    const players: PlayerInMatch[] = [];

    const selectedSels = matchSels.filter((s) => SELECTED_ROLES.has(s.role));
    const droppedSels = matchSels.filter((s) => !SELECTED_ROLES.has(s.role));

    for (const sel of [...selectedSels, ...droppedSels]) {
      if (seenPlayerIds.has(sel.player.id)) continue;
      seenPlayerIds.add(sel.player.id);

      const explanation = (sel.explanation ?? {}) as Record<string, unknown>;
      const explanations = Array.isArray(explanation.records)
        ? (explanation.records as Array<{ code: string; summary: string; details?: string; hardRule?: boolean }>)
        : [{
            code: (explanation.code as string) ?? sel.role,
            summary: (explanation.summary as string) ?? "",
            details: explanation.details as string | undefined,
            hardRule: explanation.hardRule as boolean | undefined,
          }];

      players.push({
        playerId: sel.player.id,
        playerName: formatPlayerName(sel.player),
        coreTeamName: sel.player.coreTeam.name,
        selectionCategory: sel.role as PlayerInMatch["selectionCategory"],
        selectionReason: (explanation.summary as string) ?? "",
        explanations,
        priorityScore: (explanation.priorityScore as number | null) ?? null,
        manualOverride: (explanation.manualOverride as boolean) ?? false,
        playerPosition: sel.player.primaryPosition ?? "",
      });
    }

    const unavailableForTeam = unavailableByTeamId.get(match.teamId) ?? [];
    for (const p of unavailableForTeam) {
      if (!seenPlayerIds.has(p.id)) {
        seenPlayerIds.add(p.id);
        players.push({
          playerId: p.id,
          playerName: formatPlayerName(p),
          coreTeamName: p.coreTeam.name,
          selectionCategory: "UNAVAILABLE",
          selectionReason: `Unavailable: ${p.currentAvailability}`,
          explanations: [{
            code: "UNAVAILABLE",
            summary: `Player is ${p.currentAvailability?.toLowerCase()}`,
            hardRule: true,
          }],
          priorityScore: null,
          manualOverride: false,
          playerPosition: "",
        });
      }
    }

    const selectedPlayerIds = new Set<string>();
    for (const sel of selectedSels) {
      selectedPlayerIds.add(sel.player.id);
    }
    const selectedCount = selectedPlayerIds.size;
    const matchWarnings = unresolvedWarnings.filter(
      (w) => w.matchId === match.id || w.teamId === match.teamId,
    );
    const minSupport = match.team.minSupportPlayers ?? 0;

    let supportStatus: "fulfilled" | "partial" | "missing" | "none" = "none";
    if (minSupport > 0) {
      const actualSupport = matchSels.filter((s) => s.role === "SUPPORT").length;
      if (actualSupport >= minSupport) {
        supportStatus = "fulfilled";
      } else if (actualSupport > 0) {
        supportStatus = "partial";
      } else {
        supportStatus = "missing";
      }
    }

    return {
      matchId: match.id,
      teamName: match.team.name,
      opponent: match.opponent,
      matchDate: match.startsAt,
      targetSquadSize: match.team.targetSquadSize,
      minSquadSize: match.team.minAcceptedSquadSize ?? match.team.targetSquadSize,
      selectedCount,
      players,
      supportStatus,
      backfillCount: backfillReceivedCountByTeamId.get(match.teamId) ?? 0,
      warningCount: matchWarnings.length,
      isFinalized: matchRound.status === "FINALIZED",
    };
  });

  const totalSupportSent = Array.from(supportSentByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalSupportReceived = Array.from(supportReceivedByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDevSent = Array.from(devSentByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDevReceived = Array.from(devReceivedByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalBackfillReceived = Array.from(backfillReceivedCountByTeamId.values()).reduce((a, b) => a + b, 0);
  const totalDrops = Array.from(dropsCountByTeamId.values()).reduce((a, b) => a + b, 0);

  const warnings = unresolvedWarnings.map((w) => ({
    code: w.rule,
    message: w.message,
    severity: w.severity,
    teamName: matchRound.matches.find((m) => m.teamId === w.teamId)?.team.name,
  }));

  const warningSummary = {
    blocking: unresolvedWarnings.filter((w) => w.severity === "HARD_BLOCK").length,
    high: unresolvedWarnings.filter((w) => w.severity === "REQUIRES_OVERRIDE").length,
    medium: unresolvedWarnings.filter((w) => w.severity === "WARNING").length,
    info: unresolvedWarnings.filter((w) => w.severity === "SCORING_PREFERENCE").length,
  };

  const uniqueSelectedPlayerIds = new Set<string>();
  for (const s of selections) {
    if (SELECTED_ROLES.has(s.role)) {
      uniqueSelectedPlayerIds.add(s.playerId);
    }
  }

  const fairnessMetrics = [
    { label: "Players selected", value: uniqueSelectedPlayerIds.size },
    { label: "Matches this round", value: matchRound.matches.length },
    { label: "Cross-team movers", value: crossTeamMoverCount },
    {
      label: "Squad fill rate",
      value: squads.length > 0
        ? `${Math.round(squads.reduce((sum, s) => sum + (s.selectedCount / s.targetSquadSize), 0) / squads.length * 100)}%`
        : "N/A",
    },
  ];

  const roundData = {
    roundLabel,
    roundId: matchRound.id,
    roundStatus: matchRound.status as "NOT_GENERATED" | "DRAFT" | "FINALIZED",
    hasDraftSelections: selections.length > 0,
    hasMatches: matchRound.matches.length > 0,
    squads,
    warnings,
    warningSummary,
    movementSummary: {
      supportSent: totalSupportSent,
      supportReceived: totalSupportReceived,
      developmentSent: totalDevSent,
      developmentReceived: totalDevReceived,
      backfillReceived: totalBackfillReceived,
      drops: totalDrops,
    },
    fairnessMetrics,
  };

  const playerCoreTeamMap = new Map<string, string>();
  for (const sel of selections) {
    if (!playerCoreTeamMap.has(sel.player.id)) {
      playerCoreTeamMap.set(sel.player.id, sel.player.coreTeamId);
    }
  }
  for (const p of eligiblePlayers) {
    if (!playerCoreTeamMap.has(p.id)) {
      playerCoreTeamMap.set(p.id, p.coreTeamId);
    }
  }

  const boardMatches = squads.map((s) => {
    const matchRecord = matchRound.matches.find((m) => m.id === s.matchId);
    return {
      matchId: s.matchId,
      teamId: matchRecord?.teamId ?? "",
      teamName: s.teamName,
      opponent: s.opponent,
      matchDate: s.matchDate,
      targetSquadSize: s.targetSquadSize,
      minSquadSize: s.minSquadSize,
      isFinalized: s.isFinalized,
      players: s.players
        .filter((p) => p.selectionCategory === "CORE" || p.selectionCategory === "SUPPORT" || p.selectionCategory === "BACKFILL" || p.selectionCategory === "DEVELOPMENT")
        .map((p) => ({
          id: p.playerId,
          name: p.playerName,
          coreTeamName: p.coreTeamName,
          playerCoreTeamId: playerCoreTeamMap.get(p.playerId) ?? "",
          role: p.selectionCategory as "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT",
          manualOverride: p.manualOverride,
          warningCount: (() => {
            const matchWarnings = unresolvedWarnings.filter(
              (w) => (w.matchId === s.matchId || w.teamId === (matchRecord?.teamId ?? "")) && w.playerId === p.playerId,
            );
            return matchWarnings.length;
          })(),
        })),
    };
  });

  const boardAvailablePlayers = availablePlayerList.map((p) => ({
    id: p.id,
    name: p.name,
    coreTeamName: p.coreTeamName,
    coreTeamId: p.coreTeamId,
  }));

  const rotationPathMap: Record<string, string[]> = {};
  for (const path of rotationPaths) {
    const key = `${path.fromTeamId}:${path.toTeamId}`;
    if (!rotationPathMap[key]) rotationPathMap[key] = [];
    if (!rotationPathMap[key].includes(path.role)) {
      rotationPathMap[key].push(path.role);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {finalized && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Round finalized.
        </div>
      )}
      {generated && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Round generated successfully.
        </div>
      )}
      <RoundBoard
        roundLabel={roundLabel}
        roundStatus={matchRound.status as "NOT_GENERATED" | "DRAFT" | "FINALIZED"}
        roundId={matchRound.id}
        matchRoundId={matchRoundId}
        hasDraftSelections={selections.length > 0}
        hasMatches={matchRound.matches.length > 0}
        matches={boardMatches}
        availablePlayers={boardAvailablePlayers}
        rotationPathMap={rotationPathMap}
        warnings={warnings}
        warningSummary={warningSummary}
        movementSummary={{
          supportSent: totalSupportSent,
          supportReceived: totalSupportReceived,
          developmentSent: totalDevSent,
          developmentReceived: totalDevReceived,
          backfillReceived: totalBackfillReceived,
          drops: totalDrops,
        }}
        fairnessMetrics={fairnessMetrics}
      />
    </div>
  );
}