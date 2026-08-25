import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { SelectionStatus } from "@/generated/prisma/client";
import { mapPlannedRoleToStatus, mapPlannedRoleToActualStatus } from "./opportunity-matrix-helpers";
import type {
  InsightFilters,
  OpportunityMatrixRow,
  OpportunityMatrixCell,
  OpportunityCellStatus,
  InsightAttentionFlag,
} from "./insights-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function getOpportunityMatrix(
  filters: InsightFilters,
): Promise<OpportunityMatrixRow[]> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const playerFilter = filters.includeRemoved
    ? { organisationId: orgId, OR: [{ active: true }, { active: false, removedAt: { not: null } }] }
    : filters.includeInactive
      ? { organisationId: orgId, OR: [{ active: true }, { active: false }] }
      : { organisationId: orgId, active: true, removedAt: null };

  const players = await db.player.findMany({
    where: playerFilter,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      coreTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }],
  });

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId, organisationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const selectionStatusFilter: SelectionStatus[] = filters.includeRemoved
    ? ["DRAFT", "FINALIZED"]
    : ["FINALIZED"];

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      organisationId: orgId,
      status: { in: selectionStatusFilter },
      player: playerFilter,
    },
    select: {
      playerId: true,
      role: true,
      status: true,
      matchId: true,
      matchRoundId: true,
    },
  });

  const availabilities = await db.availability.findMany({
    where: {
      matchRoundId: { in: roundIds },
      organisationId: orgId,
      player: playerFilter,
    },
    select: {
      playerId: true,
      matchRoundId: true,
      status: true,
    },
  });

  const matchIds = await db.match.findMany({
    where: { matchRoundId: { in: roundIds }, organisationId: orgId },
    select: { id: true, matchRoundId: true },
  });

  const matchIdsByRound = new Map<string, string[]>();
  for (const m of matchIds) {
    const existing = matchIdsByRound.get(m.matchRoundId) ?? [];
    existing.push(m.id);
    matchIdsByRound.set(m.matchRoundId, existing);
  }

  const completedReportMatchIds = new Set<string>();
  if (matchIds.length > 0) {
    const reports = await db.postMatchReport.findMany({
      where: {
        matchId: { in: matchIds.map((m) => m.id) },
        organisationId: orgId,
        status: { in: ["REPORTED", "LOCKED"] },
      },
      select: { matchId: true },
    });
    for (const r of reports) {
      completedReportMatchIds.add(r.matchId);
    }
  }

  const actualParticipations = await db.postMatchPlayerActual.findMany({
    where: {
      organisationId: orgId,
      report: {
        matchId: { in: matchIds.map((m) => m.id) },
        status: { in: ["REPORTED", "LOCKED"] },
      },
      attendanceStatus: "PRESENT",
    },
    select: {
      playerId: true,
      source: true,
      report: {
        select: { matchId: true },
      },
    },
  });

  const plannedByPlayerRound = new Map<string, Map<string, { role: string; matchId: string }>>();
  for (const sel of selections) {
    if (!plannedByPlayerRound.has(sel.playerId)) {
      plannedByPlayerRound.set(sel.playerId, new Map());
    }
    plannedByPlayerRound.get(sel.playerId)!.set(sel.matchRoundId, {
      role: sel.role,
      matchId: sel.matchId,
    });
  }

  const actualByPlayerMatch = new Map<string, Set<string>>();
  const actualByPlayerRound = new Map<string, Map<string, { sources: string[]; roles: Set<string> }>>();
  for (const act of actualParticipations) {
    const matchId = act.report.matchId;
    const matchRoundId = matchIds.find((m) => m.id === matchId)?.matchRoundId;
    if (!matchRoundId) continue;

    if (!actualByPlayerRound.has(act.playerId)) {
      actualByPlayerRound.set(act.playerId, new Map());
    }
    const roundMap = actualByPlayerRound.get(act.playerId)!;
    if (!roundMap.has(matchRoundId)) {
      roundMap.set(matchRoundId, { sources: [], roles: new Set() });
    }
    const entry = roundMap.get(matchRoundId)!;
    entry.sources.push(act.source);
    if (act.report?.matchId) {
      entry.roles.add("actual");
    }

    if (!actualByPlayerMatch.has(act.playerId)) {
      actualByPlayerMatch.set(act.playerId, new Set());
    }
    actualByPlayerMatch.get(act.playerId)!.add(matchRoundId);
  }

  const unavailableByPlayerRound = new Map<string, Set<string>>();
  for (const avail of availabilities) {
    if (avail.status === "UNAVAILABLE" || avail.status === "INJURED" || avail.status === "SICK") {
      if (!unavailableByPlayerRound.has(avail.playerId)) {
        unavailableByPlayerRound.set(avail.playerId, new Set());
      }
      unavailableByPlayerRound.get(avail.playerId)!.add(avail.matchRoundId);
    }
  }

  const rows: OpportunityMatrixRow[] = [];

  for (const player of players) {
    const cells: OpportunityMatrixCell[] = [];
    let plannedOpportunities = 0;
    let actualAppearances = 0;
    let missedPlannedOpportunities = 0;
    let helperAppearances = 0;
    let coreAppearances = 0;
    let supportAppearances = 0;
    let developmentAppearances = 0;
    const attentionFlags: InsightAttentionFlag[] = [];

    const plannedRounds = plannedByPlayerRound.get(player.id) ?? new Map();
    const actualRounds = actualByPlayerRound.get(player.id) ?? new Map();
    const unavailableRounds = unavailableByPlayerRound.get(player.id) ?? new Set();

    for (const round of rounds) {
      const planned = plannedRounds.get(round.id);
      const actual = actualRounds.get(round.id);
      const isUnavailable = unavailableRounds.has(round.id);
      const roundMatchIds = matchIdsByRound.get(round.id) ?? [];
      const hasCompletedReport = roundMatchIds.some((mid) => completedReportMatchIds.has(mid));

      let status: OpportunityCellStatus;
      let role: string | undefined;

      if (actual) {
        actualAppearances++;
        const sources = actual.sources;
        const isUnplanned = sources.includes("UNPLANNED");

        if (isUnplanned) {
          status = "actual_unplanned";
        } else {
          role = (planned?.role ?? "CORE") as string;
          status = mapPlannedRoleToActualStatus(role);
          switch (role) {
            case "CORE":
            case "CORE_MATCH_DROP":
              coreAppearances++;
              break;
            case "SUPPORT":
            case "BACKFILL":
              supportAppearances++;
              break;
            case "DEVELOPMENT":
            case "CONFIDENCE_REBUILD":
            case "REDUCED_MATCH_LOAD_DROP":
              developmentAppearances++;
              break;
          }
        }
        if (isUnplanned || (planned && planned.role !== "CORE" && actual)) {
          helperAppearances++;
        }
      } else if (planned) {
        plannedOpportunities++;
        role = planned.role;

        if (!hasCompletedReport) {
          status = "report_missing";
          if (!attentionFlags.includes("report_missing")) {
            attentionFlags.push("report_missing");
          }
        } else {
          status = mapPlannedRoleToStatus(planned.role);
          missedPlannedOpportunities++;
        }
      } else if (isUnavailable) {
        status = "unavailable";
      } else {
        status = "not_selected";
      }

      cells.push({
        matchRoundId: round.id,
        matchRoundLabel: round.name,
        status,
        role: role as OpportunityCellStatus | undefined,
      });
    }

    if (actualAppearances === 0 && plannedOpportunities === 0 && !attentionFlags.includes("no_actual_opportunity")) {
      attentionFlags.push("no_actual_opportunity");
    }
    if (actualAppearances >= 4 && cells.length > 0) {
      attentionFlags.push("high_recent_load");
    }
    if (missedPlannedOpportunities > 0 && !attentionFlags.includes("planned_but_absent")) {
      attentionFlags.push("planned_but_absent");
    }

    rows.push({
      playerId: player.id,
      playerName: player.firstName + (player.lastName ? " " + player.lastName : ""),
      coreTeamId: player.coreTeamId,
      coreTeamName: player.coreTeam?.name ?? null,
      attentionFlags,
      cells,
      totals: {
        plannedOpportunities,
        actualAppearances,
        missedPlannedOpportunities,
        helperAppearances,
        coreAppearances,
        supportAppearances,
        developmentAppearances,
      },
    });
  }

  return rows;
}