# ARR-0044: Match kickoff timezone parsing and display inconsistency

## State

Resolved

## Identified

2026-09-12

## Residue

`Match.startsAt` / `EventMatch.startsAt` is meant to be one unambiguous absolute UTC instant
representing the coach's real-world local kick-off time. Two incompatible conventions for
producing and consuming that instant coexist in the codebase:

1. **Browser-computed instant** — a client component builds a `Date` from separate date/time
   input values using the standard local multi-argument constructor (`new Date(y, m, d, h, mi)`),
   which resolves against the *browser's* local timezone — the coach's real timezone, by
   construction — then sends `.toISOString()` to the server. Correct. Used by
   `match-edit-form.tsx` (League reschedule) and the Event match create flow
   (`event-matches-tab.tsx`'s `handleCreate`).
2. **Server-side naive parse** — a `'use server'` Server Action receives raw, separate date/time
   strings (or a timezone-less `datetime-local` string) and performs the same local-timezone
   `Date` construction itself. This only produces the correct instant if the *server process's*
   timezone happens to equal the coach's real timezone. On Vercel (UTC), it silently stores a
   kickoff shifted later by the coach's real UTC offset (+1h CET / +2h CEST for a Norwegian
   organisation) whenever that offset is non-zero.

Before this branch, convention 2 was used by the League match **create** form
(`readKickoffDateTime()` in `src/app/(app)/matches/actions.ts`, fed raw `startsAt`/`kickoffTime`
form fields from `match-create-form.tsx`) and the Event match **edit** flow
(`event-matches-tab.tsx`'s `handleEditSave`, sending its `datetime-local` string as-is to
`updateEventMatchAction`, parsed server-side). Both are fixed on this branch to use convention 1
(see "Related implementation"), but the underlying inconsistency — that either convention can be
reached for by a future date/time input without anything preventing it — remains architectural
residue: nothing enforces which convention a new call site must use, and the *second, still-open*
half of the same root cause (below) is unresolved by this branch's fix.

**Second, unresolved half — display.** Several **Server Components** (no `"use client"`) format
`startsAt`/`EventMatch.startsAt` for the coach using functions whose doc comments explicitly
promise "wall-clock, no timezone shift" behaviour (`formatKickoffDate`, `formatKickoffTime`,
`formatKickoffDateTime`, `getKickoffDateInputValue`, `getKickoffTimeInputValue` in
`src/lib/date-utils.ts`) — all implemented with the JS Date object's local getters
(`getFullYear`, `getHours`, etc.). That promise only holds when the *rendering* process's local
timezone is the coach's real timezone. A Server Component renders on Vercel (UTC), so once
`startsAt` correctly holds a true UTC instant (which it now consistently does after this branch's
write-path fix), these pages display the kickoff time in **UTC**, not the coach's real local time
— off by the coach's UTC offset, in the *opposite* direction from the original write-side bug.

## Intended architecture

`Match.startsAt` / `EventMatch.startsAt` holds one absolute UTC instant. Every write path that
constructs it from separate date/time fields must do the timezone-resolving arithmetic in the
coach's own browser (a client component or client-side event handler), never inside a Server
Action or Server Component. Every read path that displays it back to a coach must resolve it
against the coach's real timezone, not the rendering process's own local timezone. Real-time
comparisons against "now" (`canStartLiveReporting`, ADR-0109's planning-boundary-closes-at-kickoff,
`hasLeagueMatchPassed`) are then meaningful without any hidden offset.

## Evidence

- `src/app/(app)/matches/actions.ts` — `readKickoffDateTime()` (server-local naive parse,
  documented in this branch's fix as fallback-only) vs. the new `readMatchStartsAt()` (prefers a
  browser-computed `startsAtIso`).
- `src/components/matches/match-create-form.tsx` — fixed on this branch to compute
  `startsAtIso` in the browser.
- `src/components/matches/match-edit-form.tsx` — already correct (pre-existing), the reference
  pattern this branch's fixes now match.
- `src/app/(app)/events/[eventId]/event-matches-tab.tsx` — `handleEditSave`'s `editStartsAt`
  handling, fixed on this branch to convert to an absolute instant in the browser before sending.
- `src/lib/date-utils.ts` — `formatKickoffDate`/`formatKickoffTime`/`formatKickoffDateTime`/
  `getKickoffDateInputValue`/`getKickoffTimeInputValue`, all local-getter-based. Auditing every
  call site against server/client boundary found:
  - **Fixed**: `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` computed
    `formatKickoffTime(match.startsAt)` server-side and passed the baked string to the client
    `CoachHandoverView` — for any match written via the now-corrected create-form path, this
    would have displayed a kickoff time shifted by the org's UTC offset on the exact page a coach
    uses on matchday. Moved into `coach-handover-view.tsx` (already a client component) to format
    `match.startsAt` itself, matching the pattern `match-edit-form.tsx` already used correctly.
  - **Fixed (ADR-0137)**: `src/app/(app)/o/[orgSlug]/opponents/page.tsx` and
    `.../opponents/[opponentTeamId]/page.tsx` — genuine Server Components showing a match's
    calendar date via `formatKickoffDate` (a day-boundary risk, matching ADR-0133 H4's
    already-disclosed narrower gap). Both moved to the new `formatDateInDisplayTimezone()`
    (`src/lib/date-utils.ts`), resolved deterministically against the fixed
    `MATCHBOARD_DISPLAY_TIMEZONE` ("Europe/Oslo") regardless of the rendering server's own
    runtime timezone.
  - **Deleted**: `src/components/opponents/previous-encounters-panel.tsx` — confirmed dead code
    (zero importers anywhere in the codebase; its live counterpart,
    `previous-encounters-display.tsx`, is already a Client Component and was never affected).
  - **Audited, found out of scope**: `src/app/(app)/o/[orgSlug]/events/page.tsx`'s
    `formatKickoffTime` call and `create-event-form.tsx`'s write path both operate on
    `Event.startsAt`/`endsAt`, which are plain `type="date"` inputs with **no time-of-day
    component at all** — `new Date("YYYY-MM-DD")` always parses as UTC midnight, deterministically,
    regardless of execution environment, so there is no browser-vs-server instant-computation bug
    here to fix. (Whether an all-day event range should carry a real time-of-day at all is a
    separate, pre-existing product question, not this ARR's residue.)
- `src/lib/matches/can-live-report.ts` / ADR-0133 H5 — the concrete symptom that surfaced this:
  "Start live reporting" stayed hidden until roughly the coach's own UTC offset *after* real
  kickoff, because the League match's `startsAt` (created via the buggy server-side path) held an
  instant 1-2h later than the real kickoff.

## Impact

- Any match created via the League create form, or an Event match rescheduled via
  `event-matches-tab.tsx`, **before** this branch's fix has a `startsAt` skewed later than its
  real kickoff by the organisation's real UTC offset at creation time (DST-dependent, so not a
  single fixed correction). This is not retroactively repairable without knowing each match's
  true intended local kickoff, which is not separately recorded anywhere.
- Every comparison against real "now" for such a match — the planning boundary auto-closing at
  kickoff (ADR-0109), `hasLeagueMatchPassed`, `canStartLiveReporting` — is wrong by that same
  offset, always in the direction of believing the match is later than it really is.
- Once the write side is fixed, any Server-Component kickoff-**time** display would show the
  coach a time offset **earlier** than reality by the same amount, for any organisation not
  physically in UTC+0. The one concrete instance of this (`handover/page.tsx`) was found and
  fixed before shipping. The remaining date-only Server-Component call sites (a narrower,
  already-disclosed day-boundary risk) are now resolved deterministically via ADR-0137's fixed
  display timezone rather than left as an undefined, coincidentally-correct state.
- This deepens, rather than duplicates, ADR-0133's already-disclosed "no per-organisation
  timezone model" gap: that ADR named only a narrower day-boundary bucketing symptom (Today's
  window near midnight); this ARR documents that the same root cause (no real per-org/user
  timezone concept anywhere in the schema) also produces a multi-hour drift in kickoff-relative
  real-time comparisons and, once the write side is fixed, in kickoff-time display.

## Containment

- Do not add a new date+time input for any match/event-match field that performs the
  local-timezone `Date` construction inside a Server Action or Server Component. Compute the
  absolute instant in the browser (mirroring `match-edit-form.tsx`) and send an ISO string with
  an explicit offset.
- Do not add a new Server Component call to `formatKickoffDate`/`formatKickoffTime`/
  `formatKickoffDateTime`/`getKickoffDateInputValue`/`getKickoffTimeInputValue` (or an equivalent
  local-getter-based formatter) for a value that should reflect the coach's real local time. Move
  the render into a Client Component, or use `formatDateInDisplayTimezone()` (ADR-0137) when a
  Client Component genuinely isn't the right shape.
- `MATCHBOARD_DISPLAY_TIMEZONE` (ADR-0137) is a deliberate, single-region, documented assumption
  — not a per-organisation/user timezone model. Do not read it as license to bypass real
  timezone modelling forever; if Matchboard ever needs to serve an organisation outside
  Europe/Oslo, generalise that one constant (see ADR-0137's Decision section) rather than adding
  a second fixed-timezone constant elsewhere.

## Resolution criteria

- [x] Every write path constructing a match/event-match kickoff instant from separate date/time
      fields performs that construction in the browser and transmits an absolute, unambiguous
      instant to the server. (League create, Event match edit.)
- [x] Every read path that displays a kickoff time to a coach resolves it against the coach's
      real timezone — via client-side rendering (the general rule; every affected Client
      Component already did or now does this), or via ADR-0137's fixed
      `MATCHBOARD_DISPLAY_TIMEZONE` for the narrow set of Server Components that cannot
      reasonably render client-side.
- [x] Every Server-Component call site listed under "Evidence" is migrated, deleted (dead code),
      or confirmed out of scope (no time-of-day component to get wrong).
- [x] A decision exists for how the coach's "real timezone" is determined in each case: the
      coach's own browser for every write path and every Client-Component read, ADR-0137's fixed
      Europe/Oslo constant for the small number of Server-Component reads that need one.

All four criteria are met. Genuine multi-region per-organisation/user timezone support remains
future work (ADR-0137 names the exact generalisation point) but is not required to close this
ARR — nothing in the current product needs it, and ADR-0137 documents that explicitly rather than
leaving it an open question.

## Disposition

**Resolved.** The two known write-path instances (League match create, Event match edit) use the
already-correct browser-side convention. Every display-side Server-Component call site is
migrated to ADR-0137's fixed display timezone, deleted as dead code, or confirmed out of scope.
The one concrete regression the write-side fix would otherwise have introduced (`handover/page.tsx`)
was found and fixed before shipping. Historical data was explicitly not remediated (maintainer
decision, recorded below) since it is not required to resolve the originally-reported symptom.

**Historical data — explicitly not remediated (maintainer decision, 2026-09-12).** Existing
matches whose `startsAt` was written via the pre-fix buggy path keep that skewed value; no
backfill/remediation script was requested or run. This is deliberate, not an oversight: the
originally-reported symptom ("Start live reporting" hard to find) is fully and independently
resolved for every existing match by the separate `canStartLiveReporting()` fix (this branch's
first commit), which no longer depends on kickoff-time accuracy at all — so remediating historical
`startsAt` values buys nothing for that problem. The only residual effect of leaving old data
unremediated is on ADR-0109's automatic planning-boundary closure and `hasLeagueMatchPassed`'s
day check for a still-*unplayed* existing match, which may stay timed up to ~1-2h later than real
kickoff — assessed and accepted as low-consequence (not a visible break, not a data-integrity
risk) rather than worth the risk of a bulk correction with no reliable way to distinguish an
already-correctly-rescheduled match from a still-buggy one (see "Impact"). Revisit only if a
concrete need for precise historical kickoff timing on an existing match actually arises.

## Related decisions

- ADR-0133 (Live reporting durability and correctness hardening) — disclosed a narrower version
  of this same root cause ("no per-organisation timezone model... a real Europe/Oslo-day
  computation is a separate, larger change") and the H5 gating fix this ARR's symptom motivated.
- ADR-0109 (derived coach workflow lifecycle) — the planning-boundary-closes-at-kickoff mechanism
  this residue silently mistimes for affected matches.
- ADR-0137 (Single Fixed Display Timezone for Server-Rendered Dates) — fulfils ADR-0133's
  disclosed-but-deferred "Europe/Oslo-day computation" item and closes this ARR's display-side
  resolution criteria.

## Related implementation

- `src/app/(app)/matches/actions.ts` — `readMatchStartsAt()` / `readKickoffDateTime()`.
- `src/components/matches/match-create-form.tsx` — browser-computed `startsAtIso`.
- `src/app/(app)/events/[eventId]/event-matches-tab.tsx` — `startEditMatch()` /
  `handleEditSave()`.
- `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` /
  `src/components/matches/coach-handover-view.tsx` — moved kickoff-time formatting from the
  server page into the client view, closing the one concrete display-side regression the
  write-side fix would otherwise have introduced.
- `src/lib/date-utils.ts` — `MATCHBOARD_DISPLAY_TIMEZONE` / `formatDateInDisplayTimezone()`
  (ADR-0137), and a corrected doc comment on the existing `formatKickoff*` functions stating they
  are client-side-only.
- `src/app/(app)/o/[orgSlug]/opponents/page.tsx`,
  `src/app/(app)/o/[orgSlug]/opponents/[opponentTeamId]/page.tsx` — migrated to
  `formatDateInDisplayTimezone()`.
- `src/components/opponents/previous-encounters-panel.tsx` — deleted (dead code).
- `src/lib/matches/can-live-report.ts` — the "Start live reporting" gating fix that surfaced this.
- `src/test/setup-registry.test.ts` — regression tests proving `startsAtIso` precedence and the
  documented fallback behaviour.
- `src/lib/__tests__/display-timezone.test.ts` — proves `formatDateInDisplayTimezone()` resolves
  a genuine day-boundary crossing correctly, independent of the test runner's own timezone.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-12

Record created. Confirmed via code inspection while fixing the reported "Start live reporting
stays hidden right up until kickoff" bug; the two known write-path instances (League match
create, Event match edit) fixed on the same branch. Display-side half and a real
per-organisation/user timezone model left open, pending a maintainer decision.

Follow-up the same day, prompted by the maintainer asking directly whether existing matches would
need remediation: auditing the display side for the *specific* regression the write-side fix
could introduce (a Server Component now showing a shifted time for a newly-created match) found
and fixed one concrete instance (`handover/page.tsx`). The remaining open display call sites were
re-classified by actual risk (date-only vs. time-of-day; touched vs. untouched field) rather than
left as one undifferentiated list.

Second follow-up the same day: maintainer explicitly decided not to remediate historical
`startsAt` data, since the "Start live reporting" visibility fix works for existing matches
independent of kickoff-time accuracy. Recorded under "Disposition" above.

**Closed the same day**, at the maintainer's explicit request to close this ARR within the same
PR. Wrote ADR-0137 to make the one remaining architectural decision this ARR's resolution
criteria required (a fixed, documented `Europe/Oslo` display timezone for the narrow set of
Server Components that cannot render client-side), then: migrated the two genuine date-only
Server-Component call sites (`opponents/page.tsx`, `opponents/[opponentTeamId]/page.tsx`) to the
new `formatDateInDisplayTimezone()`; deleted `previous-encounters-panel.tsx` as confirmed dead
code; audited `events/page.tsx` and `create-event-form.tsx` and found them out of scope
(`Event.startsAt`/`endsAt` carry no time-of-day component, so there is no browser-vs-server
instant bug possible there). All four resolution criteria are now met. State moved to Resolved.
