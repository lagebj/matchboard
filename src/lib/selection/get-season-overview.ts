import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type PlayerRoundCell = {
  matchRoundId: string;
  matchRoundName: string;
  matchId: string;
  role: string;
  teamId: string;
  teamName: string;
  status: "DRAFT" | "FINALIZED";
  opponent?: string;
};

export type PlayerRowSummary = {
  playerId: string;
  playerName: string;
  coreTeamId: string;
  coreTeamName: string;
  roundsPlayed: number;
  totalSelections: number;
  coreMatches: number;
  supportMatches: number;
  developmentMatches: number;
  backfillMatches: number;
  doubleLoadRounds: number;
  droppedRounds: number;
  unavailableRounds: number;
  warningCount: number;
  lastMovementDate: Date | null;
  cells: PlayerRoundCell[];
};

export type SeasonPlayerRoundMatrix = {
  planningPeriodId: string;
  planningPeriodName: string;
  roundCount: number;
  finalizedRoundCount: number;
  draftRoundCount: number;
  playersWithWarnings: number;
  highestSupportBurden: string | null;
  doubleLoadCount: number;
  players: PlayerRowSummary[];
  rounds: Array<{
    matchRoundId: string;
    matchRoundName: string;
    isFinalized: boolean;
  }>;
};

export async function getSeasonPlayerRoundMatrix(
  planningPeriodId: string,
  includeDrafts: boolean = false,
): Promise<SeasonPlayerRoundMatrix> {
  const planningPeriod = await db.planningPeriod.findUnique({
    where: { id: planningPeriodId },
    select: { id: true, name: true },
  });

  if (!planningPeriod) {
    return {
      planningPeriodId,
      planningPeriodName: "Unknown",
      roundCount: 0,
      finalizedRoundCount: 0,
      draftRoundCount: 0,
      playersWithWarnings: 0,
      highestSupportBurden: null,
      doubleLoadCount: 0,
      players: [],
      rounds: [],
    };
  }

  const matchRounds = await db.matchRound.findMany({
    where: { planningPeriodId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const rounds = matchRounds.map((r) => ({
    matchRoundId: r.id,
    matchRoundName: r.name,
    isFinalized: r.status === "FINALIZED",
  }));

  const selectionStatusFilter = includeDrafts
    ? { in: [SelectionStatus.FINALIZED, SelectionStatus.DRAFT] }
    : { in: [SelectionStatus.FINALIZED] };

  const roundIds = matchRounds.map((r) => r.id);

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      status: selectionStatusFilter,
      player: { removedAt: null, active: true },
    },
    select: {
      id: true,
      matchRoundId: true,
      matchId: true,
      playerId: true,
      role: true,
      status: true,
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
        select: {
          teamId: true,
          team: { select: { id: true, name: true } },
          opponent: true,
        },
      },
    },
    orderBy: { player: { firstName: "asc" } },
  });

  const availabilities = await db.availability.findMany({
    where: {
      matchRoundId: { in: roundIds },
      player: { removedAt: null, active: true },
      status: { in: ["INJURED", "SICK", "AWAY", "UNKNOWN"] },
    },
    select: {
      playerId: true,
      matchRoundId: true,
      status: true,
    },
  });

  const unavailableByPlayerRound = new Map<string, string>();
  for (const a of availabilities) {
    unavailableByPlayerRound.set(`${a.playerId}:${a.matchRoundId}`, a.status);
  }

  const players = await db.player.findMany({
    where: { removedAt: null, active: true },
    select: { id: true, firstName: true, lastName: true, coreTeamId: true, coreTeam: { select: { id: true, name: true } } },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const playerMap = new Map<string, (typeof players)[0]>();
  for (const p of players) {
    playerMap.set(p.id, p);
  }

  const cellsByPlayer = new Map<string, PlayerRoundCell[]>();
  for (const s of selections) {
    const existing = cellsByPlayer.get(s.playerId) ?? [];
    existing.push({
      matchRoundId: s.matchRoundId,
      matchRoundName: matchRounds.find((r) => r.id === s.matchRoundId)?.name ?? "",
      matchId: s.matchId,
      role: s.role,
      teamId: s.match.team.id,
      teamName: s.match.team.name,
      status: s.status as "DRAFT" | "FINALIZED",
      opponent: s.match.opponent ?? undefined,
    });
    cellsByPlayer.set(s.playerId, existing);
  }

  const playerRows: PlayerRowSummary[] = [];

  for (const player of players) {
    const cells = cellsByPlayer.get(player.id) ?? [];
    const coreMatches = cells.filter((c) => c.role === "CORE").length;
    const supportMatches = cells.filter((c) => c.role === "SUPPORT").length;
    const developmentMatches = cells.filter((c) => c.role === "DEVELOPMENT").length;
    const backfillMatches = cells.filter((c) => c.role === "BACKFILL").length;
    const doubleLoadRounds = cells.filter((c) => c.role === "DOUBLE_LOAD").length;
    const roundsPlayed = new Set(cells.map((c) => c.matchRoundId)).size;
    const totalSelections = cells.length;
    const unavailableRounds = roundIds.filter(
      (rid) => unavailableByPlayerRound.has(`${player.id}:${rid}`),
    ).length;
    const selectedRoundIds = new Set(cells.map((c) => c.matchRoundId));
    const droppedRounds = roundIds.filter(
      (rid) => !selectedRoundIds.has(rid) && !unavailableByPlayerRound.has(`${player.id}:${rid}`),
    ).length;

    const lastMovement = cells.length > 0
      ? cells.reduce((latest, c) => {
          if (c.role !== "CORE" && c.status === "FINALIZED") return c;
          return latest;
        }, cells[0]!)
      : null;

    playerRows.push({
      playerId: player.id,
      playerName: `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`,
      coreTeamId: player.coreTeam?.id ?? "",
      coreTeamName: player.coreTeam?.name ?? "",
      roundsPlayed,
      totalSelections,
      coreMatches,
      supportMatches,
      developmentMatches,
      backfillMatches,
      doubleLoadRounds,
      droppedRounds,
      unavailableRounds,
      warningCount: 0,
      lastMovementDate: null,
      cells,
    });
  }

  const finalizedRoundCount = rounds.filter((r) => r.isFinalized).length;
  const draftRoundCount = rounds.filter((r) => !r.isFinalized).length;

  const fairness = await getSeasonFairnessWarningsInternal(planningPeriodId, includeDrafts);

  const warningCounts = new Map<string, number>();
  for (const f of fairness) {
    if (f.playerId) {
      warningCounts.set(f.playerId, (warningCounts.get(f.playerId) ?? 0) + 1);
    }
  }

  for (const row of playerRows) {
    row.warningCount = warningCounts.get(row.playerId) ?? 0;
  }

  const playersWithWarnings = playerRows.filter((p) => p.warningCount > 0).length;

  const supportRows = playerRows.filter((p) => p.supportMatches > 0);
  const highestSupportBurden = supportRows.length > 0
    ? supportRows.reduce((max, p) => p.supportMatches > max.supportMatches ? p : max, supportRows[0]!).playerName
    : null;

  const doubleLoadCount = playerRows.filter((p) => p.doubleLoadRounds > 0).length;

  return {
    planningPeriodId: planningPeriod.id,
    planningPeriodName: planningPeriod.name,
    roundCount: rounds.length,
    finalizedRoundCount,
    draftRoundCount,
    playersWithWarnings,
    highestSupportBurden,
    doubleLoadCount,
    players: playerRows,
    rounds,
  };
}

type FairnessWarning = {
  severity: "WARNING" | "SCORING_PREFERENCE";
  rule: string;
  message: string;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName?: string;
  basedOnDraft: boolean;
};

async function getSeasonFairnessWarningsInternal(
  planningPeriodId: string,
  includeDrafts: boolean,
): Promise<FairnessWarning[]> {
  const warnings: FairnessWarning[] = [];

  const fairness = await db.selection.findMany({
    where: {
      matchRound: { planningPeriodId },
      status: includeDrafts ? { in: [SelectionStatus.FINALIZED, SelectionStatus.DRAFT] } : { in: [SelectionStatus.FINALIZED] },
      player: { removedAt: null, active: true },
    },
    select: {
      playerId: true,
      role: true,
      player: {
        select: {
          firstName: true,
          lastName: true,
          coreTeamId: true,
          coreTeam: { select: { id: true, name: true } },
        },
      },
    },
  });

  const playerStats = new Map<string, {
    core: number;
    support: number;
    development: number;
    backfill: number;
    doubleLoad: number;
    playerName: string;
    teamId: string;
    teamName: string;
  }>();

  for (const s of fairness) {
    const existing = playerStats.get(s.playerId) ?? {
      core: 0, support: 0, development: 0, backfill: 0, doubleLoad: 0,
      playerName: `${s.player.firstName}${s.player.lastName ? ` ${s.player.lastName}` : ""}`,
      teamId: s.player.coreTeam?.id ?? "",
      teamName: s.player.coreTeam?.name ?? "",
    };
    if (s.role === "CORE") existing.core++;
    else if (s.role === "SUPPORT") existing.support++;
    else if (s.role === "DEVELOPMENT") existing.development++;
    else if (s.role === "BACKFILL") existing.backfill++;
    else if (s.role === "DOUBLE_LOAD") existing.doubleLoad++;
    playerStats.set(s.playerId, existing);
  }

  for (const [playerId, stats] of playerStats) {
    if (stats.support > stats.core && stats.core > 0) {
      warnings.push({
        severity: "WARNING",
        rule: "high_support_burden",
        message: `${stats.playerName} has ${stats.support} support matches versus ${stats.core} core matches — high support burden.`,
        playerId,
        playerName: stats.playerName,
        teamId: stats.teamId,
        teamName: stats.teamName,
        basedOnDraft: includeDrafts,
      });
    }

    if (stats.development > stats.core && stats.core > 0) {
      warnings.push({
        severity: "SCORING_PREFERENCE",
        rule: "low_development_exposure",
        message: `${stats.playerName} has ${stats.development} development matches versus ${stats.core} core matches — low core exposure during development.`,
        playerId,
        playerName: stats.playerName,
        teamId: stats.teamId,
        teamName: stats.teamName,
        basedOnDraft: includeDrafts,
      });
    }

    if (stats.doubleLoad >= 2) {
      warnings.push({
        severity: "WARNING",
        rule: "repeated_double_load",
        message: `${stats.playerName} has ${stats.doubleLoad} double-load rounds — repeated high load.`,
        playerId,
        playerName: stats.playerName,
        teamId: stats.teamId,
        teamName: stats.teamName,
        basedOnDraft: includeDrafts,
      });
    }
  }

  return warnings;
}

export async function getSeasonFairnessWarnings(
  planningPeriodId: string,
  includeDrafts: boolean = false,
): Promise<FairnessWarning[]> {
  return getSeasonFairnessWarningsInternal(planningPeriodId, includeDrafts);
}

export async function getPlayerLoadSummary(
  planningPeriodId: string,
  includeDrafts: boolean = false,
): Promise<Array<{
  playerId: string;
  playerName: string;
  coreTeamName: string;
  roundsPlayed: number;
  totalSelections: number;
  coreMatches: number;
  supportMatches: number;
  developmentMatches: number;
  backfillMatches: number;
  doubleLoadRounds: number;
  droppedRounds: number;
  unavailableRounds: number;
}>> {
  const matrix = await getSeasonPlayerRoundMatrix(planningPeriodId, includeDrafts);
  return matrix.players.map((p) => ({
    playerId: p.playerId,
    playerName: p.playerName,
    coreTeamName: p.coreTeamName,
    roundsPlayed: p.roundsPlayed,
    totalSelections: p.totalSelections,
    coreMatches: p.coreMatches,
    supportMatches: p.supportMatches,
    developmentMatches: p.developmentMatches,
    backfillMatches: p.backfillMatches,
    doubleLoadRounds: p.doubleLoadRounds,
    droppedRounds: p.droppedRounds,
    unavailableRounds: p.unavailableRounds,
  }));
}

export type MovementPathRow = {
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  role: string;
  count: number;
  uniquePlayers: number;
  lastUsed: Date | null;
};

export async function getMovementPathSummary(
  planningPeriodId: string,
  includeDrafts: boolean = false,
): Promise<MovementPathRow[]> {
  const selectionStatusFilter = includeDrafts
    ? { in: [SelectionStatus.FINALIZED, SelectionStatus.DRAFT] }
    : { in: [SelectionStatus.FINALIZED] };

  const movements = await db.movementLedger.findMany({
    where: {
      matchRound: { planningPeriodId },
      isDraft: includeDrafts ? undefined : false,
      ...(includeDrafts ? {} : { isDraft: false }),
    },
    select: {
      fromTeamId: true,
      toTeamId: true,
      role: true,
      playerId: true,
      isDraft: true,
      createdAt: true,
      fromTeam: { select: { id: true, name: true } },
      toTeam: { select: { id: true, name: true } },
    },
  });

  const movementsFiltered = includeDrafts
    ? movements
    : movements.filter((m) => !m.isDraft);

  const pathMap = new Map<string, {
    fromTeamId: string;
    fromTeamName: string;
    toTeamId: string;
    toTeamName: string;
    role: string;
    count: number;
    playerIds: Set<string>;
    lastUsed: Date | null;
  }>();

  for (const m of movementsFiltered) {
    const key = `${m.fromTeamId}:${m.toTeamId}:${m.role}`;
    const existing = pathMap.get(key);
    if (existing) {
      existing.count++;
      existing.playerIds.add(m.playerId);
      if (m.createdAt > (existing.lastUsed ?? new Date(0))) {
        existing.lastUsed = m.createdAt;
      }
    } else {
      pathMap.set(key, {
        fromTeamId: m.fromTeamId,
        fromTeamName: m.fromTeam.name,
        toTeamId: m.toTeamId,
        toTeamName: m.toTeam.name,
        role: m.role,
        count: 1,
        playerIds: new Set([m.playerId]),
        lastUsed: m.createdAt,
      });
    }
  }

  return Array.from(pathMap.values()).map((p) => ({
    fromTeamId: p.fromTeamId,
    fromTeamName: p.fromTeamName,
    toTeamId: p.toTeamId,
    toTeamName: p.toTeamName,
    role: p.role,
    count: p.count,
    uniquePlayers: p.playerIds.size,
    lastUsed: p.lastUsed,
  }));
}

export type MovementTimelineEntry = {
  matchRoundId: string;
  matchRoundName: string;
  matchDate: Date | null;
  teamId: string;
  teamName: string;
  role: string;
  status: "DRAFT" | "FINALIZED";
  fromTeamId?: string;
  fromTeamName?: string;
  explanation?: string;
};

export async function getPlayerMovementTimeline(
  playerId: string,
  includeDrafts: boolean = false,
  planningPeriodId?: string,
): Promise<MovementTimelineEntry[]> {
  const selectionStatusFilter = includeDrafts
    ? { in: [SelectionStatus.FINALIZED, SelectionStatus.DRAFT] }
    : { in: [SelectionStatus.FINALIZED] };

  const selectionWhere: Record<string, unknown> = {
    playerId,
    status: selectionStatusFilter,
  };
  if (planningPeriodId) {
    selectionWhere.matchRound = { planningPeriodId };
  }

  const selections = await db.selection.findMany({
    where: selectionWhere,
    select: {
      matchRoundId: true,
      matchId: true,
      role: true,
      status: true,
      explanation: true,
      matchRound: { select: { name: true } },
      match: { select: { teamId: true, team: { select: { id: true, name: true } }, startsAt: true, opponent: true } },
    },
    orderBy: { match: { startsAt: "asc" } },
  });

  const matchRoundIds = [...new Set(selections.map((s) => s.matchRoundId))];

  const movementWhere: Record<string, unknown> = { playerId };
  if (planningPeriodId) {
    movementWhere.matchRound = { planningPeriodId };
  }
  if (!includeDrafts) {
    movementWhere.isDraft = false;
  }

  const movements = await db.movementLedger.findMany({
    where: movementWhere,
    select: {
      matchRoundId: true,
      matchId: true,
      fromTeamId: true,
      fromTeam: { select: { id: true, name: true } },
      toTeamId: true,
      role: true,
      isDraft: true,
    },
  });

  const movementByRoundAndTeam = new Map<string, { fromTeamId: string; fromTeamName: string }>();
  for (const m of movements) {
    if (!m.isDraft || includeDrafts) {
      const key = `${m.matchRoundId}:${m.toTeamId}`;
      movementByRoundAndTeam.set(key, {
        fromTeamId: m.fromTeamId,
        fromTeamName: m.fromTeam.name,
      });
    }
  }

  return selections.map((s) => {
    const movementKey = `${s.matchRoundId}:${s.match.team.id}`;
    const movement = movementByRoundAndTeam.get(movementKey);
    return {
      matchRoundId: s.matchRoundId,
      matchRoundName: s.matchRound.name,
      matchDate: s.match.startsAt,
      teamId: s.match.team.id,
      teamName: s.match.team.name,
      role: s.role,
      status: s.status as "DRAFT" | "FINALIZED",
      fromTeamId: movement?.fromTeamId,
      fromTeamName: movement?.fromTeamName,
      explanation: s.explanation
        ? typeof s.explanation === "object" && s.explanation !== null && "reason" in (s.explanation as Record<string, unknown>)
          ? (s.explanation as Record<string, unknown>).reason as string
          : undefined
        : undefined,
    };
  });
}