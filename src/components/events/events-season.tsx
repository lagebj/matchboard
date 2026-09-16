import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import type { EventSeasonRow } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsSeason (Matchboard Events Operating Surface bundle,
 * `06_EVENT_SEASON_SINGLE_RAIL_CONTRACT.md`). Exactly one timeline rail: one marker column owns
 * both the dots and the connector — never a second rail beside the date/name column. The
 * connector is one continuous element (`data-testid="events-season-connector"`) passing through
 * the vertical centre of every marker, not a per-row line fragment.
 */
export function EventsSeason({
  orgSlug,
  rows,
}: {
  orgSlug: string;
  rows: EventSeasonRow[];
}) {
  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Event Season" description="Past and upcoming events this season." />
      {rows.length === 0 ? (
        <p className="text-[13px] text-[var(--text-soft)]">No events yet.</p>
      ) : (
        <div className="relative flex flex-col">
          {rows.length > 1 ? (
            <span
              data-testid="events-season-connector"
              aria-hidden="true"
              className="absolute left-[8.5rem] top-[1.4rem] bottom-[1.4rem] w-px bg-[var(--border-soft)]"
            />
          ) : null}
          {rows.map((row) => (
            <EventSeasonListRow key={row.eventId} orgSlug={orgSlug} row={row} />
          ))}
        </div>
      )}
    </Surface>
  );
}

function EventSeasonListRow({ orgSlug, row }: { orgSlug: string; row: EventSeasonRow }) {
  const href = `/o/${orgSlug}/events/${row.eventId}`;
  const markerClass = row.isFeatured
    ? "h-3 w-3 bg-[var(--accent)] ring-4 ring-[var(--accent-subtle)]"
    : row.isPast
      ? "h-2 w-2 bg-[var(--border-strong)]"
      : "h-2.5 w-2.5 border-2 border-[var(--accent)] bg-[var(--tl-c-canvas)]";

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="w-[6rem] shrink-0 text-[12px] text-[var(--text-muted)]">{row.monthLabel}</span>
      <span className="relative z-10 flex w-6 shrink-0 justify-center">
        <span className={cn("rounded-full", markerClass)} aria-hidden="true" />
      </span>
      <span className="w-[3.5rem] shrink-0 text-[13px] tabular-nums text-[var(--text-soft)]">
        {row.dayLabel}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-[600] text-[var(--foreground)]">
        {row.name}
      </span>
      <span className="hidden shrink-0 text-[12px] text-[var(--text-muted)] sm:inline">
        {row.readinessLabel}
      </span>
      <Link
        href={href}
        className="shrink-0 text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
      >
        {row.actionLabel} <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );
}
