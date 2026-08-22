import Link from 'next/link';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { getEvents } from '@/app/(app)/events/actions';
import { EmptyState } from '@/components/ui/empty-state';
import { BrandedSurface } from '@/components/ui/branded-surface';

import { formatGameFormat } from "@/lib/formatters/game-format";

export const metadata = { title: 'Events' };

export default async function EventsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const events = await getEvents();

  return (
    <div className="space-y-6">
      <BrandedSurface
        illustration={{ name: 'eventHeaderSketch' }}
        variant="compact"
        className="px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Events</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Cup, tournament, and friendly day squad planning
            </p>
          </div>
          <Link
            href={`/o/${orgSlug}/events/new`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create event
          </Link>
        </div>
      </BrandedSurface>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create an event to start planning cups, tournaments, and friendly days."
          illustration="emptyEvents"
          action={
            <Link
              href={`/o/${orgSlug}/events/new`}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create event
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const totalSquadPlayers = event.squads.reduce(
              (sum, s) => sum + s.players.length,
              0,
            );

            return (
              <Link
                key={event.id}
                href={`/o/${orgSlug}/events/${event.id}`}
                className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">{event.name}</h2>
                    <div className="flex gap-3 mt-1 text-sm text-[var(--text-muted)]">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {event.eventType}
                      </span>
                      <span>
                        {new Date(event.startsAt).toLocaleDateString()}
                      </span>
                      <span>
                        {formatGameFormat(event.gameFormat)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-[var(--text-muted)]">
                    <div>{event.squads.length} squad{event.squads.length !== 1 ? 's' : ''}</div>
                    <div>{event.players.filter((p) => p.status === 'AVAILABLE').length} available player{event.players.filter((p) => p.status === 'AVAILABLE').length !== 1 ? 's' : ''}</div>
                    {totalSquadPlayers > 0 && (
                      <div>{totalSquadPlayers} assigned</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}