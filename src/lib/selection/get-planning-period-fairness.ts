import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatPlayerName } from "@/lib/player-metrics";

export type FairnessFlag =
  | "support_burden_review"
  | "hidden_promotion_review"
  | "core_exposure_review";

export type PlayerFairnessResult = {
  coreCount: number;
  developmentCount: number;
  flags: FairnessFlag[];
  playerId: string;
  playerName: string;
  supportCount: number;
  teamId: string;
  teamName: string;
  availableRounds: number;
};

export type PlanningPeriodFairness = {
  players: PlayerFairnessResult[];
  planningPeriodId: string;
};

function isCoreRole(role: SelectionRole): boolean {
  return role === SelectionRole.CORE;
}

function isSupportRole(role: SelectionRole): boolean {
  return role === SelectionRole.SUPPORT || role === SelectionRole.BACKFILL;
}

function isDevelopmentRole(role: SelectionRole): boolean {
  return role === SelectionRole.DEVELOPMENT || role === SelectionRole.CONFIDENCE_REBUILD;
}

export async function getPlanningPeriodFairness(
  planningPeriodId: string,
): Promise<PlanningPeriodFairness> {
  const [matchRounds, finalizedSelections, players, availabilities] = await Promise.all([
    db.matchRound.findMany({
      where: { planningPeriodId },
      select: { id: true },
    }),
    db.selection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
        matchRound: { planningPeriodId },
      },
      select: {
        playerId: true,
        role: true,
        matchRoundId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            coreTeamId: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.player.findMany({
      where: { active: true, removedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        coreTeam: { select: { id: true, name: true } },
      },
    }),
    db.availability.findMany({
      where: {
        matchRound: { planningPeriodId },
        status: "AVAILABLE",
      },
      select: {
        playerId: true,
        matchRoundId: true,
      },
    }),
  ]);

  const matchRoundIds = new Set(matchRounds.map((mr) => mr.id));

  const availableRoundsByPlayerId = new Map<string, number>();
  for (const av of availabilities) {
    if (!matchRoundIds.has(av.matchRoundId)) continue;
    availableRoundsByPlayerId.set(
      av.playerId,
      (availableRoundsByPlayerId.get(av.playerId) ?? 0) + 1,
    );
  }

  const roleCountsByPlayerId = new Map<
    string,
    { coreCount: number; developmentCount: number; supportCount: number }
  >();

  for (const sel of finalizedSelections) {
    const existing = roleCountsByPlayerId.get(sel.playerId) ?? {
      coreCount: 0,
      developmentCount: 0,
      supportCount: 0,
    };

    if (isCoreRole(sel.role)) {
      existing.coreCount++;
    } else if (isSupportRole(sel.role)) {
      existing.supportCount++;
    } else if (isDevelopmentRole(sel.role)) {
      existing.developmentCount++;
    }

    roleCountsByPlayerId.set(sel.playerId, existing);
  }

  const results: PlayerFairnessResult[] = [];

  for (const player of players) {
    const counts = roleCountsByPlayerId.get(player.id) ?? {
      coreCount: 0,
      developmentCount: 0,
      supportCount: 0,
    };
    const availableRounds = availableRoundsByPlayerId.get(player.id) ?? 0;

    if (availableRounds === 0 && counts.coreCount === 0 && counts.supportCount === 0 && counts.developmentCount === 0) {
      continue;
    }

    const flags: FairnessFlag[] = [];

    if (counts.supportCount > counts.coreCount && availableRounds > 0) {
      flags.push("support_burden_review");
    }

    if (counts.developmentCount > counts.coreCount) {
      flags.push("hidden_promotion_review");
    }

    if (counts.coreCount === 0 && availableRounds > 0) {
      flags.push("core_exposure_review");
    }

    results.push({
      ...counts,
      availableRounds,
      flags,
      playerId: player.id,
      playerName: formatPlayerName(player),
      teamId: player.coreTeamId,
      teamName: player.coreTeam.name,
    });
  }

  return {
    players: results,
    planningPeriodId,
  };
}