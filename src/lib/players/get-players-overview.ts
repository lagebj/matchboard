import { db } from "@/lib/db";
import { classifyRole } from "../selection/effective-participation";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

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
  leagueSeason: { id: string; label: string };
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
  playerNames: string[];
};

export type SeasonFairnessWarning = {
  type: "support_count_exceeds_core" | "development_count_exceeds_core" | "support_without_core_appearances" | "development_without_core_appearances" | "repeated_additional_appearances" | "dropped_before_playing_again" | "consecutive_movement" | "disproportionate_support_source" | "expected_support_path_unused";
  playerId: string;
  teamId: string | null;
  teamName: string | null;
  reason: string;
  data: Record<string, number | string | null>;
};

export type SeasonOverviewResult = {
  leagueSeason: { id: string; label: string };
  roundColumns: Array<{ id: string; name: string }>;
  seasonRows: PlayerSeasonOverviewRow[];
  movementPaths: MovementPathSummary[];
  fairnessWarnings: SeasonFairnessWarning[];
};

export async function getPlayersSeasonOverview(
  leagueSeasonId: string,
  options?: { teamId?: string; orgFilter?: OrgFilterMode },
): Promise<SeasonOverviewResult> {
  const orgWhere = options?.orgFilter && options.orgFilter.type === 'org' ? options.orgFilter.filter : {};

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...orgWhere },
    select: { id: true, name: true },
  });

  if (!leagueSeason) {
    return {
      leagueSeason: { id: leagueSeasonId, label: "Unknown" },
      roundColumns: [],
      seasonRows: [],
      movementPaths: [],
      fairnessWarnings: [],
    };
  }

  const players = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      ...orgWhere,
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
      leagueSeason: { id: leagueSeason.id, label: leagueSeason.name },
      roundColumns: [],
      seasonRows: [],
      movementPaths: [],
      fairnessWarnings: [],
    };
  }

  const playerIds = players.map((p) => p.id);

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId, ...orgWhere },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const roundIds = rounds.map((r) => r.id);

  const matches = roundIds.length > 0
    ? await db.match.findMany({
        where: { matchRoundId: { in: roundIds }, status: { not: "CANCELLED" }, ...orgWhere },
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
          ...orgWhere,
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
          goals: {
            where: { playerId: { in: playerIds } },
            select: { playerId: true },
          },
          assists: {
            where: { playerId: { in: playerIds } },
            select: { playerId: true },
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

      // ADR-0106: playerId is nullable at the type level (GuestPlayer facts use guestPlayerId
      // instead), but this query's own `where: { playerId: { in: playerIds } }` already excludes
      // both nulls and guest-only rows at the database level -- playerIds is the tracked-Player
      // id set, and SQL `IN` never matches NULL. Guarded anyway for defence-in-depth and to match
      // this file's existing convention (see the goal/assist checks below).
      if (!actual.playerId) continue;
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

    for (const goal of report.goals) {
      if (goal.playerId && playerIds.includes(goal.playerId)) {
        const existing = statsByPlayer.get(goal.playerId) ?? { goals: 0, assists: 0 };
        existing.goals += 1;
        statsByPlayer.set(goal.playerId, existing);
      }
    }

    for (const assist of report.assists) {
      // ADR-0106: Assist.playerId is now nullable (a GuestPlayer assist uses guestPlayerId
      // instead) -- excluded here by construction, matching the goal check above.
      if (assist.playerId && playerIds.includes(assist.playerId)) {
        const existing = statsByPlayer.get(assist.playerId) ?? { goals: 0, assists: 0 };
        existing.assists += 1;
        statsByPlayer.set(assist.playerId, existing);
      }
    }
  }

  // --- Event match goals/assists (cup, tournament, friendly, other) ---

  const eventReports = await db.eventPostMatchReport.findMany({
    where: {
      status: { in: ["REPORTED", "LOCKED"] },
      ...orgWhere,
    },
    select: {
      id: true,
      goalEvents: {
        where: { playerId: { in: playerIds } },
        select: { playerId: true },
      },
      assistEvents: {
        where: { playerId: { in: playerIds } },
        select: { playerId: true },
      },
      playerReports: {
        where: { playerId: { in: playerIds }, attendanceStatus: "PRESENT" },
        select: { playerId: true },
      },
    },
  });

  const eventAppearancesByPlayer = new Map<string, number>();

  for (const report of eventReports) {
    for (const goal of report.goalEvents) {
      if (goal.playerId) {
        const existing = statsByPlayer.get(goal.playerId) ?? { goals: 0, assists: 0 };
        existing.goals += 1;
        statsByPlayer.set(goal.playerId, existing);
      }
    }

    for (const assist of report.assistEvents) {
      // ADR-0106: EventAssistEvent.playerId is now nullable (a GuestPlayer assist uses
      // guestPlayerId instead) -- excluded here by construction, matching the goal check above.
      if (!assist.playerId) continue;
      const existing = statsByPlayer.get(assist.playerId) ?? { goals: 0, assists: 0 };
      existing.assists += 1;
      statsByPlayer.set(assist.playerId, existing);
    }

    for (const pr of report.playerReports) {
      // ADR-0106: EventPostMatchPlayer.playerId is now nullable (a GuestPlayer appearance uses
      // guestPlayerId instead) -- excluded here by construction, since this map feeds Player
      // season "played" totals.
      if (!pr.playerId) continue;
      eventAppearancesByPlayer.set(pr.playerId, (eventAppearancesByPlayer.get(pr.playerId) ?? 0) + 1);
    }
  }

  // --- Planned selections ---

  const selections = matchIds.length > 0
    ? await db.selection.findMany({
        where: {
          matchId: { in: matchIds },
          playerId: { in: playerIds },
          status: { in: ["DRAFT", "FINALIZED"] },
          ...orgWhere,
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
          ...orgWhere,
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
    const playerEventAppearances = eventAppearancesByPlayer.get(player.id) ?? 0;

    let actualAppearances = 0;
    let coreAppearances = 0;
    let supportAppearances = 0;
    let developmentAppearances = 0;
    let squadRepairAppearances = 0;
    let matchdayAdditions = 0;
    let plannedButAbsent = 0;
    let finalisedUpcomingAppearances = 0;

    // Actual appearances (league)
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
      actualAppearances: actualAppearances + playerEventAppearances,
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
    playerNames: string[];
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
          const pName = player ? `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}` : "Unknown";
          existing.playerNames.push(pName);
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
          playerNames: [player ? `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}` : "Unknown"],
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
    playerNames: mp.playerNames,
  }));

  // Compute season fairness warnings from season rows
  const fairnessWarnings: SeasonFairnessWarning[] = [];

  // Team-level support source averages for disproportionate support detection
  const teamSupportTotals = new Map<string, { supportCount: number; playerCount: number }>();
  for (const row of seasonRows) {
    const teamId = row.coreTeam?.id ?? "unassigned";
    const existing = teamSupportTotals.get(teamId) ?? { supportCount: 0, playerCount: 0 };
    existing.supportCount += row.supportAppearances;
    existing.playerCount++;
    teamSupportTotals.set(teamId, existing);
  }

  for (const row of seasonRows) {
    // support_count_exceeds_core: player has more support than core appearances, with at least some core context
    if (row.supportAppearances > row.coreAppearances && row.coreAppearances > 0) {
      fairnessWarnings.push({
        type: "support_count_exceeds_core",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `${row.supportAppearances} support vs ${row.coreAppearances} core appearances`,
        data: { supportCount: row.supportAppearances, coreCount: row.coreAppearances },
      });
    }

    // support_without_core_appearances: player has support appearances but zero core appearances
    if (row.coreAppearances === 0 && row.supportAppearances > 0) {
      fairnessWarnings.push({
        type: "support_without_core_appearances",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `${row.supportAppearances} support appearances with 0 core appearances`,
        data: { supportCount: row.supportAppearances, coreCount: row.coreAppearances },
      });
    }

    // development_count_exceeds_core: player has more development than core, with some core context
    if (row.developmentAppearances > row.coreAppearances && row.coreAppearances > 0) {
      fairnessWarnings.push({
        type: "development_count_exceeds_core",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `${row.developmentAppearances} development vs ${row.coreAppearances} core appearances`,
        data: { developmentCount: row.developmentAppearances, coreCount: row.coreAppearances },
      });
    }

    // development_without_core_appearances: player has development appearances but zero core appearances
    if (row.coreAppearances === 0 && row.developmentAppearances > 0) {
      fairnessWarnings.push({
        type: "development_without_core_appearances",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `${row.developmentAppearances} development appearances with 0 core appearances`,
        data: { developmentCount: row.developmentAppearances, coreCount: row.coreAppearances },
      });
    }

    // repeated_additional_appearances: player has additional actual appearances
    if (row.actualAdditionalAppearances > 1) {
      fairnessWarnings.push({
        type: "repeated_additional_appearances",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `${row.actualAdditionalAppearances} additional actual appearances`,
        data: { additionalAppearances: row.actualAdditionalAppearances },
      });
    }

    // dropped_before_playing_again: player dropped multiple rounds without playing
    if (row.dropsCount >= 2 && row.actualAppearances === 0) {
      fairnessWarnings.push({
        type: "dropped_before_playing_again",
        playerId: row.playerId,
        teamId: row.coreTeam?.id ?? null,
        teamName: row.coreTeam?.name ?? null,
        reason: `Dropped ${row.dropsCount} rounds with no appearances`,
        data: { dropsCount: row.dropsCount, appearances: row.actualAppearances },
      });
    }

    // consecutive_movement: last movement is non-null (player moved multiple rounds)
    if (row.lastMovement) {
      const movementCount = row.roundAssignments.filter((a) => a.role !== "CORE" && a.role !== null).length;
      if (movementCount >= 3) {
        fairnessWarnings.push({
          type: "consecutive_movement",
          playerId: row.playerId,
          teamId: row.coreTeam?.id ?? null,
          teamName: row.coreTeam?.name ?? null,
          reason: `${movementCount} non-core rounds, last in ${row.lastMovement}`,
          data: { movementCount, lastMovement: row.lastMovement },
        });
      }
    }
  }

  // disproportionate_support_source: team supplies significantly more support than average
  for (const [teamId, totals] of teamSupportTotals) {
    if (totals.playerCount === 0) continue;
    const avg = [...teamSupportTotals.values()].reduce((s, t) => s + t.supportCount / t.playerCount, 0) / teamSupportTotals.size;
    const teamAvg = totals.supportCount / totals.playerCount;
    if (teamAvg > avg * 2 && totals.supportCount >= 2) {
      const teamName = seasonRows.find((r) => r.coreTeam?.id === teamId)?.coreTeam?.name ?? "Unknown";
      fairnessWarnings.push({
        type: "disproportionate_support_source",
        playerId: "",
        teamId: teamId === "unassigned" ? null : teamId,
        teamName: teamId === "unassigned" ? null : teamName,
        reason: `Team supplies ${totals.supportCount} support across ${totals.playerCount} players (avg: ${avg.toFixed(1)})`,
        data: { teamSupportCount: totals.supportCount, teamPlayerCount: totals.playerCount, periodAvg: Math.round(avg * 10) / 10 },
      });
    }
  }

  // expected_support_path_unused: rotation paths not used in movementPaths
  const configuredPaths = await db.rotationPath.findMany({
    where: { active: true, ...orgWhere },
    select: { id: true, fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { name: true } }, toTeam: { select: { name: true } } },
  });
  for (const path of configuredPaths) {
    const usedInMovement = movementPaths.some(
      (mp) => mp.sourceTeamId === path.fromTeamId && mp.targetTeamId === path.toTeamId && mp.role === path.role,
    );
    if (!usedInMovement) {
      fairnessWarnings.push({
        type: "expected_support_path_unused",
        playerId: "",
        teamId: path.fromTeamId,
        teamName: path.fromTeam?.name ?? null,
        reason: `Active path ${path.fromTeam?.name ?? "Unknown"} → ${path.toTeam?.name ?? "Unknown"} (${path.role.toLowerCase()}) not used this period`,
        data: { fromTeamId: path.fromTeamId, toTeamId: path.toTeamId, pathRole: path.role },
      });
    }
  }

  return {
      leagueSeason: { id: leagueSeason.id, label: leagueSeason.name },
    roundColumns: roundColumns,
    seasonRows,
    movementPaths,
    fairnessWarnings,
  };
}

// --- Current round attention ---

export async function getPlayersCurrentRoundAttention(
  matchRoundId: string,
  orgFilter?: OrgFilterMode,
): Promise<Array<PlayerCurrentRoundAttentionRow>> {
  const orgWhere = orgFilter && orgFilter.type === 'org' ? orgFilter.filter : {};

  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId, ...orgWhere },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!round) return [];

  const players = await db.player.findMany({
    where: { active: true, removedAt: null, ...orgWhere },
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
    where: { matchRoundId, status: { not: "CANCELLED" }, ...orgWhere },
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
      ...orgWhere,
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
      ...orgWhere,
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