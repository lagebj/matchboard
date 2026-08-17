import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { EventLiveMatchClient } from "@/components/live-match/event-live-match-client";

export const dynamic = "force-dynamic";

interface EventLiveMatchPageProps {
  params: Promise<{ orgSlug: string; eventId: string; eventMatchId: string }>;
}

export default async function EventLiveMatchPage({ params }: EventLiveMatchPageProps) {
  const { orgSlug, eventId, eventMatchId } = await params;
  const ctx = await requireActorContext(orgSlug);
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
        },
      },
      eventSquad: {
        select: {
          id: true,
          name: true,
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

  return (
    <EventLiveMatchClient
      eventMatchId={match.id}
      teamName={match.eventSquad?.name ?? "Squad"}
      opponentName={match.opponentName}
      eventName={match.event.name}
      matchDurationMinutes={match.event.matchDurationMinutes}
      eventId={eventId}
    />
  );
}