import "server-only";

import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import type {
  InsightFilters,
  PlannedActualDelta,
  PlannedActualDeltaEntry,
} from "./insights-types";
import { SelectionRole } from "@/generated/prisma/client";
import { classifyDeltaType } from "./planned-vs-actual-helpers";

export async function getPlannedVsActualDeltas(
  filters: InsightFilters,
): Promise<PlannedActualDelta[]> {
  await requireCoachAccess();

  const rounds = await db.matchRound.findMany({
    where: { leagueSeasonId: filters.leagueSeasonId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = rounds.map((r) => r.id);

  const matches = await db.match.findMany({
    where: { matchRoundId: { in: roundIds } },
    select: {
      id: true,
      matchRoundId: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  });

  const deltas: PlannedActualDelta[] = [];

  for (const match of matches) {
    const report = await db.postMatchReport.findFirst({
      where: { matchId: match.id },
      select: {
        id: true,
        status: true,
      },
    });

    let reportStatus: "draft" | "reported" | "locked" | "missing";
    if (!report) {
      reportStatus = "missing";
    } else if (report.status === "DRAFT") {
      reportStatus = "draft";
    } else if (report.status === "REPORTED") {
      reportStatus = "reported";
    } else if (report.status === "LOCKED") {
      reportStatus = "locked";
    } else {
      reportStatus = "missing";
    }

    const finalizedSelections = await db.selection.findMany({
      where: {
        matchId: match.id,
        status: "FINALIZED",
      },
      select: {
        playerId: true,
        role: true,
        player: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const actualParticipations = report
      ? await db.postMatchPlayerActual.findMany({
          where: {
            report: { matchId: match.id },
            attendanceStatus: "PRESENT",
          },
          select: {
            playerId: true,
            source: true,
            player: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        })
      : [];

    const plannedPlayerIds = new Set(finalizedSelections.map((s) => s.playerId));
    const actualPlayerIds = new Set(actualParticipations.map((a) => a.playerId));

    const entries: PlannedActualDeltaEntry[] = [];

    for (const sel of finalizedSelections) {
      const wasPresent = actualPlayerIds.has(sel.playerId);
      if (!wasPresent) {
        entries.push({
          playerId: sel.playerId,
          playerName: sel.player.firstName + (sel.player.lastName ? " " + sel.player.lastName : ""),
          deltaType: "planned_absent",
          plannedRole: sel.role as SelectionRole,
          actualRole: undefined,
          detail: "Planned but did not play",
        });
      }
    }

    for (const act of actualParticipations) {
      const wasPlanned = plannedPlayerIds.has(act.playerId);
      if (!wasPlanned) {
        entries.push({
          playerId: act.playerId,
          playerName: act.player.firstName + (act.player.lastName ? " " + act.player.lastName : ""),
          deltaType: classifyDeltaType(act.source),
          plannedRole: undefined,
          actualRole: undefined,
          detail: "Not in planned squad but played",
        });
      }
    }

    const round = rounds.find((r) => r.id === match.matchRoundId);
    if (entries.length > 0 || reportStatus !== "missing") {
      deltas.push({
        matchId: match.id,
        matchRoundId: match.matchRoundId,
        matchRoundLabel: round?.name ?? match.matchRoundId,
        teamId: match.teamId,
        teamName: match.team.name,
        deltas: entries,
        reportStatus,
      });
    }
  }

  return deltas;
}