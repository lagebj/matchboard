# ADR-0147: Match Details and Post-Match Report become lifecycle-aware surfaces

## Status

Accepted (2026-09-18).

## Context

Root Match Details (`src/app/(app)/o/[orgSlug]/matches/[matchId]/page.tsx` +
`src/components/matches/match-detail.tsx`) had one flat tab set —
`Squad | Tactics | Rotations | After match | Opponent context | Review` — that did not change
with the match's lifecycle. ADR-0136 Phase 4 (§19 of `docs/domain/touchline-atlas-provenance.md`)
deliberately kept this scope narrow ("top-level identity/header/summary composition only... every
existing tab... frozen") and explicitly deferred a lifecycle-aware information architecture to a
later pass. The Post-Match Report route (`/post-match`) had no tabs at all — `PostMatchReportShell`
rendered every section (score, attendance, goals/assists, team note, planned squad, absences,
player stats) as one continuous scroll, with no distinction between "still reconciling" and
"locked historical record" beyond inline status text.

This ADR is that later pass — the `matchboard_match_details_exact_goldens_2026-09-18` implementation
programme, built against two user-supplied exact canonical reference images (not AI-generated
goldens; an earlier `matchboard_match_details_lifecycle_convergence_2026-09-18` programme was
abandoned mid-implementation before any code was written, after the user identified its generated
goldens as wrong — this ADR supersedes that abandoned programme's product-model bundle, not any
shipped code).

## Decision

### 1. Two independent surfaces, two independent lifecycles

Match Details (the canonical route) and Post-Match Report (`/post-match`) remain distinct routes
with distinct lifecycle vocabularies — they are not merged into one page or one tab set.

- **Match Details**: `BEFORE` / `AFTER` composition, derived from the existing
  `deriveMatchLifecycleStatus()` (`src/lib/selection/planning-boundary.ts`) via one new pure
  function, `deriveMatchDetailSurfaceState()` (`src/lib/matches/match-detail-view-model.ts`):
  `planning_open` / `planning_closed` / `live` / `cancelled` → `BEFORE`; `played` /
  `report_incomplete` / `done` → `AFTER`. A live session deliberately stays on the `BEFORE`
  composition (only the primary action swaps to "Open live reporting") — there is no third
  desktop composition.
- **Post-Match Report**: `DRAFT` / `COMPLETED`, derived from `MatchReportStatus` via
  `derivePostMatchReportSurfaceState()` (`src/lib/matches/match-detail-tabs.ts`): `LOCKED` →
  `COMPLETED`, everything else (including `REPORTED`, per ADR-0003's "REPORTED is not a routine
  visible state") → `DRAFT`.

### 1a. Post-Match Report DRAFT defaults to the editable workspace, not Summary

`getPostMatchReportDefaultTab()` returns `players` for `DRAFT`, not `summary`, even though
Summary is listed first in the tab rail and is the golden's own illustrated active tab.
`e2e/post-match-evidence-parity.spec.ts` (a real-UI proof of ADR-0003 — finishing live reporting
must land the coach on the actual editable report with its completion action immediately
reachable, zero extra clicks) failed against an initial implementation that defaulted `DRAFT` to
`summary`: `Complete report` lives inside the unchanged `PostMatchPage`/`PostMatchReportShell`
editor, which only mounts on the `Players` tab. The written exact-goldens spec fixes tab *order*,
not which tab is selected by default, so this is not a conflict with priority 1/2 authority — it
resolves an underspecified point using priority 3 (ADR-0003, proven by an existing, real,
already-passing e2e test) over an assumption this implementation had made on its own. `COMPLETED`
still defaults to `summary` — there is no equivalent immediate-completion-action requirement for a
locked, read-only report, and it matches that golden's own illustrated tab exactly.

### 1b. The resolved default tab is pinned into the URL, not recomputed live

`PostMatchReportPageShell` pins whichever tab `getPostMatchReportDefaultTab()` resolves into the
URL (`?tab=...`) the first time there is no explicit `tab` param, rather than leaving the default
as a value recomputed on every render from the current `surfaceState`. Without this, completing
the report from the Players tab (DRAFT → COMPLETED, a state change triggered by an action taken
*on that same tab*) silently recomputed a different default (`summary`) after the `router.refresh()`
completion triggers, navigating the coach away from Players — and its "Locked" status pill —
immediately after they used it. The same real e2e test caught this as a second, distinct failure
mode after 1a's fix landed. Once pinned, `?tab=players` remains valid and selected through the
DRAFT → COMPLETED transition (`players` is a real tab in both tab sets).

### 2. Exact tab sets, one owning module

`src/lib/matches/match-detail-tabs.ts` is the single source of truth for every tab array, default
tab, and legacy-`?tab=`-alias mapping (`squad` → `overview`, `opponent` → `opponent-context`; the
removed pre-existing `after-match`/`review` tab keys fall back to the surface default rather than
rendering empty content).

- Match Details BEFORE: `Overview | Lineup | Tactics | Rotations | Opponent context | Notes`.
- Match Details AFTER: `Overview | Events | Stats | Tactics | After match | Opponent context | History`.
- Post-Match Report DRAFT: `Summary | Timeline | Players | Reflection | Review`.
- Post-Match Report COMPLETED: `Summary | Timeline | Players | Reflection | Combinations`.

`Review` is not a Match Details tab in either state — it is a secondary header link into the
existing `/review` route (unchanged), matching the exact canonical golden.

### 3. Bounded, surface-scoped server read model

`src/lib/matches/get-match-detail-after-data.ts` is a new server-only loader, called **only** once
`deriveMatchDetailSurfaceState()` says `AFTER` — an upcoming match never pays for the post-match
query set. It is reused verbatim by `/post-match` (both routes read the exact same aggregated
facts — attendance, goal scorers, assist providers, timeline, player involvement — so there is
never a second interpretation of the same report). Every query is single-match-bounded; player/
guest names are batch-resolved once, not per row.

### 4. Timeline truth rule: real canonical linkage, not guesswork

The timeline (`buildMatchTimeline()` and friends, `match-detail-view-model.ts`) prefers persisted
`LiveMatchEvent` rows when any exist for the match, and pairs a `SCORER_SET`/`ASSIST_SET`
annotation event to its `GOAL_FOR`/`GOAL_AGAINST` event **only** via the stored `correctsEventId`
reference (confirmed in `live-match-domain.ts`'s `validateLiveEventInput`, the 2026-09-17 incident
fix) — never by array index, creation order, or timestamp proximity. When no live events exist for
a match (a manually-created report), the fallback builder renders each report `Goal` row
standalone with its stored minute and **never** pairs it to an `Assist` row — the Prisma schema
has no `Goal.assistId`/`Assist.goalId` linkage, so no such pairing can ever be proven from report
data alone. Assists are always available separately via `aggregateAssistProviders()`.

### 5. Player involvement minutes: real data, honestly bounded

`computePlayerMinutesFromIntervals()` sums closed (`endedAtMs` set) `ActualPositionInterval` rows
per player — real, already-persisted data, not a new statistic. A player with only open/never-closed
intervals is simply omitted from the minutes figure rather than assigned a guessed duration. Live
event minute labels use the raw within-period elapsed time directly (no cross-period cumulative
offset yet) — a disclosed, conservative simplification, not fabricated data; a future pass can
widen this using `getMatchTimingReviewItems()`'s own resolved period durations.

### 6. Reused lifecycle badge vocabulary, not literal golden text

The header badge reuses the existing `MatchLifecycleBadge`/`lifecycleStatusConfigFor()` vocabulary
(ADR-0101: "Planning open", "Planning closed", "Live", "Played", "Report incomplete", "Done",
"Cancelled") rather than the canonical golden's illustrative literal "UPCOMING"/"COMPLETED"
strings — the implementation bundle itself names this as the accepted equivalent. Post-Match
Report's own header badge ("Report draft" / "Completed") is that surface's own real state name
(`02_PRODUCT_MODEL_AND_LIFECYCLE.md` "Surface B"), a different, deliberate vocabulary from Match
Details' lifecycle badge — not a second labelling of the same state.

### 7. Lineup vs. Tactics: a disclosed, reasoned split

No golden visual authority distinguishes "Lineup" tab content from "Tactics" tab content beyond
their rail labels (only the tab rail itself is visible in the canonical image). `Lineup` owns the
existing, completely unchanged `MatchTacticsPanel` (pitch/formation/assignment editor, `Suggest
lineup`, etc.). `Tactics` owns coaching intent and match-format reasoning
(`CoachingIntentSelector`, `MatchFormatOverrideControls` — both existing components, previously
homed in the old page's general meta card) plus a read-only formation summary. Neither forks or
duplicates the pitch renderer.

### 8. Match administration relocated, not removed

`MatchEditForm` (kickoff/date editing) and the cancel-match control are unchanged but moved from
the old page's always-visible meta card into the new `Notes` tab's "Match administration" section
— the canonical golden's header has no room for an inline edit form, and the golden's own written
spec permits an overflow-menu-style secondary placement. `MatchHelpersPanel`/`LeagueMatchGuestsPanel`
move alongside it for the same reason.

### 9. Team notes gain a real editor

`Match.notes` had no dedicated mutation before this ADR (`match-detail.tsx` only ever rendered it
read-only) — the canonical golden's "Add note" action needed a real one. `updateMatchNotesAction()`
(`src/app/(app)/matches/actions.ts`) is a small, additive server action using the exact same
actor/tenant/group-access gate as every other match action in that file.

### 10. `match-detail.tsx` removed, not kept as a compatibility shim

The former monolithic client component (879 lines, zero existing test coverage) is deleted outright
— a full consumer-count audit found zero remaining importers once `page.tsx` was repointed at
`MatchDetailShell`. `src/components/matches/match-detail/` (11 leaf components) plus
`match-detail-tabs.ts`/`match-detail-view-model.ts`/`get-match-detail-after-data.ts`/
`match-detail-format.ts` replace it.

## Consequences

- Match Details' information architecture now changes with the match's real lifecycle instead of
  showing the same six tabs whether the match is next week or three seasons ago.
- Post-Match Report gained real tab navigation and a Summary/Timeline reconciliation view built
  from already-loaded facts, while every existing mutation workflow
  (`PostMatchPage`/`PostMatchReportShell`, `TeamReflectionSection`, `FootballObservationSection`,
  `ObservationSection`, `LegacyMatchFeedbackSection`, `MatchCombinationEvidencePanel`) is reused
  completely unchanged, just relocated within the new tab tree.
- `PostMatchUnresolvedBanner`'s local-outbox classification is now shared, not duplicated, via the
  new `useUnresolvedLiveActionState()` hook (`src/components/live-match/`) — the banner's own
  behaviour and every existing test for it are unchanged.
- Two disclosed, deliberate scope reductions, matching this repository's "prefer zero new queries,
  disclose the trade-off" precedent (ADR-0136 §17/§19/§23): no cross-period cumulative live-event
  minute math yet (§5 above), and no popover overflow menu (secondary match administration is a
  relocated tab section instead of a dropdown, since no dropdown primitive existed to reuse and
  building one was out of this pass's scope).
- No domain, selection, fairness, evidence, security, or tenancy semantics changed. No schema
  migration. No Player of the Match, MVP, player rating, possession, shots, corners, cards, xG, or
  synthesized opponent-level value was added anywhere in this surface.
- Supersedes ADR-0136 §19's "every existing tab... frozen" scope statement for Match Details (that
  statement is historical and accurate for the Phase 4 pass it describes; this ADR is the
  follow-up pass that Phase 4 explicitly deferred). `docs/domain/touchline-atlas-provenance.md`
  gains a short dated follow-up note rather than a rewrite of its historical §19 entry.

## Follow-up (2026-09-18): production feedback — Lineup/Tactics consolidation and two real timeline bugs

Real prod usage immediately after merge surfaced three issues, all fixed in the same follow-up
pass:

### 11. Before-match Overview's "Planned lineup" never actually showed a lineup

The original Overview embedded only a formation-name/filled-count summary widget
(`before-match-planning-area.tsx`), not the real pitch — a coach reported it as effectively
useless. At the same time, the by-then-thin "Tactics" tab (coaching intent + match format only,
since the pitch editor itself already lived on "Lineup") was judged not to deserve its own tab
click. Resolution, at the requester's explicit direction: **both "Lineup" and "Tactics" are
removed as separate before-match tabs; `Overview` now embeds the real, completely unchanged
`MatchTacticsPanel` (editable pitch/formation/squad) directly, alongside the coaching-intent and
match-format content that used to live on the Tactics tab.** Before-match tabs are now `Overview |
Rotations | Opponent context | Notes`. `before-match-planning-area.tsx` and
`before-match-tactics-tab.tsx` are deleted (fully superseded, zero remaining consumers). The same
fix was applied to the after-match Overview's "Final lineup" widget (same underlying bug, same
component, now read-only via `planningEditable={false}` — matching the existing "Tactics" AFTER
tab's own treatment, which is retained since the golden explicitly names it as a real AFTER tab
unlike the before-match case).

### 12. Every goal showed "Unattributed" in the completed report — a real, since-launch bug

Root cause, confirmed against real production data (Neon prod branch, a real `LOCKED` match with
10 goals and 8 assists, every one carrying a real `playerId`): `buildMatchTimelineFromLiveEvents()`
matched a `SCORER_SET`/`ASSIST_SET` event's `correctsEventId` against its target `GOAL_FOR`/
`GOAL_AGAINST` event's database `id` — but a real annotation event's `correctsEventId` references
the goal's **`clientEventId`** (a distinct, client-generated string), never its database id. The
two never matched, so every goal's scorer/assist lookup silently missed and fell through to the
honest-but-wrong "Unattributed"/no-assist state. (A second, superficially similar field —
`EVENT_REVERSED.correctsEventId` — genuinely does reference the target's database `id`; confirmed
separately against real reversal rows. The two `correctsEventId` conventions differ by event kind,
which is exactly what made this easy to get wrong once and not clearly wrong from reading the code
alone.) Fixed by selecting and threading `clientEventId` through
(`MatchCanonicalLiveEventFact.clientEventId`) and matching on it instead of `id`. New unit tests
assert both the correct pairing and that matching on `id` (the bug) is rejected.

### 13. Completed-report events read as "sorted by type," not by time

Root cause, confirmed against the same real match: roughly half its `LiveMatchEvent` rows (every
`ROTATION_OUT`/`ROTATION_IN` pair, all written via the still-partially-active legacy direct-HTTP
path — ARR-0045) have no coordinator-assigned `sequence`. The query's `ORDER BY sequence ASC,
createdAt ASC` — Postgres/Prisma default `NULLS LAST` — pushed every unsequenced row to the very
end of the result set as one cluster, after even `MATCH_END`, regardless of when it actually
happened; since unsequenced rows were overwhelmingly one event kind (rotations) in this match, the
visible symptom read as the whole timeline being grouped by event type. Fixed with a new pure
sort, `timelineSortKey()`, applied inside `buildMatchTimelineFromLiveEvents()` itself rather than
trusted from the DB query: orders by `(period, within-period matchSeconds)` — fields every rendered
event kind carries regardless of write path — with `PERIOD_START` sorting first and `PERIOD_END`
last within its period, and `MATCH_END` after everything. New unit tests cover out-of-order input
with missing period/boundary fields.

No domain, selection, fairness, evidence, security, tenancy, or schema semantics changed in this
follow-up. Version bump: patch-and-IA-change classified as minor per `docs/VERSIONING.md`
("meaningful navigation/information-architecture changes").
