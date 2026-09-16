/**
 * Events operating-surface presentation view model (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md`, `06_EVENT_SEASON_SINGLE_RAIL_CONTRACT.md`).
 *
 * Pure, DB-free, React-free. Consumes `EventsOverviewEventRow[]`
 * (`src/lib/events/get-events-overview.ts`) and decides:
 *
 * - the featured (next) Event, reusing `buildEventListViewModel()`'s exact selection semantics
 *   (earliest upcoming non-finalized Event; earliest upcoming Event if every upcoming Event is
 *   finalized; `null` when there is no upcoming Event);
 * - factual Event readiness counts (squads drafted/locked, configured EventMatches, helper
 *   assignment count, guest-player count) — no invented percentages, denominators, or
 *   "confirmed" semantics;
 * - Participating-squads presentation (factual count/status only — never inferred colour, never
 *   a generated age label, `Ready` only from canonical `LOCKED` status);
 * - a conservative, capped (4) Needs-attention list from explicit event-level facts — never the
 *   post-event finalization validator (`event-finalization-validation.ts` is a different,
 *   unrelated engine and is deliberately not imported here);
 * - Event facts (Type/Date/Participating squads/Configured matches only — no Location, no
 *   canonical Event-level venue field exists);
 * - Event Season row ordering (featured first, then remaining upcoming ascending, then past
 *   descending) for the single-rail Event Season list.
 *
 * Dates are formatted against `MATCHBOARD_DISPLAY_TIMEZONE` (ADR-0137) because the Events page is
 * a Server Component and cannot rely on the browser's local timezone the way a Client Component
 * can.
 */

import { MATCHBOARD_DISPLAY_TIMEZONE } from "@/lib/date-utils";
import { formatEventType } from "@/lib/formatters/event-labels";
import {
  readinessLabel as canonicalReadinessLabel,
  type EventListRowSource,
} from "@/lib/events/event-list-presentation";
import type { EventReadinessLabel } from "@/lib/touchline/presentation/event-view-model";
import type {
  EventsOverviewEventRow,
  EventsOverviewSquadRow,
} from "@/lib/events/get-events-overview";

export type { EventReadinessLabel };

/* ------------------------------------------------------------------------------------------ */
/* Attention                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export type EventOverviewAttentionTarget = "squads" | "pool" | "matches";

export type EventOverviewAttentionItem = {
  id: string;
  title: string;
  description: string;
  target: EventOverviewAttentionTarget;
};

export const EVENTS_ATTENTION_MAX = 4;

/* ------------------------------------------------------------------------------------------ */
/* Participating squads                                                                          */
/* ------------------------------------------------------------------------------------------ */

export type EventOverviewSquadRow = {
  squadId: string;
  name: string;
  status: string;
  playerCount: number;
  targetSize: number;
  missingCount: number;
  /** `Ready` label is shown only when `status === "LOCKED"` — never inferred otherwise. */
  isReady: boolean;
};

/* ------------------------------------------------------------------------------------------ */
/* Featured Event                                                                                */
/* ------------------------------------------------------------------------------------------ */

export type EventsFeaturedEvent = {
  eventId: string;
  name: string;
  eventTypeLabel: string;
  startsAt: string;
  dateLabel: string;
  readinessLabel: EventReadinessLabel;
  finalized: boolean;

  readiness: {
    totalSquads: number;
    populatedSquads: number;
    lockedSquads: number;
    configuredMatchCount: number;
    helperAssignmentCount: number;
    guestPlayerCount: number;
  };

  squads: EventOverviewSquadRow[];

  /** Full conservative attention list (priority-ordered, deterministic). Components own showing
   * only the first `EVENTS_ATTENTION_MAX` by default and disclosing the rest locally — the view
   * model does not decide what is "hidden", only what is real. */
  attention: EventOverviewAttentionItem[];

  facts: {
    typeLabel: string;
    dateLabel: string;
    participatingSquadsCount: number;
    configuredMatchCount: number;
  };
};

/* ------------------------------------------------------------------------------------------ */
/* Event Season                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export type EventSeasonRow = {
  eventId: string;
  name: string;
  startsAt: string;
  monthLabel: string;
  dayLabel: string;
  readinessLabel: EventReadinessLabel;
  actionLabel: "Open" | "View";
  isFeatured: boolean;
  isPast: boolean;
};

/* ------------------------------------------------------------------------------------------ */
/* Top-level view model                                                                          */
/* ------------------------------------------------------------------------------------------ */

export type EventsOperatingViewModel = {
  featuredEvent: EventsFeaturedEvent | null;
  eventSeason: EventSeasonRow[];
  hasAnyEvents: boolean;
  hasUpcomingEvents: boolean;
};

/* ------------------------------------------------------------------------------------------ */
/* Formatting                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function formatHeroDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
  }).format(date);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
  }).format(date);
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
  }).format(date);
}

/* ------------------------------------------------------------------------------------------ */
/* Featured Event selection (matches buildEventListViewModel()'s exact rule)                     */
/* ------------------------------------------------------------------------------------------ */

function toListRowSource(event: EventsOverviewEventRow): EventListRowSource {
  return {
    id: event.id,
    name: event.name,
    startsAt: event.startsAt,
    status: event.status,
    squads: event.squads.map((s) => ({ status: s.status })),
  };
}

function selectFeaturedEvent(
  events: EventsOverviewEventRow[],
  now: Date,
): EventsOverviewEventRow | null {
  const upcoming = events
    .filter((e) => e.startsAt.getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (upcoming.length === 0) return null;
  return upcoming.find((e) => e.status !== "FINALIZED") ?? upcoming[0];
}

/* ------------------------------------------------------------------------------------------ */
/* Readiness / squads / attention / facts for the featured Event                                 */
/* ------------------------------------------------------------------------------------------ */

function buildSquadRows(squads: EventsOverviewSquadRow[]): EventOverviewSquadRow[] {
  return squads.map((s) => ({
    squadId: s.id,
    name: s.name,
    status: s.status,
    playerCount: s.players.length,
    targetSize: s.targetSize,
    missingCount: Math.max(0, s.targetSize - s.players.length),
    isReady: s.status === "LOCKED",
  }));
}

function buildAttentionItems(event: EventsOverviewEventRow): EventOverviewAttentionItem[] {
  const items: EventOverviewAttentionItem[] = [];
  const squads = event.squads;

  if (squads.length === 0) {
    items.push({
      id: "no-squads",
      title: "No squads planned",
      description: "Create or configure squads before the event.",
      target: "squads",
    });
  } else {
    // Priority 2: empty squads (in canonical squad order — deterministic).
    for (const s of squads) {
      if (s.players.length === 0) {
        items.push({
          id: `empty-${s.id}`,
          title: `${s.name} has no players`,
          description: "Add players or generate squads.",
          target: "squads",
        });
      }
    }

    // Priority 3/4: below-minimum outranks below-target for the same squad (never both).
    for (const s of squads) {
      if (s.players.length === 0) continue;
      if (s.minSize != null && s.players.length < s.minSize) {
        items.push({
          id: `below-min-${s.id}`,
          title: `${s.name} is below minimum`,
          description: `${s.players.length} selected; minimum is ${s.minSize}.`,
          target: "squads",
        });
      } else if (s.players.length < s.targetSize) {
        const needed = s.targetSize - s.players.length;
        items.push({
          id: `below-target-${s.id}`,
          title: `${s.name} still needs ${needed} player(s)`,
          description: `${s.players.length} selected; target is ${s.targetSize}.`,
          target: "squads",
        });
      }
    }
  }

  // Priority 5: assigned Event player currently unavailable/withdrawn — one aggregate item.
  const unavailableCount = event.players.filter(
    (p) => p.status === "UNAVAILABLE" || p.status === "WITHDRAWN",
  ).length;
  if (unavailableCount > 0) {
    items.push({
      id: "unavailable",
      title: `${unavailableCount} assigned player(s) unavailable`,
      description: "Review the Event player pool and squads.",
      target: "pool",
    });
  }

  // Priority 6: no active EventMatches configured.
  const configuredMatchCount = event.eventMatches.filter((m) => m.status !== "CANCELLED").length;
  if (configuredMatchCount === 0) {
    items.push({
      id: "no-matches",
      title: "Match setup not started",
      description: "No Event matches are configured yet.",
      target: "matches",
    });
  }

  return items;
}

function buildFeaturedEvent(event: EventsOverviewEventRow): EventsFeaturedEvent {
  const totalSquads = event.squads.length;
  const populatedSquads = event.squads.filter((s) => s.players.length > 0).length;
  const lockedSquads = event.squads.filter((s) => s.status === "LOCKED").length;
  const configuredMatchCount = event.eventMatches.filter((m) => m.status !== "CANCELLED").length;
  const helperAssignmentCount = event.eventMatches.reduce(
    (sum, m) => sum + m.supportAssignments.length,
    0,
  );
  const guestPlayerCount = event.players.filter(
    (p) => p.guestPlayerId != null && p.status !== "WITHDRAWN",
  ).length;

  const finalized = event.status === "FINALIZED";
  const attention = finalized ? [] : buildAttentionItems(event);

  const eventTypeLabel = formatEventType(event.eventType);
  const dateLabel = formatHeroDateLabel(event.startsAt);

  return {
    eventId: event.id,
    name: event.name,
    eventTypeLabel,
    startsAt: event.startsAt.toISOString(),
    dateLabel,
    readinessLabel: canonicalReadinessLabel(toListRowSource(event)),
    finalized,
    readiness: {
      totalSquads,
      populatedSquads,
      lockedSquads,
      configuredMatchCount,
      helperAssignmentCount,
      guestPlayerCount,
    },
    squads: buildSquadRows(event.squads),
    attention,
    facts: {
      typeLabel: eventTypeLabel,
      dateLabel,
      participatingSquadsCount: totalSquads,
      configuredMatchCount,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Event Season row ordering (06 "Row ordering" — one rail, featured first, then upcoming        */
/* ascending, then past descending)                                                              */
/* ------------------------------------------------------------------------------------------ */

function buildEventSeason(
  events: EventsOverviewEventRow[],
  featuredEventId: string | null,
  now: Date,
): EventSeasonRow[] {
  const upcoming = events
    .filter((e) => e.startsAt.getTime() >= now.getTime() && e.id !== featuredEventId)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = events
    .filter((e) => e.startsAt.getTime() < now.getTime())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const featured = featuredEventId ? events.find((e) => e.id === featuredEventId) ?? null : null;

  const ordered = [...(featured ? [featured] : []), ...upcoming, ...past];

  return ordered.map((event) => {
    const isPast = event.startsAt.getTime() < now.getTime();
    return {
      eventId: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      monthLabel: formatMonthLabel(event.startsAt),
      dayLabel: formatDayLabel(event.startsAt),
      readinessLabel: canonicalReadinessLabel(toListRowSource(event)),
      actionLabel: isPast ? "View" : "Open",
      isFeatured: event.id === featuredEventId,
      isPast,
    };
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Entry point                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function buildEventsOperatingViewModel(
  events: EventsOverviewEventRow[],
  nowIso: string,
): EventsOperatingViewModel {
  const now = new Date(nowIso);
  const featured = selectFeaturedEvent(events, now);
  const hasUpcomingEvents = events.some((e) => e.startsAt.getTime() >= now.getTime());

  return {
    featuredEvent: featured ? buildFeaturedEvent(featured) : null,
    eventSeason: buildEventSeason(events, featured?.id ?? null, now),
    hasAnyEvents: events.length > 0,
    hasUpcomingEvents,
  };
}
