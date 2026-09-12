# ADR-0137: Single Fixed Display Timezone for Server-Rendered Dates

## Status

Accepted

## Context

ARR-0044 (match kickoff timezone parsing and display inconsistency) documented that Matchboard's
date/time handling relies entirely on **where the formatting code executes**, not on any real
knowledge of the coach's or organisation's timezone:

- `src/lib/date-utils.ts`'s `formatKickoffDate`/`formatKickoffTime`/`formatKickoffDateTime`/
  `getKickoffDateInputValue`/`getKickoffTimeInputValue` all use the JS `Date` object's local
  getters (`getFullYear`, `getHours`, etc.) — correct only when the code executing them runs in
  the coach's own browser, since "local" there genuinely means the coach's real device timezone.
- Client Components (`match-edit-form.tsx`, `event-matches-tab.tsx`, `coach-handover-view.tsx`
  after ARR-0044's fix) already satisfy this correctly by construction — nothing to change there.
- A small, fixed set of **Server Components** cannot satisfy it at all under this scheme, since
  they execute on Vercel (UTC): a small number of read-only, date-only history displays
  (`opponents/page.tsx`, `opponents/[opponentTeamId]/page.tsx`) showing a past match's calendar
  date.

ADR-0133 already named this gap explicitly and deferred it: "a real Europe/Oslo-day computation
is a separate, larger change." This ADR is that change — deliberately narrow, not a general
per-organisation/user timezone model (Matchboard has no schema field for one, and nothing in the
current product requires one: every known deployment operates in one real-world region).

## Decision

Introduce one fixed constant, `MATCHBOARD_DISPLAY_TIMEZONE = "Europe/Oslo"`
(`src/lib/date-utils.ts`), and a small set of explicit-timezone formatting helpers
(`formatDateInDisplayTimezone`, built on `Intl.DateTimeFormat` with `timeZone:
MATCHBOARD_DISPLAY_TIMEZONE`) for the **narrow set of Server Component read paths that display a
date/time and cannot reasonably move to client-side rendering**.

This does **not** replace the existing local-getter-based `formatKickoff*`/`getKickoff*Input*`
functions, and does not change their behaviour. Those remain correct, unchanged, for every
Client Component call site — they rely on the browser's own local timezone being the coach's
real timezone, which is true by construction and needs no configuration. The new explicit-
timezone helpers exist only for the handful of places a Client Component genuinely isn't the
right shape (a plain historical summary table cell, computed once server-side).

Scope, deliberately narrow:

- One fixed timezone, not a per-organisation or per-user setting. If Matchboard ever serves an
  organisation outside Europe/Oslo, this constant is the one place to generalise — a schema field
  (e.g. `Organisation.timezone`) and threading it through `requirePageActorContext()`'s resolved
  context would be the natural next step, but is not built now because nothing in the product
  needs it yet and building it speculatively would be exactly the kind of premature plumbing
  AGENTS.md's engineering principles warn against.
- Applies to **date-only or genuinely read-only historical display**, not to any write path
  (write paths already correctly resolve via the coach's own browser, per ARR-0044) and not to
  any real-time comparison (`canStartLiveReporting`, ADR-0109's planning-boundary-closes-at-
  kickoff, `hasLeagueMatchPassed`) — those compare true instants and need no timezone conversion
  at all, only a correct absolute `startsAt`, which ARR-0044's write-side fix already provides
  going forward.

## Consequences

- The three remaining Server-Component call sites ARR-0044 flagged as a day-boundary risk
  (`opponents/page.tsx`, `opponents/[opponentTeamId]/page.tsx`) now resolve a match's calendar
  date deterministically against Europe/Oslo, regardless of the rendering server's own runtime
  timezone — closing that risk rather than leaving it as an undefined, "usually looks right by
  coincidence" state.
- `src/components/opponents/previous-encounters-panel.tsx` (dead code — confirmed zero importers)
  is deleted rather than fixed; its live counterpart (`previous-encounters-display.tsx`) is
  already a Client Component and was never affected.
- `Event.startsAt`/`endsAt` (used by `events/page.tsx`'s `formatKickoffTime` call) are
  **out of scope** for this decision and for ARR-0044: they are plain `type="date"` inputs with
  no time-of-day component at all (`new Date("YYYY-MM-DD")` always parses as UTC midnight,
  deterministically, regardless of execution environment), so there is no browser-vs-server
  instant-computation bug here to fix — displaying "00:00"-ish values for an all-day event range
  is a separate, pre-existing, low-value cosmetic question about whether Event start/end should
  carry a real time-of-day at all, not a timezone-correctness defect.
- `create-event-form.tsx`'s write path was audited as part of this decision and found not to
  share ARR-0044's write-side bug class, for the same reason (no time-of-day field to
  mis-combine).
- This closes ARR-0044's remaining resolution criteria: every write path already resolves in the
  browser; every read path either resolves in the browser (Client Components) or against this
  one fixed, documented timezone (the narrow set of Server Components that must); a decision now
  exists for how "the coach's real timezone" is determined in each case.

## Relationship to other records

- Supersedes/fulfils ADR-0133's disclosed-but-deferred "a real Europe/Oslo-day computation is a
  separate, larger change" item, narrowly.
- Closes ARR-0044 (match kickoff timezone parsing and display inconsistency).
- Does not touch ADR-0109 (planning-boundary-closes-at-kickoff) — that mechanism compares true
  instants and was never timezone-display-dependent; ARR-0044's write-side fix is what corrects
  it for newly-created matches.
