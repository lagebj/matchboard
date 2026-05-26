import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch } from "./types";
import { db } from "@/lib/db";
import { deriveRoundStatus } from "@/lib/round-status";
import { getRoundActions, deriveMatchSelectionState } from "./selection-state-utils";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

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

  const periods: FixturePeriod[] = [];

  for (const season of seasons) {
    for (const period of season.planningPeriods) {
      const rounds: FixtureRound[] = [];

      for (const round of period.matchRounds) {
        let blockerCount = 0;
        let decisionRequiredCount = 0;

        if (round.status !== "FINALIZED") {
          try {
            const integrity = await computeRoundPlanIntegrity(round.id);
            blockerCount = integrity.summary.blockerCount;
            decisionRequiredCount = integrity.summary.decisionRequiredCount;
          } catch {
            // fallback to zero if computation fails
          }
        }

        const allMatchIds = round.matches.map((m) => m.id);

        const allSelections = allMatchIds.length > 0
          ? await db.selection.findMany({
              where: { matchId: { in: allMatchIds } },
              select: { matchId: true, status: true },
            })
          : [];

        const matchDraftCounts = new Map<string, number>();
        const matchFinalizedCounts = new Map<string, number>();
        for (const s of allSelections) {
          if (s.status === "DRAFT") {
            matchDraftCounts.set(s.matchId, (matchDraftCounts.get(s.matchId) ?? 0) + 1);
          } else if (s.status === "FINALIZED") {
            matchFinalizedCounts.set(s.matchId, (matchFinalizedCounts.get(s.matchId) ?? 0) + 1);
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

          let matchBlockerCount = 0;
          let matchDecisionCount = 0;

          if (round.status !== "FINALIZED") {
            try {
              const matchIntegrity = await computeRoundPlanIntegrity(round.id);
              for (const signal of matchIntegrity.signals) {
                if (signal.matchId === match.id) {
                  if (signal.kind === "BLOCKED") matchBlockerCount++;
                  if (signal.kind === "DECISION_REQUIRED") matchDecisionCount++;
                }
              }
            } catch {
              // fallback to zero
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
        dateRange: `${period.startDate.toLocaleDateString()} – ${period.endDate.toLocaleDateString()}`,
        readinessState: mapReadiness(periodBlockerCount, periodDecisionCount),
        blockerCount: periodBlockerCount,
        decisionRequiredCount: periodDecisionCount,
        rounds,
      });
    }
  }

  return { periods };
}