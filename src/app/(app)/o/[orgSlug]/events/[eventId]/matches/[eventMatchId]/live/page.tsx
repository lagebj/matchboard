import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { EventLiveMatchClient } from "@/components/live-match/event-live-match-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getEffectiveEventSquadMatchTiming } from "@/lib/events/event-types";

export const dynamic = "force-dynamic";

interface EventLiveMatchPageProps {
  params: Promise<{ orgSlug: string; eventId: string; eventMatchId: string }>;
}

export default async function EventLiveMatchPage({ params }: EventLiveMatchPageProps) {
  const { orgSlug, eventId, eventMatchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgWhere },
    select: {
      id: true,
      opponentName: true,
      category: true,
      startsAt: true,
      status: true,
      eventSquadId: true,
      event: {
        select: {
          id: true,
          name: true,
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

  if (match.status === "CANCELLED") {
    return <div className="p-6 text-center text-zinc-400">This match has been cancelled.</div>;
  }

  const timing = getEffectiveEventSquadMatchTiming(match.event, match.eventSquad ?? {
    numberOfHalvesOverride: null,
    matchDurationMinutesOverride: null,
    breakDurationMinutesOverride: null,
  });

  return (
    <EventLiveMatchClient
      eventMatchId={match.id}
      teamName={match.eventSquad?.name ?? "Squad"}
      opponentName={match.opponentName}
      eventName={match.event.name}
      matchDurationMinutes={timing.matchDurationMinutes}
      numberOfHalves={timing.numberOfHalves}
      breakDurationMinutes={timing.breakDurationMinutes}
      eventId={eventId}
    />
  );
}