import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";
import { TouchlineButton } from "@/components/touchline";
import type { EventsFeaturedEvent } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsNextEventHero (Matchboard Events Operating Surface bundle,
 * `03_ROUTE_COMPOSITION_AND_STATES.md` "Next Event hero"). The featured Event: kicker, name,
 * date, type, canonical readiness label, primary `Open event`, and secondary `Draft squads`/
 * `Setup matches` when the Event is not finalized. Never shows individual opponents or EventMatch
 * kickoff rows — those remain inside Event detail.
 */
export function EventsNextEventHero({
  orgSlug,
  event,
}: {
  orgSlug: string;
  event: EventsFeaturedEvent;
}) {
  const baseHref = `/o/${orgSlug}/events/${event.eventId}`;

  return (
    <div className="relative z-10 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
        Next event
      </p>
      <h2 className="text-[26px] font-[650] leading-tight text-[var(--foreground)]">
        {event.name}
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-soft)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {event.dateLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {event.eventTypeLabel} &middot; {event.readinessLabel}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2.5">
        <TouchlineButton as={Link} href={baseHref} variant="primary">
          Open event
        </TouchlineButton>
        {!event.finalized ? (
          <>
            <TouchlineButton as={Link} href={`${baseHref}?tab=squads`} variant="secondary">
              Draft squads
            </TouchlineButton>
            <TouchlineButton as={Link} href={`${baseHref}?tab=matches`} variant="secondary">
              Setup matches
            </TouchlineButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
