import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch, FixtureReportState, CompletedFixtureResult } from "./types";
import { db } from "@/lib/db";
import { deriveRoundStatus } from "@/lib/round-status";
import { getRoundActions, deriveMatchSelectionState } from "./selection-state-utils";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { formatPlanningPeriodRange } from "@/lib/date/format-planning-period-range";

function mapReadiness(blockerCount: number, decisionRequiredCount: number): "READY" | "AT_RISK" | "NOT_PLAYABLE" {
  if (blockerCount > 0) return "NOT_PLAYABLE";
  if (decisionRequiredCount > 0) return "AT_RISK";
  return "READY";
}

export async function getFixturesOverview(): Promise<FixturesOverview> {
  const seasons = await db.season.findMany({
    orderBy: { name: "desc" },
    include: {
      planningPeriods: {
        orderBy: { startDate: "asc" },
        include: {
          matchRounds: {
            orderBy: { name: "asc" },
            include: {
              matches: {
                include: { team: true },
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (seasons.length === 0) {
    return { periods: [] };
  }

  const allMatchIds = seasons.flatMap((s) =>
    s.planningPeriods.flatMap((p) =>
      p.matchRounds.flatMap((r) => r.matches.map((m) => m.id)),
    ),
  );

  const [allSelections, postMatchReports] = await Promise.all([
    allMatchIds.length > 0
      ? db.selection.findMany({
          where: { matchId: { in: allMatchIds } },
          select: { matchId: true, status: true },
        })
      : Promise.resolve([]),
    db.postMatchReport.findMany({
      where: { matchId: { in: allMatchIds } },
      select: { id: true, matchId: true, status: true, homeGoals: true, awayGoals: true },
    }),
  ]);

  const matchDraftCounts = new Map<string, number>();
  const matchFinalizedCounts = new Map<string, number>();
  for (const s of allSelections) {
    if (s.status === "DRAFT") {
      matchDraftCounts.set(s.matchId, (matchDraftCounts.get(s.matchId) ?? 0) + 1);
    } else if (s.status === "FINALIZED") {
      matchFinalizedCounts.set(s.matchId, (matchFinalizedCounts.get(s.matchId) ?? 0) + 1);
    }
  }

  const postMatchStatusMap = new Map<string, string>();
  const postMatchResultMap = new Map<string, { reportId: string; homeGoals: number; awayGoals: number }>();
  for (const r of postMatchReports) {
    postMatchStatusMap.set(r.matchId, r.status);
    if ((r.status === "REPORTED" || r.status === "LOCKED") && r.homeGoals !== null && r.awayGoals !== null) {
      postMatchResultMap.set(r.matchId, { reportId: r.id, homeGoals: r.homeGoals, awayGoals: r.awayGoals });
    }
  }

  const integrityCache = new Map<string, Awaited<ReturnType<typeof computeRoundPlanIntegrity>>>();

  const periods: FixturePeriod[] = [];

  for (const season of seasons) {
    for (const period of season.planningPeriods) {
      const rounds: FixtureRound[] = [];

      for (const round of period.matchRounds) {
        let blockerCount = 0;
        let decisionRequiredCount = 0;
        let matchSignals: Array<{ matchId: string | undefined; kind: string }> = [];

        if (round.status !== "FINALIZED") {
          try {
            let integrity = integrityCache.get(round.id);
            if (!integrity) {
              integrity = await computeRoundPlanIntegrity(round.id);
              integrityCache.set(round.id, integrity);
            }
            blockerCount = integrity.summary.blockerCount;
            decisionRequiredCount = integrity.summary.decisionRequiredCount;
            matchSignals = integrity.signals.map((s) => ({ matchId: s.matchId, kind: s.kind }));
          } catch {
            // fallback to zero if computation fails
          }
        }

        const roundDraftSelectionCount = round.matches.reduce(
          (sum, m) => sum + (matchDraftCounts.get(m.id) ?? 0), 0,
        );
        const hasDraftSelections = roundDraftSelectionCount > 0;
        const hasMatches = round.matches.length > 0;

        const derivedRoundStatus = deriveRoundStatus({
          dbStatus: round.status,
          hasDraftSelections,
          hasMatches,
          blockedSignalCount: blockerCount,
        });

        const matches: FixtureMatch[] = round.matches.map((match) => {
          const matchDraftCount = matchDraftCounts.get(match.id) ?? 0;
          const matchFinalizedCount = matchFinalizedCounts.get(match.id) ?? 0;
          const matchSelectionState = deriveMatchSelectionState(
            derivedRoundStatus,
            matchDraftCount > 0,
            matchFinalizedCount > 0,
          );

          const matchBlockerCount = matchSignals.filter(
            (s) => s.matchId === match.id && s.kind === "BLOCKED",
          ).length;
          const matchDecisionCount = matchSignals.filter(
            (s) => s.matchId === match.id && s.kind === "DECISION_REQUIRED",
          ).length;

          const postMatchStatus = postMatchStatusMap.get(match.id);
          let reportState: FixtureReportState = { state: "NO_REPORT" };
          if (postMatchStatus === "DRAFT") {
            const result = postMatchResultMap.get(match.id);
            reportState = { state: "DRAFT_REPORT_INCOMPLETE", reportId: result?.reportId ?? "" };
          } else if (postMatchStatus === "REPORTED" || postMatchStatus === "LOCKED") {
            const result = postMatchResultMap.get(match.id);
            if (result) {
              const isHome = match.homeAway === "HOME";
              const goalsFor = isHome ? result.homeGoals : result.awayGoals;
              const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
              const completedResult: CompletedFixtureResult = {
                goalsFor,
                goalsAgainst,
                outcome: goalsFor > goalsAgainst ? "WON" : goalsFor === goalsAgainst ? "DRAWN" : "LOST",
                displayScore: `${goalsFor}–${goalsAgainst}`,
              };
              reportState = { state: "COMPLETED", result: completedResult };
            }
          }

          return {
            id: match.id,
            title: `${match.team.name} vs ${match.opponent}`,
            teamId: match.teamId,
            teamName: match.team.name,
            opponent: match.opponent,
            startsAt: match.startsAt?.toISOString(),
            venue: match.homeAway === "HOME" ? "Home" : match.homeAway === "AWAY" ? "Away" : undefined,
            readinessState: mapReadiness(matchBlockerCount, matchDecisionCount),
            selectionState: matchSelectionState,
            selectedPlayerCount: matchDraftCount + matchFinalizedCount,
            blockerCount: matchBlockerCount,
            decisionRequiredCount: matchDecisionCount,
            postMatchStatus: (postMatchStatus as FixtureMatch["postMatchStatus"]) ?? undefined,
            reportState,
            availableActions: getRoundActions(derivedRoundStatus, hasMatches),
          };
        });

        const roundActions = getRoundActions(derivedRoundStatus, hasMatches);

        rounds.push({
          id: round.id,
          title: round.name,
          dateRange: undefined,
          readinessState: mapReadiness(blockerCount, decisionRequiredCount),
          selectionState: derivedRoundStatus,
          hasDraftSelections,
          hasMatches,
          blockerCount,
          decisionRequiredCount,
          availableActions: roundActions,
          matches,
        });
      }

      const periodBlockerCount = rounds.reduce((sum, r) => sum + r.blockerCount, 0);
      const periodDecisionCount = rounds.reduce((sum, r) => sum + r.decisionRequiredCount, 0);

      periods.push({
        id: period.id,
        title: period.name,
        dateRange: formatPlanningPeriodRange(new Date(period.startDate), new Date(period.endDate)),
        readinessState: mapReadiness(periodBlockerCount, periodDecisionCount),
        blockerCount: periodBlockerCount,
        decisionRequiredCount: periodDecisionCount,
        rounds,
      });
    }
  }

  return { periods };
}