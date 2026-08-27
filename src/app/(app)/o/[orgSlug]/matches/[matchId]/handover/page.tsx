import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { CoachHandoverView } from "@/components/matches/coach-handover-view";
import { getActiveCoachingIntentForMatch } from "@/lib/coaching/coaching-intent";
import { getPlannedRotation } from "@/lib/planned-rotation/planned-rotation";

export const dynamic = "force-dynamic";

type HandoverPageProps = {
  params: Promise<{ orgSlug: string; matchId: string }>;
};

export default async function MatchHandoverPage({ params }: HandoverPageProps) {
  const { orgSlug, matchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const match = await db.match.findUnique({
    where: { id: matchId, ...orgWhere },
    select: {
      id: true,
      opponent: true,
      startsAt: true,
      homeAway: true,
      matchType: true,
      gameFormat: true,
      status: true,
      cancelledAt: true,
      cancelledReason: true,
      matchFit: true,
      notes: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      matchRoundId: true,
      matchRound: {
        select: {
          id: true,
          name: true,
          status: true,
          leagueSeasonId: true,
          leagueSeason: { select: { id: true, name: true } },
        },
      },
      opponentTeamId: true,
      opponentTeam: { select: { id: true, displayName: true } },
      selections: {
        where: { status: { in: ["DRAFT", "FINALIZED"] } },
        select: {
          id: true,
          playerId: true,
          role: true,
          status: true,
          overrideReason: true,
          matchdayResponsibility: true,
          explanation: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              coreTeamId: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }, { player: { lastName: "asc" } }],
      },
      helperAssignments: {
        select: {
          id: true,
          playerId: true,
          plannedRole: true,
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryPosition: true,
              coreTeam: { select: { id: true, name: true } },
            },
          },
        },
      },
      warnings: {
        select: { id: true, code: true, severity: true, message: true },
      },
    },
  });

  if (!match) notFound();

  const matchIntent = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: matchId, ...orgWhere },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  const intent = await getActiveCoachingIntentForMatch(matchId, ctx.orgFilter);

  const plannedRotation = await getPlannedRotation(matchId, match.teamId, ctx.orgFilter);

  const dateStr = match.startsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = match.startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <CoachHandoverView
      match={{
        id: match.id,
        opponent: match.opponent,
        startsAt: match.startsAt,
        matchDate: dateStr,
        matchTime: timeStr,
        homeAway: match.homeAway,
        matchType: match.matchType,
        gameFormat: match.gameFormat,
        status: match.status,
        cancelledAt: match.cancelledAt,
        cancelledReason: match.cancelledReason,
        matchFit: match.matchFit,
        notes: match.notes,
        teamName: match.team.name,
        roundName: match.matchRound.name,
        leagueSeasonName: match.matchRound.leagueSeason?.name ?? null,
        opponentTeamName: match.opponentTeam?.displayName ?? null,
        selections: match.selections.map((s) => ({
          id: s.id,
          playerId: s.playerId,
          role: s.role,
          status: s.status,
          overrideReason: s.overrideReason,
          matchdayResponsibility: s.matchdayResponsibility,
          explanation: s.explanation,
          playerFirstName: s.player.firstName,
          playerLastName: s.player.lastName ?? "",
          playerPosition: s.player.primaryPosition,
          coreTeamName: s.player.coreTeam?.name ?? null,
        })),
        helpers: match.helperAssignments.map((h) => ({
          id: h.id,
          playerId: h.playerId,
          plannedRole: h.plannedRole,
          playerFirstName: h.player.firstName,
          playerLastName: h.player.lastName ?? "",
          playerPosition: h.player.primaryPosition,
          coreTeamName: h.player.coreTeam?.name ?? null,
        })),
        coachingIntent: matchIntent[0]
          ? { id: matchIntent[0].id, category: matchIntent[0].category, note: matchIntent[0].note }
          : intent
            ? { id: intent.id, category: intent.category, note: intent.note }
            : null,
        warnings: match.warnings,
        plannedRotation: plannedRotation
          ? {
              id: plannedRotation.id,
              status: plannedRotation.status,
              changes: plannedRotation.changes.map((c) => ({
                id: c.id,
                sequence: c.sequence,
                outPlayerId: c.outPlayerId,
                inPlayerId: c.inPlayerId,
                outPosition: c.outPosition,
                inPosition: c.inPosition,
                positionOnly: c.positionOnly,
                approximateMatchSeconds: c.approximateMatchSeconds,
                status: c.status,
                outPlayerName: `${c.outPlayerFirstName ?? ""} ${c.outPlayerLastName ?? ""}`.trim(),
                inPlayerName: `${c.inPlayerFirstName ?? ""} ${c.inPlayerLastName ?? ""}`.trim(),
              })),
            }
          : null,
      }}
    />
  );
}