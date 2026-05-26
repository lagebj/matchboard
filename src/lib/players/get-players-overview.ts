import { db } from "@/lib/db";
import { classifyRole } from "../selection/effective-participation";

// --- Types ---

export type PlayerSeasonOverviewRow = {
  playerId: string;
  displayName: string;
  coreTeam: { id: string; name: string } | null;

  actualAppearances: number;
  goals: number;
  assists: number;

  coreAppearances: number;
  supportAppearances: number;
  developmentAppearances: number;

  matchdayAdditions: number;
  actualAdditionalAppearances: number;
  plannedButAbsent: number;
  finalisedUpcomingAppearances: number;
  draftSelections: number;
  squadRepairAppearances: number;
  unavailableRoundCount: number;
  dropsCount: number;
  lastMovement: string | null;

  recentInvolvement: Array<{
    matchId: string;
    matchDate: Date;
    teamName: string;
    opponent: string;
    state: "PLAYED" | "PLANNED_ABSENT" | "FINALIZED_UPCOMING" | "MATCHDAY_ADDITION" | "DRAFT";
    role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
  }>;

  roundAssignments: Array<{
    roundId: string;
    roundName: string;
    role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
    teamName: string | null;
    isDraft: boolean;
  }>;
};

export type IntegrityAttentionState =
  | "COVERED"
  | "DECISION_REQUIRED_NO_PLANNED_MATCH"
  | "BLOCKED_UNAVAILABLE_SELECTION"
  | "BLOCKED_INVALID_PLAN"
  | "NOT_AVAILABLE"
  | "UNCONFIRMED";

export type PlayerCurrentRoundAttentionRow = {
  playerId: string;
  displayName: string;
  coreTeam: { id: string; name: string } | null;

  availability: "AVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";

  currentAssignment: {
    matchId: string;
    teamName: string;
    opponent: string;
    role: "CORE" | "SUPPORT" | "DEVELOPMENT";
  } | null;

  integrityState: IntegrityAttentionState;
};

export type PlayersOverviewResult = {
  planningPeriod: { id: string; label: string };
  selectedRound?: { id: string; label: string };
  seasonRows: PlayerSeasonOverviewRow[];
  currentRoundRows?: PlayerCurrentRoundAttentionRow[];
};

// --- Season overview aggregation ---

export type MovementPathSummary = {
  sourceTeamId: string;
  sourceTeamName: string;
  targetTeamId: string;
  targetTeamName: string;
  role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
  count: number;
  uniquePlayerCount: number;
  lastRoundName: string | null;
};

export type SeasonOverviewResult = {
  planningPeriod: { id: string; label: string };
  roundColumns: Array<{ id: string; name: string }>;
  seasonRows: PlayerSeasonOverviewRow[];
  movementPaths: MovementPathSummary[];
};

export async function getPlayersSeasonOverview(
  planningPeriodId: string,
  options?: { teamId?: string },
): Promise<SeasonOverviewResult> {
  const planningPeriod = await db.planningPeriod.findUnique({
    where: { id: planningPeriodId },
    select: { id: true, name: true },
  });

  if (!planningPeriod) {
    return {
      planningPeriod: { id: planningPeriodId, label: "Unknown" },
      roundColumns: [],
      seasonRows: [],
      movementPaths: [],
    };
  }

  const players = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      ...(options?.teamId ? { coreTeamId: options.teamId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  if (players.length === 0) {
    return {
      planningPeriod: { id: planningPeriod.id, label: planningPeriod.name },
      roundColumns: [],
      seasonRows: [],
      movementPaths: [],
    };
  }

  const playerIds = players.map((p) => p.id);

  const rounds = await db.matchRound.findMany({
    where: { planningPeriodId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const roundIds = rounds.map((r) => r.id);

  const matches = roundIds.length > 0
    ? await db.match.findMany({
        where: { matchRoundId: { in: roundIds } },
        select: {
          id: true,
          matchRoundId: true,
          teamId: true,
          opponent: true,
          startsAt: true,
          team: { select: { name: true } },
        },
        orderBy: { startsAt: "asc" },
      })
    : [];

  const matchIds = matches.map((m) => m.id);
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // --- Actual participation from reported/locked post-match reports ---

  const reportedReports = matchIds.length > 0
    ? await db.postMatchReport.findMany({
        where: {
          matchId: { in: matchIds },
          status: { in: ["REPORTED", "LOCKED"] },
        },
        select: {
          matchId: true,
          status: true,
          playerActuals: {
            where: { playerId: { in: playerIds } },
            select: { playerId: true, source: true, attendanceStatus: true },
          },
          absences: {
            where: { playerId: { in: playerIds } },
            select: { playerId: true },
          },
          playerStats: {
            where: { playerId: { in: playerIds } },
            select: { playerId: true, goals: true, assists: true },
          },
        },
      })
    : [];

  const reportedMatchIds = new Set(reportedReports.map((r) => r.matchId));

  const actualsByPlayer = new Map<string, Array<{
    matchId: string;
    matchRoundId: string;
    source: string;
    played: boolean;
  }>>();

  const statsByPlayer = new Map<string, { goals: number; assists: number }>();
  const absentPlayerMatchIds = new Set<string>();

  for (const report of reportedReports) {
    for (const actual of report.playerActuals) {
      if (actual.attendanceStatus === "NO_SHOW") {
        // NO_SHOW is planned-but-did-not-participate, handled via absences
        continue;
      }

      const mi = matchById.get(report.matchId);
      const entry = {
        matchId: report.matchId,
        matchRoundId: mi?.matchRoundId ?? "",
        source: actual.source,
        played: true,
      };
      const arr = actualsByPlayer.get(actual.playerId) ?? [];
      arr.push(entry);
      actualsByPlayer.set(actual.playerId, arr);
    }

    for (const absence of report.absences) {
      absentPlayerMatchIds.add(`${absence.playerId}:${report.matchId}`);
    }

    for (const stat of report.playerStats) {
      const existing = statsByPlayer.get(stat.playerId) ?? { goals: 0, assists: 0 };
      existing.goals += stat.goals;
      existing.assists += stat.assists;
      statsByPlayer.set(stat.playerId, existing);
    }
  }

  // --- Planned selections ---

  const selections = matchIds.length > 0
    ? await db.selection.findMany({
        where: {
          matchId: { in: matchIds },
          playerId: { in: playerIds },
          status: { in: ["DRAFT", "FINALIZED"] },
        },
        select: {
          playerId: true,
          matchId: true,
          matchRoundId: true,
          role: true,
          status: true,
        },
      })
    : [];

  const selectionByPlayerMatch = new Map<string, { role: string; status: string }>();
  const selectionsByPlayer = new Map<string, Array<{
    matchId: string;
    role: string;
    status: string;
  }>>();

  for (const sel of selections) {
    selectionByPlayerMatch.set(`${sel.playerId}:${sel.matchId}`, { role: sel.role, status: sel.status });
    const arr = selectionsByPlayer.get(sel.playerId) ?? [];
    arr.push({ matchId: sel.matchId, role: sel.role, status: sel.status });
    selectionsByPlayer.set(sel.playerId, arr);
  }

  // Build player-round assignment map for matrix view
  type RoundAssignment = { roundId: string; roundName: string; role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null; teamName: string | null; isDraft: boolean };
  const roundAssignmentsByPlayer = new Map<string, RoundAssignment[]>();

  for (const sel of selections) {
    const match = matchById.get(sel.matchId);
    if (!match) continue;
    const roundId = sel.matchRoundId;
    const round = rounds.find((r) => r.id === roundId);
    const roundName = round?.name ?? "";
    const entry: RoundAssignment = {
      roundId,
      roundName,
      role: sel.role as "CORE" | "SUPPORT" | "DEVELOPMENT" | null,
      teamName: match.team.name,
      isDraft: sel.status === "DRAFT",
    };
    const playerAssignments = roundAssignmentsByPlayer.get(sel.playerId) ?? [];
    playerAssignments.push(entry);
    roundAssignmentsByPlayer.set(sel.playerId, playerAssignments);
  }

  // --- Availability per player per round (for unavailable round count) ---

  const availabilities = roundIds.length > 0
    ? await db.availability.findMany({
        where: {
          matchRoundId: { in: roundIds },
          playerId: { in: playerIds },
        },
        select: { playerId: true, matchRoundId: true, status: true },
      })
    : [];

  const unavailableRoundCountByPlayer = new Map<string, number>();
  for (const a of availabilities) {
    if (a.status !== "AVAILABLE" && a.status !== "TENTATIVE") {
      unavailableRoundCountByPlayer.set(a.playerId, (unavailableRoundCountByPlayer.get(a.playerId) ?? 0) + 1);
    }
  }

  // --- Count rounds where a player had multiple actual appearances (double-load) ---

  const roundPlayerActualCounts = new Map<string, Map<string, number>>();
  for (const [playerId, actuals] of actualsByPlayer) {
    for (const actual of actuals) {
      const roundMap = roundPlayerActualCounts.get(actual.matchRoundId) ?? new Map();
      roundMap.set(playerId, (roundMap.get(playerId) ?? 0) + 1);
      roundPlayerActualCounts.set(actual.matchRoundId, roundMap);
    }
  }

  // --- Build player rows ---

  const seasonRows: PlayerSeasonOverviewRow[] = players.map((player) => {
    const playerActuals = actualsByPlayer.get(player.id) ?? [];
    const playerStats = statsByPlayer.get(player.id) ?? { goals: 0, assists: 0 };
    const playerSelections = selectionsByPlayer.get(player.id) ?? [];
    const playerUnavailableRounds = unavailableRoundCountByPlayer.get(player.id) ?? 0;

    let actualAppearances = 0;
    let coreAppearances = 0;
    let supportAppearances = 0;
    let developmentAppearances = 0;
    let squadRepairAppearances = 0;
    let matchdayAdditions = 0;
    let plannedButAbsent = 0;
    let finalisedUpcomingAppearances = 0;

    // Actual appearances
    for (const actual of playerActuals) {
      actualAppearances++;

      const selInfo = selectionByPlayerMatch.get(`${player.id}:${actual.matchId}`);
      const role = selInfo?.role ?? null;

      if (role) {
        const category = classifyRole(role as Parameters<typeof classifyRole>[0]);
        if (category === "core") coreAppearances++;
        else if (category === "support") {
          if (role === "BACKFILL") {
            squadRepairAppearances++;
          } else {
            supportAppearances++;
          }
        }
        else developmentAppearances++;
      }

      // Matchday additions: actual appearances outside the finalised planned squad
      if (actual.source === "ADDED_POST_MATCH" || actual.source === "EMERGENCY_BACKFILL") {
        matchdayAdditions++;
      }
    }

    // Planned absences: player was planned (finalised) but recorded as absent in reported/locked match
    let draftSelections = 0;
    for (const sel of playerSelections) {
      if (sel.status === "DRAFT") {
        draftSelections++;
      }
      if (sel.status === "FINALIZED") {
        const isReported = reportedMatchIds.has(sel.matchId);
        if (isReported) {
          if (absentPlayerMatchIds.has(`${player.id}:${sel.matchId}`)) {
            plannedButAbsent++;
          }
          const category = classifyRole(sel.role as Parameters<typeof classifyRole>[0]);
          if (category === "support") {
            squadRepairAppearances++;
          }
        } else {
          finalisedUpcomingAppearances++;
        }
      }
    }

    // Additional actual appearances (double-load in same round)
    let actualAdditionalAppearances = 0;
    for (const [_roundId, playerCounts] of roundPlayerActualCounts) {
      const count = playerCounts.get(player.id) ?? 0;
      if (count > 1) {
        actualAdditionalAppearances += count - 1;
      }
    }

    // Recent involvement (up to 5, newest first)
    const involvementEntries: Array<{
      matchId: string;
      date: Date;
      teamName: string;
      opponent: string;
      state: "PLAYED" | "PLANNED_ABSENT" | "FINALIZED_UPCOMING" | "MATCHDAY_ADDITION" | "DRAFT";
      role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
    }> = [];

    for (const actual of playerActuals) {
      const mi = matchById.get(actual.matchId);
      if (!mi) continue;
      const selInfo = selectionByPlayerMatch.get(`${player.id}:${actual.matchId}`);
      const role = selInfo?.role ?? null;
      const isMatchdayAddition = actual.source === "ADDED_POST_MATCH" || actual.source === "EMERGENCY_BACKFILL";

      involvementEntries.push({
        matchId: actual.matchId,
        date: mi.startsAt ?? new Date(0),
        teamName: mi.team.name,
        opponent: mi.opponent ?? "",
        state: isMatchdayAddition ? "MATCHDAY_ADDITION" : "PLAYED",
        role: role as "CORE" | "SUPPORT" | "DEVELOPMENT" | null,
      });
    }

    for (const absentMatchId of [...absentPlayerMatchIds]) {
      const [absentPid, mid] = absentMatchId.split(":") as [string, string];
      if (absentPid !== player.id) continue;
      const mi = matchById.get(mid);
      if (!mi) continue;
      involvementEntries.push({
        matchId: mid,
        date: mi.startsAt ?? new Date(0),
        teamName: mi.team.name,
        opponent: mi.opponent ?? "",
        state: "PLANNED_ABSENT",
        role: null,
      });
    }

    // Finalised upcoming (not yet reported)
    for (const sel of playerSelections) {
      if (sel.status === "FINALIZED" && !reportedMatchIds.has(sel.matchId)) {
        const mi = matchById.get(sel.matchId);
        if (!mi) continue;
        involvementEntries.push({
          matchId: sel.matchId,
          date: mi.startsAt ?? new Date(0),
          teamName: mi.team.name,
          opponent: mi.opponent ?? "",
          state: "FINALIZED_UPCOMING",
          role: sel.role as "CORE" | "SUPPORT" | "DEVELOPMENT" | null,
        });
      }
    }

    // Draft selections (not finalized)
    for (const sel of playerSelections) {
      if (sel.status === "DRAFT") {
        const mi = matchById.get(sel.matchId);
        if (!mi) continue;
        involvementEntries.push({
          matchId: sel.matchId,
          date: mi.startsAt ?? new Date(0),
          teamName: mi.team.name,
          opponent: mi.opponent ?? "",
          state: "DRAFT",
          role: sel.role as "CORE" | "SUPPORT" | "DEVELOPMENT" | null,
        });
      }
    }

    involvementEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
    const recentInvolvement = involvementEntries.slice(0, 5).map(({ matchId, date, teamName, opponent, state, role }) => ({
      matchId,
      matchDate: date,
      teamName,
      opponent,
      state,
      role,
    }));

    return {
      playerId: player.id,
      displayName: `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`,
      coreTeam: player.coreTeam ? { id: player.coreTeam.id, name: player.coreTeam.name } : null,
      actualAppearances,
      goals: playerStats.goals,
      assists: playerStats.assists,
      coreAppearances,
      supportAppearances,
      developmentAppearances,
      matchdayAdditions,
      actualAdditionalAppearances,
      plannedButAbsent,
      finalisedUpcomingAppearances,
      draftSelections,
      squadRepairAppearances,
      unavailableRoundCount: playerUnavailableRounds,
      dropsCount: (() => {
        const playerAssignments = roundAssignmentsByPlayer.get(player.id) ?? [];
        const roundsWithSelection = new Set(playerAssignments.map((a) => a.roundId));
        const unavailableRounds = new Set(
          availabilities
            .filter((a) => a.playerId === player.id && a.status !== "AVAILABLE" && a.status !== "TENTATIVE")
            .map((a) => a.matchRoundId)
        );
        return Math.max(0, rounds.length - roundsWithSelection.size - unavailableRounds.size);
      })(),
      lastMovement: (() => {
        const assignments = roundAssignmentsByPlayer.get(player.id) ?? [];
        const nonCore = assignments.filter((a) => a.role !== null && a.role !== "CORE");
        if (nonCore.length === 0) return null;
        const roundOrder = rounds.map((r) => r.id);
        nonCore.sort((a, b) => roundOrder.indexOf(a.roundId) - roundOrder.indexOf(b.roundId));
        return nonCore[nonCore.length - 1].roundName || null;
      })(),
      recentInvolvement,
      roundAssignments: roundAssignmentsByPlayer.get(player.id) ?? [],
    };
  });

  const roundColumns = rounds.map((r, i) => ({
    id: r.id,
    name: r.name || `Round ${i + 1}`,
  }));

  // Build movement path summary from round assignments
  const playerById = new Map(players.map((p) => [p.id, p]));
  type IntermediatePath = {
    sourceTeamId: string;
    sourceTeamName: string;
    targetTeamId: string;
    targetTeamName: string;
    role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
    count: number;
    uniquePlayerIds: Set<string>;
    uniquePlayerCount: number;
    lastRoundId: string;
    lastRoundName: string | null;
  };
  const movementPathMap = new Map<string, IntermediatePath>();
  for (const [playerId, assignments] of roundAssignmentsByPlayer) {
    for (const assignment of assignments) {
      if (assignment.role === "CORE" || assignment.role === null) continue;
      const player = playerById.get(playerId);
      const sourceTeamId = player?.coreTeamId ?? "";
      const sourceTeamName = player?.coreTeam?.name ?? "Unassigned";
      const targetTeamName = assignment.teamName ?? "Unknown";
      const targetTeamId = (() => {
        for (const sel of selections) {
          if (sel.playerId === playerId && sel.matchRoundId === assignment.roundId) {
            const m = matchById.get(sel.matchId);
            if (m) return m.teamId;
          }
        }
        return "";
      })();
      const key = `${sourceTeamId}:${targetTeamId}:${assignment.role}`;
      const existing = movementPathMap.get(key);
      if (existing) {
        existing.count++;
        if (!existing.uniquePlayerIds.has(playerId)) {
          existing.uniquePlayerIds.add(playerId);
          existing.uniquePlayerCount++;
        }
        const roundIdx = rounds.findIndex((r) => r.id === assignment.roundId);
        const lastIdx = rounds.findIndex((r) => r.id === existing.lastRoundId);
        if (roundIdx > lastIdx) {
          existing.lastRoundId = assignment.roundId;
          existing.lastRoundName = assignment.roundName || null;
        }
      } else {
        movementPathMap.set(key, {
          sourceTeamId,
          sourceTeamName,
          targetTeamId,
          targetTeamName,
          role: assignment.role,
          count: 1,
          uniquePlayerCount: 1,
          uniquePlayerIds: new Set([playerId]),
          lastRoundId: assignment.roundId,
          lastRoundName: assignment.roundName || null,
        });
      }
    }
  }

  const movementPaths: MovementPathSummary[] = [...movementPathMap.values()].map((mp) => ({
    sourceTeamId: mp.sourceTeamId,
    sourceTeamName: mp.sourceTeamName,
    targetTeamId: mp.targetTeamId,
    targetTeamName: mp.targetTeamName,
    role: mp.role,
    count: mp.count,
    uniquePlayerCount: mp.uniquePlayerCount,
    lastRoundName: mp.lastRoundName,
  }));

  return {
    planningPeriod: { id: planningPeriod.id, label: planningPeriod.name },
    roundColumns: roundColumns,
    seasonRows,
    movementPaths,
  };
}

// --- Current round attention ---

export async function getPlayersCurrentRoundAttention(
  matchRoundId: string,
): Promise<Array<PlayerCurrentRoundAttentionRow>> {
  const round = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!round) return [];

  const players = await db.player.findMany({
    where: { active: true, removedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentAvailability: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const matches = await db.match.findMany({
    where: { matchRoundId },
    select: {
      id: true,
      opponent: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  const selections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: { in: ["DRAFT", "FINALIZED"] },
    },
    select: {
      playerId: true,
      matchId: true,
      role: true,
      status: true,
    },
  });

  const selectionByPlayerId = new Map<string, { matchId: string; role: string; status: string }>();
  for (const sel of selections) {
    if (!selectionByPlayerId.has(sel.playerId)) {
      selectionByPlayerId.set(sel.playerId, {
        matchId: sel.matchId,
        role: sel.role,
        status: sel.status,
      });
    }
  }

  // Get integrity signals for the round from canonical computation
  const { computeRoundPlanIntegrity } = await import("../selection/compute-plan-integrity");
  const blockedPlayerIds = new Set<string>();
  const decisionRequiredPlayerIds = new Set<string>();

  try {
    const integrity = await computeRoundPlanIntegrity(matchRoundId);
    for (const signal of integrity.signals) {
      if (signal.playerId) {
        if (signal.kind === "BLOCKED") blockedPlayerIds.add(signal.playerId);
        if (signal.kind === "DECISION_REQUIRED") decisionRequiredPlayerIds.add(signal.playerId);
      }
    }
  } catch {
    // fallback: no integrity data available
  }

  // Availability for this round
  const availabilities = await db.availability.findMany({
    where: {
      matchRoundId,
      playerId: { in: players.map((p) => p.id) },
    },
    select: { playerId: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  const availabilityByPlayer = new Map<string, string>();
  for (const a of availabilities) {
    if (!availabilityByPlayer.has(a.playerId)) {
      availabilityByPlayer.set(a.playerId, a.status);
    }
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));

  const rows: PlayerCurrentRoundAttentionRow[] = players.map((player) => {
    const playerAvailability = availabilityByPlayer.get(player.id) ?? player.currentAvailability;
    const availability = (playerAvailability ?? "AVAILABLE") as PlayerCurrentRoundAttentionRow["availability"];

    const assignment = selectionByPlayerId.get(player.id);
    const isUnavailable = availability !== "AVAILABLE" && availability !== "TENTATIVE" && availability !== "UNKNOWN";
    const isBlocked = blockedPlayerIds.has(player.id);
    const isDecisionRequired = decisionRequiredPlayerIds.has(player.id);

    let integrityState: IntegrityAttentionState;
    let currentAssignment: PlayerCurrentRoundAttentionRow["currentAssignment"] = null;

    if (isBlocked) {
      if (isUnavailable && assignment) {
        integrityState = "BLOCKED_UNAVAILABLE_SELECTION";
      } else {
        integrityState = "BLOCKED_INVALID_PLAN";
      }
    } else if (isDecisionRequired) {
      integrityState = "DECISION_REQUIRED_NO_PLANNED_MATCH";
    } else if (assignment) {
      integrityState = "COVERED";
      const match = matchById.get(assignment.matchId);
      if (match) {
        currentAssignment = {
          matchId: match.id,
          teamName: match.team.name,
          opponent: match.opponent ?? "",
          role: assignment.role as "CORE" | "SUPPORT" | "DEVELOPMENT",
        };
      }
    } else if (isUnavailable) {
      integrityState = "NOT_AVAILABLE";
    } else if (availability === "TENTATIVE" || availability === "UNKNOWN") {
      integrityState = "UNCONFIRMED";
    } else {
      integrityState = "DECISION_REQUIRED_NO_PLANNED_MATCH";
    }

    return {
      playerId: player.id,
      displayName: `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`,
      coreTeam: player.coreTeam ? { id: player.coreTeam.id, name: player.coreTeam.name } : null,
      availability,
      currentAssignment,
      integrityState,
    };
  });

  return rows;
}