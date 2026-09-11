/**
 * Events list & Event detail presentation view models (Touchline Design Atlas,
 * `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §A-B`).
 *
 * Sources:
 * - events        -> EXISTING_DIRECT (getEvents()/getEventById(), src/app/(app)/events/actions.ts)
 * - squadReadiness -> EXISTING_DIRECT (computeSquadBalance()/EventSquad.targetSize, src/lib/events/event-balance.ts)
 * - eventMatches   -> EXISTING_DIRECT (EventMatchWithReport, src/app/(app)/events/[eventId]/event-matches-tab.tsx)
 * - helpers        -> EXISTING_QUERYABLE (getSupportCandidatesForEventMatch()/checkSupportConflicts(), src/lib/events/event-match-support.ts)
 * Derived:
 * - nextEvent selection -> DERIVED_PRESENTATION (earliest upcoming, non-finalized event)
 * - readinessLabel      -> DERIVED_PRESENTATION (existing rule from events/page.tsx, reused verbatim, not re-invented)
 *
 * No real map widget (venue text only — provenance §0.4). Event-day timeline uses only real
 * EventMatch rows, never fictional meeting/warm-up/lunch entries (provenance §0.13).
 */

export type EventReadinessLabel = "Done" | "No squads planned" | "Squads ready" | "Draft squads";

export interface EventListRowInput {
  eventId: string;
  name: string;
  startsAt: string;
  opponentSummary: string | null;
  readiness: EventReadinessLabel;
  isFinalized: boolean;
}

export interface EventListViewModel {
  nextEvent: EventListRowInput | null;
  upcoming: EventListRowInput[];
  past: EventListRowInput[];
}

export function buildEventListViewModel(events: EventListRowInput[], nowIso: string): EventListViewModel {
  const now = new Date(nowIso).getTime();
  const upcoming: EventListRowInput[] = [];
  const past: EventListRowInput[] = [];

  for (const e of events) {
    if (new Date(e.startsAt).getTime() >= now) upcoming.push(e);
    else past.push(e);
  }
  upcoming.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  past.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const nextEvent = upcoming.find((e) => !e.isFinalized) ?? upcoming[0] ?? null;
  const restUpcoming = nextEvent ? upcoming.filter((e) => e.eventId !== nextEvent.eventId) : upcoming;

  return { nextEvent, upcoming: restUpcoming, past };
}

export interface EventSquadReadinessInput {
  squadId: string;
  squadName: string;
  currentCount: number;
  targetSize: number;
  hasGoalkeeper: boolean;
  missingCount: number;
}

export interface EventMatchTimelineEntryInput {
  eventMatchId: string;
  startsAt: string;
  opponentName: string;
  status: string;
  isLive: boolean;
  href: string;
}

export interface EventHelperInput {
  playerName: string;
  targetMatchLabel: string;
  confirmed: boolean;
}

export interface EventDetailViewModelInput {
  eventId: string;
  name: string;
  venue: string | null;
  gameFormat: string;
  nextMatch: EventMatchTimelineEntryInput | null;
  timeline: EventMatchTimelineEntryInput[];
  squadReadiness: EventSquadReadinessInput[];
  helpers: EventHelperInput[];
}

export interface EventDetailViewModel extends EventDetailViewModelInput {
  helpersConfirmedCount: number;
  helpersTotalCount: number;
}

export function buildEventDetailViewModel(input: EventDetailViewModelInput): EventDetailViewModel {
  return {
    ...input,
    helpersConfirmedCount: input.helpers.filter((h) => h.confirmed).length,
    helpersTotalCount: input.helpers.length,
  };
}
