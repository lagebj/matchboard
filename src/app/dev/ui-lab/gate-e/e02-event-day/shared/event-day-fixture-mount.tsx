"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TabRail } from "@/components/ui/tab-rail";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { formatGameFormat } from "@/lib/formatters/game-format";
import type { E02EventDayFixture } from "./event-day-fixture-types";
import {
  buildEventDayProjection,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  formatOsloLongDate,
} from "./event-day-projection";
import { EventDayTimelineSection } from "./event-day-timeline-section";
import { SelectedMatchContext } from "./selected-match-context";
import { EventDayAside } from "./event-day-aside";

type TabKey = "overview" | "squads" | "pool" | "matches";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "squads", label: "Squads" },
  { key: "pool", label: "Player pool" },
  { key: "matches", label: "Matches" },
];

/**
 * Gate E W2 — E02 fixture-safe Event Detail mount. Reproduces only the parts of production's
 * `EventDetail` (`src/app/(app)/events/[eventId]/event-detail.tsx`) that E02 is about: the real
 * `TouchlinePageHeader` Event heading (same context-line format), the real finalised
 * `DecisionBanner`, the real `TabRail` with the same URL-backed `?tab=` authority, and the
 * Overview tab led by the Event-day progression. Every production mutation control (Finalize,
 * Generate squads, Fill remaining places, Clear, Delete, Export, halves/duration editors) is a
 * Server Action or a download and is deliberately NOT rendered — UI Lab must never invoke a
 * real Server Action from synthetic data. Squads/Player pool/Matches tab bodies are production
 * administration outside E02 and are not reproduced.
 *
 * The `match` query value is a DIRECTIONAL, UI-Lab-only selection parameter (production has no
 * per-match selection). It is URL-backed so direct load and browser Back restore it, and every
 * other query value (`tab`, `theme`) is preserved when it changes.
 */
export function EventDayFixtureMount({ fixture, orgSlug = "acme" }: { fixture: E02EventDayFixture; orgSlug?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedMatchId = searchParams.get("match");
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "overview";

  const { event, squads, matches, now } = fixture;
  const projection = buildEventDayProjection({ event, squads, matches, now, selectedMatchId });

  const hrefWith = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const selectHref = useCallback((matchId: string) => hrefWith({ match: matchId }), [hrefWith]);
  const clearSelection = useCallback(() => router.push(hrefWith({ match: null }), { scroll: false }), [hrefWith, router]);

  // Focus management: a new selection moves focus to the selected-match context; clearing it
  // (button or browser Back) returns focus to that same match's row. Skipped on first render so
  // a directly-loaded URL does not steal focus.
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Browser tests wait on this marker so client-side interactions (focus moves, history) are
  // asserted against the hydrated component, not the server-rendered HTML.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const previousSelection = useRef<string | null | undefined>(undefined);
  const resolvedSelection = projection.selected?.match.id ?? null;
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = resolvedSelection;
    if (previous === undefined || previous === resolvedSelection) return;
    if (resolvedSelection) {
      headingRef.current?.focus();
    } else if (previous) {
      // `previous` is always a resolved fixture match id (never the raw URL value), so it is
      // safe inside this attribute selector.
      document.querySelector<HTMLElement>(`[data-e02-match-row="${previous}"] a`)?.focus();
    }
  }, [resolvedSelection]);

  const context = `${EVENT_TYPE_LABELS[event.eventType]} · ${formatGameFormat(event.gameFormat)} · ${formatOsloLongDate(event.startsAt)} · ${EVENT_STATUS_LABELS[event.status]}`;

  return (
    <div
      className="touchline flex min-w-0 flex-col gap-6"
      data-ui-lab-ready="true"
      data-e02-event-id={event.id}
      data-e02-hydrated={hydrated ? "true" : "false"}
    >
      <TouchlinePageHeader
        title={event.name}
        context={context}
        actions={
          <TouchlineButton as="a" href="/events" variant="ghost">
            Back
          </TouchlineButton>
        }
      />

      {event.status === "FINALIZED" ? (
        <DecisionBanner
          variant="note"
          title="Event is finalised"
          description={`This event is finalised and locked for changes.${event.finalizedAt ? ` Finalised on ${formatOsloLongDate(event.finalizedAt)}.` : ""} Finalisation locks the event; each match keeps its own report state below.`}
        />
      ) : null}

      <TabRail
        items={TABS}
        activeKey={activeTab}
        onSelect={(key) => router.push(hrefWith({ tab: key === "overview" ? null : key }), { scroll: false })}
        variant="pill"
        ariaLabel="Event sections"
      />

      {activeTab === "overview" ? (
        <div className="flex min-w-0 flex-col gap-6 large:grid large:grid-cols-[minmax(0,1fr)_24rem] large:items-start large:gap-8">
          <EventDayTimelineSection projection={projection} selectHref={selectHref} />
          <div className="flex min-w-0 flex-col gap-6 large:sticky large:top-4">
            {projection.selected ? (
              <SelectedMatchContext
                ref={headingRef}
                event={event}
                item={projection.selected}
                orgSlug={orgSlug}
                onClose={clearSelection}
              />
            ) : projection.rejectedSelectionId ? (
              <div role="status" className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] px-4 py-3 text-[13px] text-[var(--text-soft)]">
                <p>
                  No match with id <span className="font-mono">{projection.rejectedSelectionId}</span> belongs to {event.name}.
                  The event day is shown without a selected match.
                </p>
                <div className="mt-2">
                  <TouchlineButton type="button" variant="secondary" size="sm" onClick={clearSelection}>
                    Back to event day
                  </TouchlineButton>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">
                Select a match to see its squad, report state and live-reporting entry.
              </p>
            )}
            <EventDayAside event={event} projection={projection} />
          </div>
        </div>
      ) : (
        <div role="status" className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] px-4 py-3 text-[13px] text-[var(--text-soft)]">
          The {TABS.find((t) => t.key === activeTab)?.label} tab is production Event administration and is not reproduced in
          this E02 candidate. The event heading above is unchanged.
        </div>
      )}
    </div>
  );
}
