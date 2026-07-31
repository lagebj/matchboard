import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MatchDetail } from "@/components/matches/match-detail";
import { getActiveCoachingIntentForMatch } from "@/lib/coaching/coaching-intent";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};

  const match = await db.match.findUnique({
    where: { id: matchId, ...orgWhere },
    include: {
      team: { select: { id: true, name: true } },
      matchRound: { select: { id: true, name: true, status: true, leagueSeasonId: true, leagueSeason: { select: { id: true, startDate: true, endDate: true } } } },
      selections: {
        where: { status: { in: ["DRAFT", "FINALIZED"] } },
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              secondaryPosition: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) notFound();

  const activeIntent = await getActiveCoachingIntentForMatch(matchId);

  const postMatchReport = await db.postMatchReport.findUnique({
    where: { matchId, ...orgWhere },
    select: { status: true },
  });

  const selectionData = match.selections.map((s) => {
    const explanation = s.explanation as Record<string, unknown> | null;
    return {
      id: s.id,
      playerId: s.playerId,
      playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
      coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
      role: s.role,
      primaryPosition: s.player.primaryPosition,
      secondaryPosition: s.player.secondaryPosition,
      status: s.status,
      manualOverride: (explanation?.manualOverride as boolean) ?? false,
      selectionReason: (explanation?.summary as string) ?? "",
      priorityScore: (explanation?.priorityScore as number | null) ?? null,
      overrideReason: s.overrideReason,
      controlledDoubleLoad: s.controlledDoubleLoad ?? false,
      matchdayResponsibility: s.matchdayResponsibility ?? undefined,
    };
  });

  const warnings = await db.warning.findMany({
    where: { matchId: match.id, ...orgWhere },
    orderBy: [{ severity: "desc" }],
  });

  const warningData = warnings.map((w) => ({
    id: w.id,
    code: w.rule,
    severity: w.severity,
    message: w.message,
  }));

  const matchIntent = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: matchId, ...orgWhere },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <Link href="/matches" className="hover:text-zinc-50 transition-colors">
          Matches
        </Link>
        <span>/</span>
        <span className="text-zinc-100">
          {match.team.name} vs {match.opponent}
        </span>
      </div>
      <MatchDetail
        match={{
          id: match.id,
          teamId: match.teamId,
          teamName: match.team.name,
          opponent: match.opponent,
          startsAt: match.startsAt,
          homeAway: match.homeAway,
          matchType: match.matchType,
          gameFormat: match.gameFormat,
          squadSize: match.squadSize,
          matchRoundId: match.matchRoundId,
          matchRoundName: match.matchRound.name,
          matchRoundStatus: match.matchRound.status,
          matchFit: match.matchFit,
          notes: match.notes,
          matchStatus: match.status,
          cancelledAt: match.cancelledAt,
          cancelledReason: match.cancelledReason,
          postMatchStatus: postMatchReport?.status ?? undefined,
          selections: selectionData,
          warnings: warningData,
          coachingIntent: activeIntent?.category ?? undefined,
          coachingIntentId: matchIntent[0]?.id ?? undefined,
          inheritedIntentScope: activeIntent && activeIntent.scopeType !== "MATCH"
            ? (activeIntent.scopeType === "MATCH_ROUND" ? "round" : "league season")
            : undefined,
          phaseStartDate: match.matchRound.leagueSeason.startDate,
          phaseEndDate: match.matchRound.leagueSeason.endDate,
        }}
      />
    </div>
  );
}