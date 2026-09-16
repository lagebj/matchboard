import Link from "next/link";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { EmptyState } from "@/components/ui/empty-state";
import { EventsAtmosphere } from "@/components/events/events-atmosphere";
import { EventsNextEventHero } from "@/components/events/events-next-event-hero";
import { EventsReadiness } from "@/components/events/events-readiness";
import { EventsAttention } from "@/components/events/events-attention";
import { EventsParticipatingSquads } from "@/components/events/events-participating-squads";
import { EventsFacts } from "@/components/events/events-facts";
import { EventsSeason } from "@/components/events/events-season";
import type { EventsOperatingViewModel } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsOperatingSurface — the sole production composition owner for the Events route
 * (Matchboard Events Operating Surface bundle, `03_ROUTE_COMPOSITION_AND_STATES.md`,
 * `01_GOLDEN_REFERENCE_CONTRACT.md`). Renders exactly what `buildEventsOperatingViewModel()`
 * resolved — no domain computation lives here.
 *
 * Desktop composition: header -> Next Event hero (atmosphere behind it) -> 8/12 operational
 * column (Event readiness, Needs attention) + 4/12 context column (Participating squads, Event
 * facts) -> full-width Event Season below. Individual Event matches/opponents never render here
 * — that boundary is owned by Event detail.
 */
export function EventsOperatingSurface({
  orgSlug,
  viewModel,
}: {
  orgSlug: string;
  viewModel: EventsOperatingViewModel;
}) {
  const { featuredEvent, eventSeason, hasAnyEvents, hasUpcomingEvents } = viewModel;

  return (
    <div className="touchline relative isolate min-w-0 flex flex-col gap-6">
      <EventsAtmosphere />
      <div className="relative z-10 flex flex-col gap-6">
        <TouchlinePageHeader
          title="Events"
          context="Cup, tournament and friendly-day planning."
          actions={
            <TouchlineButton as={Link} href={`/o/${orgSlug}/events/new`} variant="primary">
              Create event
            </TouchlineButton>
          }
        />

        {!hasAnyEvents ? (
          <EmptyState
            title="No events yet"
            description="Create an event to start planning cups, tournaments and friendly days."
            illustration="emptyEvents"
            action={
              <TouchlineButton as={Link} href={`/o/${orgSlug}/events/new`} variant="primary">
                Create event
              </TouchlineButton>
            }
          />
        ) : null}

        {hasAnyEvents && !hasUpcomingEvents ? (
          <EmptyState
            tone="info"
            title="No upcoming events"
            description="Every planned event has already happened. Create a new event to plan the next one."
          />
        ) : null}

        {featuredEvent ? (
          <>
            <EventsNextEventHero orgSlug={orgSlug} event={featuredEvent} />

            <div className="grid grid-cols-1 gap-5 expanded:grid-cols-12">
              <div className="flex flex-col gap-5 expanded:col-span-8">
                <EventsReadiness orgSlug={orgSlug} event={featuredEvent} />
                <EventsAttention orgSlug={orgSlug} event={featuredEvent} />
              </div>
              <div className="flex flex-col gap-5 expanded:col-span-4">
                <EventsParticipatingSquads orgSlug={orgSlug} event={featuredEvent} />
                <EventsFacts event={featuredEvent} />
              </div>
            </div>
          </>
        ) : null}

        {hasAnyEvents ? <EventsSeason orgSlug={orgSlug} rows={eventSeason} /> : null}
      </div>
    </div>
  );
}
