# Gate E W2 — Current State Audit (E02)

Scope: production Event Detail (`/o/{orgSlug}/events/[eventId]`, loader
`src/app/(app)/o/[orgSlug]/events/[eventId]/page.tsx`, component
`src/app/(app)/events/[eventId]/event-detail.tsx`) and its Event-day timeline
(`src/components/events/event-day-timeline.tsx`), audited against E02's acceptance question and
XR-T01/XR-S01/XR-V02 (`SOURCE_RECONCILIATION.md` §3). Every finding below was verified by reading
the cited file on `main` at `5ee69d7c4`; nothing here was run against a live deployment.

## Classification per E02 requirement

| E02 requirement | Production today | Classification |
|---|---|---|
| Event identity leads the page | `TouchlinePageHeader` with Event name + "type · format · date · status" context line | IMPLEMENTED |
| Event day leads Overview, above administration | `EventDayTimeline` is the first Overview child (ADR-0125/0136) | IMPLEMENTED |
| Chronological multi-match order across squads | Sorted by `startsAt` only; equal kickoffs keep database order (`orderBy: startsAt` has no tie-break) | PARTIAL — no deterministic order for simultaneous matches |
| Squad identity on every match | `squadNames[eventSquadId]` → `ScorebookMatchRow` own-team line; falls back to the literal "Squad" if unresolved | IMPLEMENTED (fallback masks an integrity error instead of surfacing it) |
| Next match distinguishable | First match with `startsAt > now`, not cancelled, no report → NEXT | PARTIAL — only one NEXT even when two squads kick off next at the same time |
| Completed vs played-but-unreported | Played-no-report gets FOLLOW-UP kicker; row shows "FT" with no score | IMPLEMENTED (kicker carries the distinction; the row alone says "FT") |
| DRAFT/REPORTED/LOCKED report states | DRAFT and REPORTED both → `report_incomplete`; the DRAFT score and outcome are passed to `buildMatchPresentation()` | MISSING FROM PRESENTATION — a draft score renders as a final result ("FT · Win"); REPORTED (a completed result per ADR-0001/0003) is labelled follow-up |
| Cancelled matches | Lifecycle `cancelled`, reason shown by `ScorebookMatchRow` | PARTIAL — node falls through to `later` with kicker "LATER", even after kickoff has passed |
| Live state from canonical evidence | `EventMatchWithReport.isLive`/`livePrimaryAction` exist (ADR-0152 §2) but `deriveEventMatchLifecycle()` never returns `live`; the `state === "live"` branch is unreachable | MISSING FROM PRESENTATION — a live match shows as "FT" + FOLLOW-UP |
| Timeline → match operational context | `ScorebookMatchRow` supports `href`, but `EventDayTimeline` passes none: rows are read-only | SILOED IN SEPARATE TAB — match operations live only in the Matches tab |
| Event Match Detail destination (`03_…` IA scenario 3) | No such route. `src/app/(app)/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/` contains only `live/` and `live/follow/` | MISSING FROM DOMAIN/ROUTING |
| Return to Event-day context | Only `?tab=` is URL-backed; no per-match selection state exists | MISSING (no selection to restore) |
| Loading / empty / failure | Returns `null` while loading, when empty, AND on fetch failure (`.catch(() => setMatches([]))`) | PARTIAL — failure is indistinguishable from "no matches" |
| Operationally verified | Not in this wave (no deployment touched) | NOT OPERATIONALLY VERIFIED |

## Mandatory investigations (spec §4)

**A. Timeline data ownership.** `EventDayTimeline` and `EventMatchesTab` each call
`listEventMatchesAction(eventId)` independently (`event-day-timeline.tsx:51`,
`event-matches-tab.tsx:135`). Only the active tab is mounted, so they are never on screen together,
and switching back to Overview remounts the timeline and re-fetches. After a mutation in the Matches
tab (`loadMatches()` re-fetch), returning to Overview therefore shows fresh data. Divergence can
only occur if the same tab stays mounted across an external change — neither list subscribes to
updates. Not a second source of truth (both read the same action); recorded, not fixed. The E02
candidate adds no third fetch: it reads fixture records only.

**B. Fixed reference time.** Production evaluates `new Date()` at render (`event-day-timeline.tsx:65`).
The minimal fixture-safe adaptation is a pure projection that takes `now` as an argument
(`src/app/dev/ui-lab/gate-e/e02-event-day/shared/event-day-projection.ts`); every fixture exports one
frozen `now`, used by page and tests alike. Production is unchanged; a `now` seam in production is
an integration requirement (`BLOCKERS.md` BLK-E02-04), not built here.

**C. Loading vs empty vs failure.** Confirmed: the `catch` converts a failed fetch into `[]`, then
`matches.length === 0` returns `null` — the coach sees no Event day section and no error. This is an
E02-adjacent gap (an Event with matches can look like one with none). E02's register row does not
require a failure state, so no failure candidate is added; the gap is recorded as BLK-E02-03.

**D. Live state.** `isLive` is computed canonically (`deriveEventLiveState()` in
`src/lib/stats/event-match-stats.ts`, ACTIVE session only) but never read by the timeline. Consequence:
an in-progress match with no report is classified `played` → `ScorebookMatchRow` phase `final` →
"FT" with "— —" and a FOLLOW-UP kicker — i.e. a live match is presented as finished. Production never
shows live merely because kickoff passed (it shows *finished* instead). The candidate uses `isLive`
(BLK-E02-01).

**E. Match identity / navigation.** Verified destinations for an individual Event match:
`/o/{org}/events/{eventId}/matches/{eventMatchId}/live` (Live Reporting) and `…/live/follow`
(Follow Live), both linked from `EventMatchesTab` (`event-matches-tab.tsx:861-879`); Today links Event
matches to `/events/{eventId}` and the same live routes (`today-football-match.ts:116-117`). Report,
lineup and helper management are inline panels inside the Matches tab, with no URL state. There is no
Event Match Detail page and no URL parameter that selects an Event match. The candidate does not
invent one (`EVENT_AND_MATCH_IDENTITY_CONTRACT.md`).

**F. Report states.** `matchPresentationPhase()` treats `played`, `report_incomplete`, `done` and any
non-null score as `final`. With production's inputs: no report + past kickoff → "FT", no score (kicker
FOLLOW-UP); DRAFT 1–0 → "1 0 FT · Win" (misleading — ADR-0001: "DRAFT reports show nothing");
REPORTED 1–1 → result shown but labelled FOLLOW-UP (misleading the other way — ADR-0001/0003 treat
REPORTED as completed); LOCKED → result, no kicker (correct). `EventMatchesTab` labels these
"No report", "Draft", "Reported", "Completed" (`REPORT_STATUS_LABELS`).

## What E02 needs that production cannot be mounted to show

`EventDayTimeline` cannot be mounted with fixture data: it self-fetches through a Server Action in
`useEffect`, its lifecycle function is module-private, and it reads the real clock. `EventDetail` as a
whole requires the full `EventDetailData` loader shape and wires ~15 Server Actions. The candidate
therefore uses a fixture-safe orchestration around the real presentation primitives
(`VISUAL_VS_CURRENT.md` gives the provenance per capability).
