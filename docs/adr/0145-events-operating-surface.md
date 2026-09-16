# ADR-0145: Events operating surface — Next Event hero, readiness/attention, single-rail Event Season

## Status

Accepted

## Context

The first-class Events route (`src/app/(app)/o/[orgSlug]/events/page.tsx`) was a sparse, month-grouped Event list plus a small "Next event" text card. It gave a coach no factual readiness picture (how many squads are drafted, how many matches are configured, how many helper roles are filled, how many guest players are attached) and no prioritised list of what still needs attention before the Event happens. Every other first-class route already leads with the one operationally relevant item and its readiness/attention facts (Today: `TodayOperatingSurface`, ADR-0141/0142; League: `LeagueSurface`, ADR-0144) — Events was the one first-class route still using the pre-Touchline sparse-list grammar.

Matchboard already owns every fact needed to build this without inventing new state:

- `Event.status` (`DRAFT`|`FINALIZED`, no separate `isCurrent` flag) and real `Event.startsAt`, so "is this Event next" is a temporal fact, never inferred from a selection-state field;
- `EventSquad.status` (`DRAFT`|`LOCKED`), `targetSize`, and nullable `minSize`, so squad readiness is a factual count/threshold comparison, never a generated percentage or invented denominator;
- `EventPlayerAvailability.status` (including `WITHDRAWN`) and nullable `guestPlayerId`, so guest-player and unavailable-player counts are real aggregates, not estimates;
- `EventMatch.status` (`SCHEDULED`|`CANCELLED`) and `EventMatchSupportAssignment` rows, so configured-match and helper-assignment counts are real aggregates;
- no Event-level location/venue field and no `EventSquad` colour field exist anywhere in the schema — the supplied golden reference image contains generated placeholder data (a Location row, a "Helpers confirmed 5/8" denominator, U12 age labels, Rød/Hvit/Blå colour strips) that has no backing field and must not be invented to match the picture.

The Matchboard Events Operating Surface implementation bundle (`.matchboard-work/matchboard_events_operating_surface_2026-09-16/`) is the authoritative, pre-specified design and data contract for this change; this ADR records the durable architectural decisions it establishes, mirroring ADR-0144's role for League.

## Decision

Events becomes a Next-Event-hero → readiness/attention/participating-squads/facts → single-rail Event Season composition (`EventsOperatingSurface`).

### Dedicated bounded overview loader

`getEventsOverview()` (`src/lib/events/get-events-overview.ts`) is a new, separate, tenant-scoped Prisma query returning only the fields this route needs (squads with `minSize`/`targetSize`/players, Event players with `status`/`guestPlayerId`, EventMatches with `status` + support-assignment counts). The existing generic `getEvents()` (`src/app/(app)/events/actions.ts`) is left unchanged and keeps serving its existing consumers — it does not grow into an ever-larger, every-consumer loader. One tenant-scoped query with nested `select`; no per-Event/per-squad/per-match application-level loop.

### Pure, DB-free presentation view model

`buildEventsOperatingViewModel()` (`src/lib/touchline/presentation/events-overview-view-model.ts`) is the sole place that decides:

- the featured (next) Event, reusing `buildEventListViewModel()`'s existing selection semantics exactly (earliest upcoming non-finalized Event; earliest upcoming Event if every upcoming Event is finalized; `null` when there is no upcoming Event) — not a second, divergent selection rule;
- factual readiness counts (squads drafted/locked, configured EventMatches, helper-assignment count, guest-player count) with no invented percentages or denominators;
- a conservative, priority-ordered Needs-Attention list built only from explicit Event-level facts (no squads → empty squad → below-minimum → below-target → unavailable/withdrawn aggregate → no matches configured). `event-finalization-validation.ts` — a different, post-event, whole-container validator — is deliberately never imported here;
- Participating-squads rows with a `Ready` label derived only from the canonical `LOCKED` status, never inferred from player count alone;
- Event facts limited to Type/Date/Participating squads/Configured matches — no Location, because no canonical Event-level venue field exists;
- Event Season row ordering (featured first, then remaining upcoming ascending, then past descending) with an `Open`/`View` action label derived from real elapsed time (`startsAt` vs. now), never from `status`/finalized — the same "never infer a temporal fact from a selection-state field" principle ADR-0144 established for League's current-round resolution.

The view model returns the full, deterministic attention list rather than a pre-capped slice with a separate overflow count: the "Show N more" disclosure needs the actual hidden items to reveal, not just a count with nowhere to expand to. `EVENTS_ATTENTION_MAX` (4) is exported from the view model and applied by the `EventsAttention` component, which owns the local expand/collapse UI state.

Dates are formatted against `MATCHBOARD_DISPLAY_TIMEZONE` (ADR-0137) inside the view model itself, because the Events page is a Server Component and cannot rely on browser-local time the way a Client Component can.

### Single-rail Event Season

`EventsSeason` renders exactly one continuous connector element (`data-testid="events-season-connector"`) behind the Event rows, not a per-row line fragment. The existing `TouchlineTimeline`/`TimelineItem` primitive draws a per-`<li>` absolutely positioned segment and was deliberately not reused here, since the bundle's acceptance contract requires exactly one connector passing through every marker's centre.

### Dedicated atmosphere layer

`EventsAtmosphere` (`src/components/events/events-atmosphere.tsx`) mirrors `TodayAtmosphere`'s pattern exactly (a decorative, `aria-hidden`, `pointer-events: none` layer driven by CSS custom properties, never inline image logic in the component) but uses its own dedicated repository-owned WebP assets and its own `--tl-events-atmosphere-image`/`--tl-events-atmosphere-opacity` tokens/height/fade-curve values — not a re-skin of Today's asset or blend constants.

### URL as selection authority (Event detail tabs)

Event detail's tabs (`overview`/`squads`/`pool`/`matches`) are now addressed by a `?tab=` query parameter, validated against the real tab list (an unknown or missing value falls back to `overview`). There is no separate client-only tab-selection state that can drift from the shareable URL — the same principle ADR-0144 applied to League's `season`/`round` params.

## Consequences

The Events route now gives a coach the same "what needs attention, right now" operating picture Today and League already provide, backed entirely by real Prisma facts.

`getEventsOverview()` is one additional bounded query; it does not touch or widen `getEvents()`. No Prisma migration is required — every field this route needs already exists.

The previous sparse month-grouped list composition in `events/page.tsx` is removed; there is exactly one production Events route composition (`EventsOperatingSurface`).

Event detail's tab state moved from local `useState` to URL-derived state; deep links to a specific tab are now shareable and survive a refresh.

## Alternatives rejected

### Cap the Needs-Attention list to 4 items inside the view model and return only an overflow count

Rejected because the required "Show N more" disclosure needs the actual remaining items to reveal on expand, not just a count with nothing behind it. The view model returns the full ordered list; only the component owns the default-visible cap.

### Reuse `TouchlineTimeline`/`TimelineItem` for Event Season

Rejected because that primitive draws one line segment per row rather than a single continuous connector, and the bundle's acceptance contract requires exactly one connector element for Event Season.

### Infer `EventSquad` colour from squad name text (e.g. "Rød", "Hvit", "Blå")

Rejected for the same reason ADR-0144 rejected inferring team kit colour from team name text: no `EventSquad` colour field exists, and guessing one from a name would silently diverge from reality (there is nothing to diverge from — it would be fabricated, not resolved).

### Reproduce the golden reference image's Location row, helper-confirmed denominator, and generated age labels

Rejected because none of these have a backing field (`Event` has no venue/location field, no canonical "confirmed" semantics exist for helper assignments beyond a factual count, and no age-group label field exists on `Event`/`EventSquad`). The golden governs composition and visual hierarchy only; the bundle's written data/copy rules override it wherever they conflict.

### Keep Event detail's tab selection as local component state

Rejected because it is not shareable or bookmarkable and can drift from the URL the coach sees in the address bar — the same rationale ADR-0144 applied to League's round/season selection.

## Relationship

Builds directly on ADR-0144's operating-surface pattern (bounded loader → pure view model → single composition owner → URL as selection authority) and ADR-0141/0142's Touchline composition/golden-conformance requirements, applying the same shape to the Events route.

Reuses ADR-0137's Europe/Oslo display-timezone authority for all date/label formatting in the view model.

Supersedes the prior sparse month-grouped Events list composition and its inline "Next event" card where this ADR differs from them.
