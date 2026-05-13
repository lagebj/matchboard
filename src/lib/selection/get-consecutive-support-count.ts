import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isSupportRole } from "./effective-participation";

export type ConsecutiveSupportResult = {
  consecutiveSupportRounds: number;
  totalSupportRounds: number;
};

export async function getConsecutiveSupportCount(
  playerId: string,
  currentMatchDate: Date,
): Promise<ConsecutiveSupportResult> {
  const [allSelections, reportedReports] = await Promise.all([
    db.selection.findMany({
      where: {
        playerId,
        status: SelectionStatus.FINALIZED,
        match: {
          startsAt: {
            lt: currentMatchDate,
          },
        },
      },
      select: {
        matchRoundId: true,
        matchId: true,
        role: true,
        match: {
          select: {
            startsAt: true,
          },
        },
      },
      orderBy: {
        match: {
          startsAt: "desc",
        },
      },
    }),
    db.postMatchReport.findMany({
      where: {
        status: { in: ["REPORTED", "LOCKED"] },
      },
      select: {
        id: true,
        matchId: true,
      },
    }),
  ]);

  const reportedMatchRoundMap = new Map<string, string>();
  const reportedReportIds: string[] = [];

  for (const report of reportedReports) {
    const sel = allSelections.find((s) => s.matchId === report.matchId);
    if (sel) {
      reportedMatchRoundMap.set(report.matchId, sel.matchRoundId);
      reportedReportIds.push(report.id);
    }
  }

  const reportedMatchIds = new Set(reportedMatchRoundMap.keys());

  let noShowMatchIds = new Set<string>();
  let absentMatchIds = new Set<string>();

  if (reportedReportIds.length > 0) {
    const [noShows, absences] = await Promise.all([
      db.postMatchPlayerActual.findMany({
        where: {
          reportId: { in: reportedReportIds },
          playerId,
          attendanceStatus: "NO_SHOW",
        },
        select: { matchId: true },
      }),
      db.matchReportAbsence.findMany({
        where: {
          matchReportId: { in: reportedReportIds },
          playerId,
        },
        select: { matchId: true },
      }),
    ]);
    noShowMatchIds = new Set(noShows.map((n) => n.matchId));
    absentMatchIds = new Set(absences.map((a) => a.matchId));
  }

  const roundsByDate = new Map<string, string>();
  const roleByRound = new Map<string, Set<string>>();

  for (const s of allSelections) {
    if (reportedMatchIds.has(s.matchId)) {
      if (noShowMatchIds.has(s.matchId) || absentMatchIds.has(s.matchId)) {
        continue;
      }
    }
    roundsByDate.set(s.matchRoundId, s.match.startsAt.toISOString());
    if (!roleByRound.has(s.matchRoundId)) {
      roleByRound.set(s.matchRoundId, new Set());
    }
    roleByRound.get(s.matchRoundId)!.add(s.role);
  }

  const sortedRoundIds = [...roundsByDate.entries()]
    .sort(([, a], [, b]) => b.localeCompare(a))
    .map(([id]) => id);

  let totalSupportRounds = 0;

  for (const roundId of sortedRoundIds) {
    const roles = roleByRound.get(roundId);
    if (roles && [...roles].some((r) => isSupportRole(r as "SUPPORT" | "BACKFILL"))) {
      totalSupportRounds++;
    }
  }

  let consecutive = 0;

  for (const roundId of sortedRoundIds) {
    const roles = roleByRound.get(roundId);
    if (roles && [...roles].some((r) => isSupportRole(r as "SUPPORT" | "BACKFILL"))) {
      consecutive++;
    } else {
      break;
    }
  }

  return {
    consecutiveSupportRounds: consecutive,
    totalSupportRounds,
  };
}