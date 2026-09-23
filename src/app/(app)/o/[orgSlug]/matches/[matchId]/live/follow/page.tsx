import { db } from "@/lib/db";
import { requirePageActorContext, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { AuthorizationError } from "@/lib/auth";
import { FollowLiveClient } from "@/components/live-match/follow-live-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getLeagueMatchPeriodConfig } from "@/lib/live-match/period-config";
import { getEffectiveLeagueMatchRoster } from "@/lib/matches/match-helper-eligibility";

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
 * ADR-0151: Now uses the canonical effective roster resolver, which includes
 * match-day additions, absences, and guests in addition to selections and helpers.
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
      matchType: true,
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
    select: {
      id: true,
      status: true,
      startedAt: true,
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return (
      <div className="p-6 text-center text-zinc-400">
        This match is not being reported live right now.
      </div>
    );
  }

  // ADR-0146: the frozen format snapshot drives the same period config the reporter's own client
  // uses, instead of always falling back to the hardcoded legacy config.
  const periodConfig = getLeagueMatchPeriodConfig(
    match.matchType,
    session.formatNumberOfPeriods != null && session.formatPeriodDurationMinutes != null && session.formatBreakDurationMinutes != null
      ? {
          numberOfPeriods: session.formatNumberOfPeriods,
          periodDurationMinutes: session.formatPeriodDurationMinutes,
          breakDurationMinutes: session.formatBreakDurationMinutes,
        }
      : null,
  );

  // ADR-0151: Use the canonical effective roster resolver, which includes match-day
  // additions, absences, and guests — not an inline assembly.
  const [effectiveRoster, lineup] = await Promise.all([
    getEffectiveLeagueMatchRoster(matchId, ctx.orgFilter),
    db.matchLineup.findFirst({
      where: { matchId, teamId: match.teamId, status: { in: ["CONFIRMED", "DRAFT"] } },
      select: {
        id: true,
        assignments: { select: { slotId: true, playerId: true } },
        formation: { select: { slots: { select: { id: true } } } },
      },
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

  const playerMap: Record<string, string> = {};
  const baselineSquad: { playerId: string; playerName: string; startingOnField: boolean; isActiveParticipant: boolean }[] = [];

  for (const entry of effectiveRoster) {
    const name = entry.displayName;
    if (entry.playerId) {
      playerMap[entry.playerId] = name;
    }
    baselineSquad.push({
      playerId: entry.participantId,
      playerName: name,
      startingOnField: entry.playerId ? onFieldPlayerIds.has(entry.playerId) : false,
      isActiveParticipant: entry.isActiveParticipant,
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
      matchType={match.matchType}
      periodConfig={periodConfig}
      liveReportingStartedAt={session.startedAt.toISOString()}
      sessionFormat={
        session.formatNumberOfPeriods != null && session.formatPeriodDurationMinutes != null && session.formatBreakDurationMinutes != null
          ? {
              numberOfPeriods: session.formatNumberOfPeriods,
              periodDurationMinutes: session.formatPeriodDurationMinutes,
              breakDurationMinutes: session.formatBreakDurationMinutes,
            }
          : null
      }
    />
  );
}