import Link from 'next/link';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { getEvents } from '@/app/(app)/events/actions';
import { formatKickoffTime } from '@/lib/date-utils';
import { EmptyState } from '@/components/ui/empty-state';
import { TouchlinePageHeader, TouchlineButton } from '@/components/touchline';
import { formatEventType } from "@/lib/formatters/event-labels";

type EventListItem = Awaited<ReturnType<typeof getEvents>>[number];

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Chronological month groups (bundle 07 §5): upcoming ascending, then past descending. */
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

/** One readiness / next-action line — never a row of equal-weight counters. */
function readinessLabel(event: EventListItem): string {
  if (event.status === 'FINALIZED') return 'Done';
  if (event.squads.length === 0) return 'No squads planned';
  if (event.squads.every((s) => s.status === 'LOCKED')) return 'Squads ready';
  return 'Draft squads';
}

function EventRow({ event, orgSlug }: { event: EventListItem; orgSlug: string }) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const dayLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timeRange = end
    ? `${formatKickoffTime(start)}–${formatKickoffTime(end)}`
    : formatKickoffTime(start);

  return (
    <Link
      href={`/o/${orgSlug}/events/${event.id}`}
      className="-mx-2 flex items-start gap-3 rounded-[var(--tl-c-radius-control)] px-2 py-3 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
    >
      <span className="w-[3.5rem] shrink-0 pt-0.5 text-[13px] font-medium tabular-nums text-[var(--text-muted)]">
        {dayLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-[600] text-[var(--foreground)]">{event.name}</p>
        <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">
          {formatEventType(event.eventType)} &middot; {timeRange}
        </p>
        <p className="mt-0.5 text-[13px] text-[var(--text-soft)]">{readinessLabel(event)}</p>
      </div>
    </Link>
  );
}

export const metadata = { title: 'Events' };

export default async function EventsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const events = await getEvents();

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
    // Touchline island (dark-pinned during the phased migration — ADR-0134).
    <div className="touchline flex flex-col gap-6" data-theme="dark">
      <TouchlinePageHeader
        title="Events"
        context="Cup, tournament and friendly-day squad planning."
        actions={
          <TouchlineButton as="a" href={`/o/${orgSlug}/events/new`} variant="primary">
            Create event
          </TouchlineButton>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create an event to start planning cups, tournaments and friendly days."
          illustration="emptyEvents"
          action={
            <TouchlineButton as="a" href={`/o/${orgSlug}/events/new`} variant="primary">
              Create event
            </TouchlineButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {upcomingGroups.map((group) => (
            <section key={`up-${group.month}`} className="flex flex-col">
              <h2 className="text-[13px] font-medium text-[var(--text-muted)]">{group.month}</h2>
              <div className="mt-1 divide-y divide-[var(--border-soft)]">
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} orgSlug={orgSlug} />
                ))}
              </div>
            </section>
          ))}

          {pastGroups.length > 0 && (
            <div className="flex flex-col gap-6 border-t border-[var(--border-soft)] pt-4">
              <p className="text-[13px] font-medium text-[var(--text-muted)]">Past events</p>
              {pastGroups.map((group) => (
                <section key={`past-${group.month}`} className="flex flex-col">
                  <h2 className="text-[13px] font-medium text-[var(--text-muted)]">{group.month}</h2>
                  <div className="mt-1 divide-y divide-[var(--border-soft)] opacity-80">
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
