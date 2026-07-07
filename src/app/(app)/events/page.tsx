import Link from 'next/link';
import { getEvents } from './actions';

export const metadata = { title: 'Events' };

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cup, tournament, and friendly day squad planning
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No events yet. Create an event to start planning.</p>
          <Link
            href="/events/new"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create event
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const totalSquadPlayers = event.squads.reduce(
              (sum, s) => sum + s.players.length,
              0,
            );
            const availableCount = event.players.filter(
              (p) => p.status === 'AVAILABLE',
            ).length;

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">{event.name}</h2>
                    <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {event.eventType}
                      </span>
                      <span>
                        {new Date(event.startsAt).toLocaleDateString()}
                      </span>
                      <span>
                        {event.gameFormat.replace('_', '-')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{event.squads.length} squad{event.squads.length !== 1 ? 's' : ''}</div>
                    <div>{availableCount} available player{availableCount !== 1 ? 's' : ''}</div>
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