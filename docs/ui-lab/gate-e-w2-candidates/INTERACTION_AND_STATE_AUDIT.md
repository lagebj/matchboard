# Gate E W2 — Interaction and State Audit (E02)

Action contract per `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` ("origin; purpose; host; editing
representation; server/domain owner; feedback; context restoration; navigation; reason").

| Action | Origin | Host / decision | Domain owner | Navigation | Restoration | Provenance |
|---|---|---|---|---|---|---|
| Select a match | Event-day row (real `ScorebookMatchRow` link) | `CONTEXT_INSPECTOR` on the same view | none (read-only) | URL query only (`match`), same path | direct URL, browser Back, focus moves to "Selected match" heading | DIRECTIONAL |
| Back to event day | Selected context button | `SAME_VIEW` | none | URL query only | focus returns to the row link of that match; other query values kept | DIRECTIONAL |
| Switch Event tab | real `TabRail` | `SAME_OBJECT_TAB` | none | `?tab=` (production convention) | Overview restores the `match` selection | REAL convention; non-overview bodies not reproduced |
| Live reporting entry | Selected context | `SEPARATE_WORKSPACE` (XR-I02 exception 1) | Live Reporting | real route | production's own live page return (not exercised here) | REAL destination |
| Follow live | Selected context | `SEPARATE_WORKSPACE` | Follow Live | real route | — | REAL destination |
| Report and lineup | Selected context | Event Matches tab (production owner) | `EventMatchesTab` Server Actions | `/o/{org}/events/{id}?tab=matches` | cannot target the match (no anchor in production) | REAL destination, gap disclosed |
| Header Back | Header | — | — | production's `/events` | — | REAL (ARR-0035 bare path) |

Every interactive element performs its advertised function. Read-only elements (squad progression,
Event details, summary line) are plain text with no hover state. The tab rail's three non-overview
tabs do switch the tab; their body states plainly that it is not reproduced in this candidate.

## Deliberately not rendered

Finalize/Unfinalize, Generate squads/Regenerate, Fill remaining places, Clear, Delete, Export event,
halves/duration/break editors, squad readiness widget, metric tiles, "Event squads created" banner,
Squads/Player pool/Matches tab bodies. All are production administration; most are Server Actions
that UI Lab must never invoke with synthetic ids. The finalised banner's production sentence "Unfinalise
to edit squads, matches, or player assignments" is replaced with "Finalisation locks the event; each
match keeps its own report state below", because the Unfinalize control is not rendered here.

## Keyboard, focus, accessibility

- Rows are real links: Tab reaches them, Enter selects (Playwright). Focus moves to the
  "Selected match" heading (`tabIndex=-1`, visible focus ring) on a new selection, and back to the
  originating row on clear or browser Back. A directly-loaded URL does not move focus.
- States are named in text (kickers, captions, "Selected" label, state/report rows in the context);
  the timeline node shapes differ by size/fill as well as colour (real `TimelineItem`).
- No hover-only information. Squad, opponent, kickoff, state and result/missing-report are visible
  in the row or kicker at 320px.

## Server Actions

The candidate imports no Server Action module. `e2e/ui-lab-gate-e.spec.ts` records every POST request
carrying a `next-action` header while selecting, switching tabs and clearing, and asserts there are
none.

## Responsive

`large` (≥1200px): two columns, timeline + 24rem context column (sticky). Below: one column, the
context and aside follow the timeline. Product surface uses the app shell's `max-w-[96rem]`
container (Playwright: >1200px wide at 1440). No document-level horizontal overflow at 390 and 320px
for all three states (Playwright; the capture script also measures and warns).

## Loading / empty / failure

Fixture pages have no fetch, so no loading or failure state exists to show. An Event with zero
matches renders "No matches are recorded for this event." (code path present, no candidate —
not required by the register row). Production's failure-as-empty behaviour is BLK-E02-03.
