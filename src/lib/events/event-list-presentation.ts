/**
 * Pure adapter: real `getEvents()` rows -> `EventListRowInput`
 * (`src/lib/touchline/presentation/event-view-model.ts`, Touchline Design Atlas ADR-0136).
 *
 * Kept separate from `src/app/(app)/o/[orgSlug]/events/page.tsx` (an async Server Component) so
 * this mapping is directly unit-testable without rendering a Server Component — the same pattern
 * `src/lib/matches/today-match-presentation.ts` established for Today's own Phase 4 migration.
 *
 * `opponentSummary` is always null: `getEvents()` does not load per-event match/opponent rows,
 * and adding that would mean a new per-event query for the Events list — a deliberate, disclosed
 * scope note (see `docs/domain/touchline-atlas-provenance.md` §16), not a silent omission.
 */

import type { EventReadinessLabel, EventListRowInput } from "@/lib/touchline/presentation/event-view-model";

export interface EventListRowSource {
  id: string;
  name: string;
  startsAt: Date;
  status: string;
  squads: Array<{ status: string }>;
}

/** One readiness / next-action line — reused verbatim from the pre-existing production rule. */
export function readinessLabel(event: EventListRowSource): EventReadinessLabel {
  if (event.status === "FINALIZED") return "Done";
  if (event.squads.length === 0) return "No squads planned";
  if (event.squads.every((s) => s.status === "LOCKED")) return "Squads ready";
  return "Draft squads";
}

export function toEventListRowInput(event: EventListRowSource): EventListRowInput {
  return {
    eventId: event.id,
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    opponentSummary: null,
    readiness: readinessLabel(event),
    isFinalized: event.status === "FINALIZED",
  };
}
