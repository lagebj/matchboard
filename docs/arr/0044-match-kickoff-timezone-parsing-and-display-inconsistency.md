# ARR-0044: Match kickoff timezone parsing and display inconsistency

## State

Confirmed

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
  - **Fixed on this branch** (a genuine, concrete regression the write-side fix would otherwise
    have introduced): `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` computed
    `formatKickoffTime(match.startsAt)` server-side and passed the baked string to the client
    `CoachHandoverView` — for any match written via the now-corrected create-form path, this
    would have displayed a kickoff time shifted by the org's UTC offset on the exact page a coach
    uses on matchday. Moved into `coach-handover-view.tsx` (already a client component) to format
    `match.startsAt` itself, matching the pattern `match-edit-form.tsx` already used correctly.
  - **Still open, but time-of-day is not actually displayed** (only `formatKickoffDate`, a
    date-only function — a day-boundary risk only, matching ADR-0133 H4's already-disclosed,
    narrower gap, not a multi-hour one):
    `src/app/(app)/o/[orgSlug]/opponents/page.tsx`,
    `src/app/(app)/o/[orgSlug]/opponents/[opponentTeamId]/page.tsx`,
    `src/components/opponents/previous-encounters-panel.tsx` (all show past-encounter dates).
  - **Still open, `formatKickoffTime` used server-side**, but on `Event.startDate`/`endDate` (the
    event-level date range), a field this branch's write-side fix never touched — Event-level
    start/end still uses whichever convention it always did, so this call site's correctness is
    unchanged by this branch either way: `src/app/(app)/o/[orgSlug]/events/page.tsx`. Event-level
    date/time write-path timezone correctness (create-event-form.tsx) was not audited as part of
    this ARR and may have its own instance of this same residue — not confirmed either way.
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
  physically in UTC+0. One concrete instance of this (`handover/page.tsx`) was found and fixed
  on this branch, before shipping, precisely because it is a real regression class the write-side
  fix would otherwise introduce. The remaining open call sites are date-only (a narrower,
  already-disclosed day-boundary risk) or on a field this branch does not touch (Event-level
  start/end).
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
  the render into a client component, or resolve this ARR first.
- Do not silently "fix" the existing Server-Component display call sites by re-applying an
  arbitrary fixed offset (e.g. hardcoding `Europe/Oslo`) — that is a real product/architecture
  decision (a per-organisation or per-user timezone model, or a documented single-timezone
  assumption) and belongs in an ADR, not an ad hoc patch.

## Resolution criteria

- Every write path constructing a match/event-match kickoff instant from separate date/time
  fields performs that construction in the browser and transmits an absolute, unambiguous
  instant to the server.
- Every read path that displays a kickoff time to a coach resolves it against the coach's real
  timezone (via client-side rendering, or a real per-organisation/user timezone model), not the
  rendering process's own local timezone.
- The Server-Component call sites listed under "Evidence" are migrated or covered by that model.
- A decision (ADR) exists for how the coach's "real timezone" is determined — today's fix
  (browser-side arithmetic) is a correct implementation of "same timezone as the coach at all
  times" only where the coach's own browser is doing the writing; the display half has no
  equivalent mechanism yet and needs one.

## Disposition

Pending, with one explicit maintainer decision recorded. This branch resolves the two known
write-path instances (League match create, Event match edit) using the already-correct
convention (browser-side computation), removing the immediate "Start live reporting" symptom's
root cause for newly created/rescheduled matches. The display-side half, and a real
per-organisation/user timezone model to remove the "must render in the coach's own browser"
constraint entirely, remain open and need a maintainer decision.

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

## Related implementation

- `src/app/(app)/matches/actions.ts` — `readMatchStartsAt()` / `readKickoffDateTime()`.
- `src/components/matches/match-create-form.tsx` — browser-computed `startsAtIso`.
- `src/app/(app)/events/[eventId]/event-matches-tab.tsx` — `startEditMatch()` /
  `handleEditSave()`.
- `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` /
  `src/components/matches/coach-handover-view.tsx` — moved kickoff-time formatting from the
  server page into the client view, closing the one concrete display-side regression the
  write-side fix would otherwise have introduced.
- `src/lib/matches/can-live-report.ts` — the "Start live reporting" gating fix that surfaced this.
- `src/test/setup-registry.test.ts` — regression tests proving `startsAtIso` precedence and the
  documented fallback behaviour.

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
