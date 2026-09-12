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
  `getKickoffDateInputValue`/`getKickoffTimeInputValue`, all local-getter-based, still called
  from Server Components (unresolved half):
  - `src/app/(app)/o/[orgSlug]/opponents/page.tsx`
  - `src/app/(app)/o/[orgSlug]/opponents/[opponentTeamId]/page.tsx`
  - `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx`
  - `src/app/(app)/o/[orgSlug]/events/page.tsx`
  - `src/components/opponents/previous-encounters-panel.tsx`
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
- Once the write side is fixed (this branch), any Server-Component kickoff display listed above
  will show the coach a time offset **earlier** than reality by the same amount, for any
  organisation not physically in UTC+0 — a new, currently live but less severe, user-facing
  symptom (a displayed time, not a hidden action).
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

Pending. This branch resolves the two known write-path instances (League match create, Event
match edit) using the already-correct convention (browser-side computation), removing the
immediate "Start live reporting" symptom's root cause for newly created/rescheduled matches. The
display-side half, and a real per-organisation/user timezone model to remove the "must render in
the coach's own browser" constraint entirely, remain open and need a maintainer decision.

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
