import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch } from "./types";
import { db } from "@/lib/db";
import { WarningSeverity } from "@/generated/prisma/client";

function mapReadiness(worstSeverity: string | undefined): "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE" {
  if (worstSeverity === "HARD_BLOCK") return "NOT_PLAYABLE";
  if (worstSeverity === "REQUIRES_OVERRIDE") return "AT_RISK";
  if (worstSeverity === "WARNING") return "WATCH";
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

  const allRoundIds = seasons.flatMap((s) =>
    s.planningPeriods.flatMap((p) => p.matchRounds.map((r) => r.id)),
  );

  const allMatchIds = seasons.flatMap((s) =>
    s.planningPeriods.flatMap((p) =>
      p.matchRounds.flatMap((r) => r.matches.map((m) => m.id)),
    ),
  );

  const roundWarnings = await db.warning.findMany({
    where: { matchRoundId: { in: allRoundIds.length > 0 ? allRoundIds : undefined } },
  });

  const roundIssueCounts = new Map<string, number>();
  for (const w of roundWarnings) {
    if (w.matchRoundId) {
      roundIssueCounts.set(w.matchRoundId, (roundIssueCounts.get(w.matchRoundId) ?? 0) + 1);
    }
  }

  const matchWarnings = await db.warning.findMany({
    where: { matchId: { in: allMatchIds.length > 0 ? allMatchIds : undefined } },
  });

  const matchIssueCounts = new Map<string, number>();
  for (const w of matchWarnings) {
    if (w.matchId) {
      matchIssueCounts.set(w.matchId, (matchIssueCounts.get(w.matchId) ?? 0) + 1);
    }
  }

  const roundStatusMap = new Map<string, string>();
  for (const w of roundWarnings) {
    if (!w.matchRoundId) continue;
    const current = roundStatusMap.get(w.matchRoundId);
    if (!current || (w.severity === "HARD_BLOCK" && current !== "HARD_BLOCK")) {
      if (w.severity === WarningSeverity.HARD_BLOCK) {
        roundStatusMap.set(w.matchRoundId, "HARD_BLOCK");
      } else if (w.severity === WarningSeverity.REQUIRES_OVERRIDE && current !== "HARD_BLOCK") {
        roundStatusMap.set(w.matchRoundId, "REQUIRES_OVERRIDE");
      } else if (w.severity === WarningSeverity.WARNING && !current) {
        roundStatusMap.set(w.matchRoundId, "WARNING");
      }
    }
  }

  const matchStatusMap = new Map<string, string>();
  for (const w of matchWarnings) {
    if (!w.matchId) continue;
    const current = matchStatusMap.get(w.matchId);
    if (!current || (w.severity === "HARD_BLOCK" && current !== "HARD_BLOCK")) {
      if (w.severity === WarningSeverity.HARD_BLOCK) {
        matchStatusMap.set(w.matchId, "HARD_BLOCK");
      } else if (w.severity === WarningSeverity.REQUIRES_OVERRIDE && current !== "HARD_BLOCK") {
        matchStatusMap.set(w.matchId, "REQUIRES_OVERRIDE");
      } else if (w.severity === WarningSeverity.WARNING && !current) {
        matchStatusMap.set(w.matchId, "WARNING");
      }
    }
  }

  const draftSelections = allMatchIds.length > 0
    ? await db.selection.findMany({
        where: { matchId: { in: allMatchIds }, status: "DRAFT" },
        select: { matchId: true },
      })
    : [];

  const matchSelectionCounts = new Map<string, number>();
  for (const s of draftSelections) {
    matchSelectionCounts.set(s.matchId, (matchSelectionCounts.get(s.matchId) ?? 0) + 1);
  }

  const postMatchReports = await db.postMatchReport.findMany({
    where: { matchId: { in: allMatchIds.length > 0 ? allMatchIds : undefined } },
    select: { matchId: true, status: true },
  });

  const postMatchStatusMap = new Map<string, string>();
  for (const r of postMatchReports) {
    postMatchStatusMap.set(r.matchId, r.status);
  }

  const periods: FixturePeriod[] = seasons.flatMap((season) =>
    season.planningPeriods.map((period) => {
      const rounds: FixtureRound[] = period.matchRounds.map((round) => {
        const matches: FixtureMatch[] = round.matches.map((match) => ({
          id: match.id,
          title: `${match.team.name} vs ${match.opponent}`,
          teamId: match.teamId,
          teamName: match.team.name,
          opponent: match.opponent,
          startsAt: match.startsAt?.toISOString(),
          venue: match.homeAway === "HOME" ? "Home" : match.homeAway === "AWAY" ? "Away" : undefined,
          readinessState: mapReadiness(matchStatusMap.get(match.id)),
          selectedPlayerCount: matchSelectionCounts.get(match.id) ?? 0,
          unresolvedIssueCount: matchIssueCounts.get(match.id) ?? 0,
          postMatchStatus: (postMatchStatusMap.get(match.id) as FixtureMatch["postMatchStatus"]) ?? undefined,
        }));

        return {
          id: round.id,
          title: round.name,
          dateRange: undefined,
          readinessState: mapReadiness(roundStatusMap.get(round.id)),
          generated: round.status !== "NOT_GENERATED",
          published: round.status === "FINALIZED",
          unresolvedIssueCount: roundIssueCounts.get(round.id) ?? 0,
          matches,
        };
      });

      const periodIssueCount = rounds.reduce((sum, r) => sum + r.unresolvedIssueCount, 0);
      const periodReadinessStates = rounds.map((r) => r.readinessState ?? "READY");
      const worstPeriodReadiness = periodReadinessStates.reduce((worst: string, cur: string) => {
        const order: Record<string, number> = { NOT_PLAYABLE: 0, AT_RISK: 1, WATCH: 2, READY: 3 };
        return order[cur] < order[worst] ? cur : worst;
      }, "READY");

      return {
        id: period.id,
        title: period.name,
        dateRange: `${period.startDate.toLocaleDateString()} – ${period.endDate.toLocaleDateString()}`,
        readinessState: worstPeriodReadiness as FixturePeriod["readinessState"],
        unresolvedIssueCount: periodIssueCount,
        rounds,
      };
    }),
  );

  return { periods };
}