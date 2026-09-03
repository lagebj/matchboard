import { db } from "@/lib/db";
import { requirePageActorContext, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { AuthorizationError } from "@/lib/auth";
import { FollowLiveClient } from "@/components/live-match/follow-live-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

interface FollowLivePageProps {
  params: Promise<{ orgSlug: string; matchId: string }>;
}

/**
 * Read-only "Follow live" viewer (ADR-0086 amendment, ADR-0112 consistency).
 * Server-side authorization here is the real boundary — `requireMatchGroupAccess()`
 * accepts GROUP_COACH or GROUP_VIEWER, matching exactly what
 * `/api/live-match/[matchId]/realtime-ticket`'s `mode: "view"` path requires.
 *
 * This page provides the FollowLiveClient with a baseline squad (including
 * startingOnField) so it can project on-field players from events, and the
 * match type so it can show the correct period config.
 */
export default async function FollowLivePage({ params }: FollowLivePageProps) {
  const { orgSlug, matchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
      select: {
        id: true,
        opponent: true,
        homeAway: true,
        gameFormat: true,
        type: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
  });

  if (!match) {
    return <div className="p-6 text-center text-zinc-400">Match not found.</div>;
  }

  try {
    await requireMatchGroupAccess(ctx, matchId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="p-6 text-center text-zinc-400">
          You do not have access to follow this match live.
        </div>
      );
    }
    throw error;
  }

  const session = await db.liveMatchSession.findUnique({
    where: { matchId, ...ctx.orgFilter.filter },
    select: { id: true, status: true },
  });

  if (!session || session.status !== "ACTIVE") {
    return (
      <div className="p-6 text-center text-zinc-400">
        This match is not being reported live right now.
      </div>
    );
  }

  // Build playerId → playerName map and baseline squad with startingOnField.
  // Uses the effective roster: normal squad + match helpers (ADR-0077) + match
  // absence tracking, matching the live reporting client's getPreMatchPackage.
  const [squadPlayers, helperAssignments, lineup, absences] = await Promise.all([
    db.selection.findMany({
      where: { matchId, match: { organisationId: ctx.organisationId } },
      select: {
        playerId: true,
        role: true,
        player: { select: { id: true, firstName: true, lastName: true, shirtNumber: true, primaryPosition: true } },
      },
    }),
    db.matchHelperAssignment.findMany({
      where: { matchId, match: { organisationId: ctx.organisationId } },
      select: {
        playerId: true,
        sourceTeam: { select: { name: true } },
        player: { select: { id: true, firstName: true, lastName: true, shirtNumber: true, primaryPosition: true } },
      },
    }),
    db.matchLineup.findFirst({
      where: { matchId, teamId: match.teamId, status: { in: ["CONFIRMED", "DRAFT"] } },
      select: {
        id: true,
        assignments: { select: { slotId: true, playerId: true } },
        formation: { select: { slots: { select: { id: true } } } },
      },
    }),
    db.matchReportAbsence.findMany({
      where: { matchId, organisationId: ctx.organisationId },
      select: { playerId: true },
    }),
  ]);

  const onFieldPlayerIds = new Set<string>();
  if (lineup?.formation) {
    for (const slot of lineup.formation.slots) {
      const assignment = lineup.assignments.find((a) => a.slotId === slot.id && a.playerId);
      if (assignment?.playerId) {
        onFieldPlayerIds.add(assignment.playerId);
      }
    }
  }

  const absentPlayerIds = new Set(absences.map((a) => a.playerId));

  const playerMap: Record<string, string> = {};
  const baselineSquad: { playerId: string; playerName: string; startingOnField: boolean; isActiveParticipant: boolean }[] = [];

  for (const s of squadPlayers) {
    const name = [s.player.firstName, s.player.lastName].filter(Boolean).join(" ");
    playerMap[s.player.id] = name;
    baselineSquad.push({
      playerId: s.player.id,
      playerName: name,
      startingOnField: onFieldPlayerIds.has(s.player.id),
      isActiveParticipant: !absentPlayerIds.has(s.player.id),
    });
  }

  for (const h of helperAssignments) {
    const name = [h.player.firstName, h.player.lastName].filter(Boolean).join(" ");
    playerMap[h.player.id] = name;
    baselineSquad.push({
      playerId: h.player.id,
      playerName: name,
      startingOnField: onFieldPlayerIds.has(h.player.id),
      isActiveParticipant: !absentPlayerIds.has(h.player.id),
    });
  }

  return (
    <FollowLiveClient
      matchId={match.id}
      teamName={match.team.name}
      opponentName={match.opponent}
      homeAway={match.homeAway}
      playerMap={playerMap}
      squad={baselineSquad}
      matchType={match.type}
    />
  );
}