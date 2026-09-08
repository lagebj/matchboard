import Link from 'next/link';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { getEvents } from '@/app/(app)/events/actions';
import { formatKickoffTime } from '@/lib/date-utils';
import { EmptyState } from '@/components/ui/empty-state';
import { BrandedSurface } from '@/components/ui/branded-surface';
import { formatGameFormat } from "@/lib/formatters/game-format";
import { formatEventType } from "@/lib/formatters/event-labels";

type EventListItem = Awaited<ReturnType<typeof getEvents>>[number];

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Chronological month groups (ADR-0124 §13): upcoming ascending first, then past descending. */
function groupByMonth(events: EventListItem[]): Array<{ month: string; events: EventListItem[] }> {
  const groups: Array<{ month: string; events: EventListItem[] }> = [];
  for (const event of events) {
    const key = monthKey(new Date(event.startsAt));
    const last = groups[groups.length - 1];
    if (last && last.month === key) last.events.push(event);
    else groups.push({ month: key, events: [event] });
  }
  return groups;
}

function EventRow({ event, orgSlug }: { event: EventListItem; orgSlug: string }) {
  const available = event.players.filter((p) => p.status === 'AVAILABLE').length;
  const isDone = event.status === 'FINALIZED';
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  // Date is an orientation column, not a metadata chip buried in a card (05 §4).
  const dayLabel = start
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    .toUpperCase();
  const timeRange = end
    ? `${formatKickoffTime(start)}–${formatKickoffTime(end)}`
    : formatKickoffTime(start);
  const meta = [
    formatEventType(event.eventType),
    formatGameFormat(event.gameFormat),
    `${event.squads.length} squad${event.squads.length === 1 ? '' : 's'}`,
    `${available} available`,
  ].join(' · ');

  return (
    <Link
      href={`/o/${orgSlug}/events/${event.id}`}
      className="flex items-start gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3.5 py-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
    >
      <span className="w-[3.25rem] shrink-0 pt-0.5 text-[13px] font-medium tabular-nums text-[var(--text-muted)]">
        {dayLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="app-row-title truncate">{event.name}</p>
        <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{timeRange}</p>
        <p className="mt-0.5 text-[13px] text-[var(--text-muted)] truncate">{meta}</p>
      </div>
      {isDone && (
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Done
        </span>
      )}
    </Link>
  );
}

export const metadata = { title: 'Events' };

export default async function EventsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const events = await getEvents();

  // getEvents() returns newest-first. Present chronologically: upcoming ascending, then past
  // descending, each grouped by month (ADR-0124 §13).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = events
    .filter((e) => new Date(e.startsAt) >= startOfToday)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = events
    .filter((e) => new Date(e.startsAt) < startOfToday)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const upcomingGroups = groupByMonth(upcoming);
  const pastGroups = groupByMonth(past);

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
        <div className="flex flex-col gap-6">
          {upcomingGroups.map((group) => (
            <section key={`up-${group.month}`} className="flex flex-col gap-2">
              <h2 className="app-eyebrow">{group.month}</h2>
              <div className="flex flex-col gap-2">
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} orgSlug={orgSlug} />
                ))}
              </div>
            </section>
          ))}

          {pastGroups.length > 0 && (
            <div className="flex flex-col gap-6">
              <p className="app-eyebrow border-t border-[var(--border-soft)] pt-4 text-[var(--text-disabled)]">
                Past events
              </p>
              {pastGroups.map((group) => (
                <section key={`past-${group.month}`} className="flex flex-col gap-2">
                  <h2 className="app-eyebrow">{group.month}</h2>
                  <div className="flex flex-col gap-2 opacity-80">
                    {group.events.map((event) => (
                      <EventRow key={event.id} event={event} orgSlug={orgSlug} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}