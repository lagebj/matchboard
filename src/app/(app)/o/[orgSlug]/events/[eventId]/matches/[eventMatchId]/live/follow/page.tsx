import { db } from "@/lib/db";
import { requirePageActorContext, requireGroupAccessFromContext } from "@/lib/auth/actor-context";
import { AuthorizationError } from "@/lib/auth";
import { FollowLiveClient } from "@/components/live-match/follow-live-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getEventPeriodConfig, buildPeriodConfigFromFormat } from "@/lib/live-match/period-config";
import { getEffectiveEventSquadMatchTiming } from "@/lib/events/event-types";

export const dynamic = "force-dynamic";

interface EventFollowLivePageProps {
  params: Promise<{ orgSlug: string; eventId: string; eventMatchId: string }>;
}

/**
 * Read-only "Follow live" viewer for an Event match (ADR-0138 Bundle 8, closing work item 7 —
 * "Ensure Follow Live parity for League/Event"). Mirrors the League Follow Live page
 * (`matches/[matchId]/live/follow/page.tsx`) exactly at the same level of completeness (a
 * playerId-keyed baseline squad from the match's own squad/lineup — no GuestPlayer join, matching
 * League's own page, which also has none yet). Authorization is `requireGroupAccessFromContext`
 * on the Event's own `footballGroupId` — the same group-access model League's Follow Live
 * already established for this specific read-only capability, not a change to Event's existing
 * (org-level-only) mutation-authorization pattern elsewhere.
 */
export default async function EventFollowLivePage({ params }: EventFollowLivePageProps) {
  const { orgSlug, eventId, eventMatchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: { id: eventId, ...ctx.orgFilter.filter } },
    select: {
      id: true,
      opponentName: true,
      eventSquadId: true,
      event: {
        select: {
          id: true,
          name: true,
          footballGroupId: true,
          gameFormat: true,
          matchDurationMinutes: true,
          numberOfHalves: true,
          breakDurationMinutes: true,
        },
      },
      eventSquad: {
        select: {
          id: true,
          name: true,
          numberOfHalvesOverride: true,
          matchDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
        },
      },
    },
  });

  if (!match) {
    return <div className="p-6 text-center text-zinc-400">Event match not found.</div>;
  }

  try {
    requireGroupAccessFromContext(ctx, match.event.footballGroupId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="p-6 text-center text-zinc-400">
          You do not have access to follow this event match live.
        </div>
      );
    }
    throw error;
  }

  const session = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      status: true,
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

  const [squadPlayers, lineup] = await Promise.all([
    db.eventSquadPlayer.findMany({
      where: { eventSquadId: match.eventSquadId ?? "", eventId, organisationId: ctx.organisationId },
      select: {
        playerId: true,
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.eventMatchLineup.findFirst({
      where: { eventMatchId, organisationId: ctx.organisationId },
      select: {
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
  const baselineSquad: { playerId: string; playerName: string; startingOnField: boolean }[] = [];

  for (const s of squadPlayers) {
    if (!s.player) continue; // GuestPlayer-only rows have no `player` — excluded, matching Follow Live's League-parity scope (no GuestPlayer join yet, see doc comment above)
    const name = [s.player.firstName, s.player.lastName].filter(Boolean).join(" ");
    playerMap[s.player.id] = name;
    baselineSquad.push({
      playerId: s.player.id,
      playerName: name,
      startingOnField: onFieldPlayerIds.has(s.player.id),
    });
  }

  const timing = getEffectiveEventSquadMatchTiming(
    match.event,
    match.eventSquad ?? { numberOfHalvesOverride: null, matchDurationMinutesOverride: null, breakDurationMinutesOverride: null },
  );
  // ADR-0146: the frozen Live Reporting snapshot is authoritative when present, matching the
  // reporter's own client; otherwise falls back to the existing pre-live effective timing.
  const periodConfig =
    session.formatNumberOfPeriods != null && session.formatPeriodDurationMinutes != null && session.formatBreakDurationMinutes != null
      ? buildPeriodConfigFromFormat({
          numberOfPeriods: session.formatNumberOfPeriods,
          periodDurationMinutes: session.formatPeriodDurationMinutes,
          breakDurationMinutes: session.formatBreakDurationMinutes,
        })
      : getEventPeriodConfig(timing.matchDurationMinutes, timing.numberOfHalves, timing.breakDurationMinutes);

  return (
    <FollowLiveClient
      matchId={match.id}
      teamName={match.eventSquad?.name ?? "Squad"}
      opponentName={match.opponentName}
      homeAway="HOME"
      playerMap={playerMap}
      squad={baselineSquad}
      periodConfig={periodConfig}
      subjectType="EVENT"
    />
  );
}
