# Gate B W5 — Current State Audit (B08)

Grounded in the real repository at branch base `dc772b2aa` (PR #811, Gate B W4/B07, merged). Every
path below was read directly before any fixture or component decision was made. This audit covers
implementation Steps 1 only (current-state mapping); the ownership classification itself is in
`INFORMATION_OWNERSHIP_MATRIX.md` (Step 2).

## 1. The two independent lifecycle surfaces (ADR-0147, unchanged by this wave)

- **Match Details** (`src/app/(app)/.../matches/[matchId]/page.tsx` → `MatchDetailShell`,
  `src/components/matches/match-detail/match-detail-shell.tsx`, 623 lines): `BEFORE` / `AFTER`,
  derived by `deriveMatchDetailSurfaceState()` (`src/lib/matches/match-detail-view-model.ts`):
  `played`/`report_incomplete`/`done` → `AFTER`; `planning_open`/`planning_closed`/`live`/
  `cancelled` → `BEFORE`. A live session deliberately stays on the `BEFORE` composition — only the
  primary action's label changes, via `livePrimaryAction`/`describeLiveReportingEntryPointLabel()`
  (ADR-0152 §1/§12). There is no third composition anywhere in the shell's own prop surface.
- **Post-Match Report** (`/post-match` → `PostMatchReportPageShell`,
  `src/components/matches/match-detail/post-match-report-page-shell.tsx`, 177 lines): `DRAFT` /
  `COMPLETED`, derived by `derivePostMatchReportSurfaceState()` (`src/lib/matches/
  match-detail-tabs.ts`): `LOCKED` → `COMPLETED`; everything else, including `REPORTED`, → `DRAFT`
  (ADR-0003: no routine "reported-but-not-locked" visible state).

These remain two separate route trees, two separate state enums, exactly as ADR-0147 decided. B08
must not merge them or invent a third `LIVE` Match Details composition — confirmed nothing in the
current codebase does either.

## 2. Exact current tab sets — verified against `match-detail-tabs.ts`, no mismatch found

| Surface | Tabs (code) | Default |
|---|---|---|
| Match Details BEFORE | Overview, Rotations, Opponent context, Notes | `overview` |
| Match Details AFTER | Overview, Events, Stats, Tactics, After match, Opponent context, History | `overview` |
| Post-Match Report DRAFT | Summary, Timeline, Players, Debrief (`?tab=reflection`), Review | `players` |
| Post-Match Report COMPLETED | Summary, Timeline, Players, Debrief (`?tab=reflection`), Combinations | `summary` |

This matches the B08 task brief's §3 table exactly, including the DRAFT-defaults-to-`players`
rule (ADR-0147 §1a, e2e-proven) and the pinned-default-survives-completion rule (§1b). The tab
label is "Debrief" in the UI; the URL key (`reflection`) is unchanged from before the ADR-0152
Slice 2b rename — B08 must use `reflection` in any `?tab=` link, not `debrief`.

`resolveMatchDetailTab()`/`resolvePostMatchReportTab()` fall back to each surface's own default
for any unknown or cross-surface tab key (e.g. `notes` requested while AFTER) — B08's "tab becomes
invalid after a lifecycle transition" test target (spec §7) is this existing fallback, not new
logic to write.

## 3. Match Details AFTER composition — what Overview already owns vs. the dedicated tabs

`AfterMatchOverview` (`src/components/matches/match-detail/after-match-overview.tsx`, 276 lines)
owns, in order (confirmed against the W4 audit and this component's own imports): result/header
identity, team note, **Match story** (timeline + shape changes — via `match-flow-panel.tsx`,
`what-this-match-added-panel.tsx`), **Key figures**, Player involvement, Final lineup (read-only
`MatchTacticsPanel`), **Plan vs reality** (`plan-vs-reality-panel.tsx`), Match flow, **Coaching
intent review** (intent category/note + embedded `CompletedMatchAdvisorPanel`), "What this match
added," Reflection/Notes/Report-status.

Separately, the AFTER tab rail owns:
- **Events** (`match-events-panel.tsx`, 24 lines — a thin wrapper, almost certainly rendering
  `MatchTimelineList` against `liveAfterData.timeline` directly, i.e. the full canonical
  chronology `buildMatchTimeline()` produces).
- **Stats** (`match-stats-panel.tsx`, 83 lines).
- **After match** (`match-after-match-panel.tsx`, 73 lines).
- **Tactics** (read-only formation summary + coaching-intent/match-format controls, per ADR-0147
  §7/§11).
- **Opponent context** / **History**.

**Not independently verified in this pass, flagged for Step 4 implementation (not assumed either
way):** the exact field-level overlap between AfterMatchOverview's own "Key figures" sub-section
and the dedicated Stats tab's aggregate, and between Overview's "Reflection/Notes/Report-status"
sub-section and the dedicated "After match" tab. Both pairs are structurally the most likely
redundant-duplication candidates on this surface (same surface, same lifecycle state, two
components each independently rendering what reads like the same aggregate) and must be read in
full, side by side, before B08 writes its ownership matrix's final verdict — see
`INFORMATION_OWNERSHIP_MATRIX.md`'s explicit "unresolved" markers and `BLOCKERS.md`.

`get-match-detail-after-data.ts` (server-only) is the single bounded read model both Match Details
AFTER and `/post-match` consume **verbatim** (ADR-0147 §3 — "never a second interpretation of the
same report"): attendance, goal scorers, assist providers, timeline, player minutes/involvement,
reflection, football observations, opponent observation, combination evidence (LOCKED reports
only), goal-attribution gap, timing-review/out-of-range counts, shape-change rows, first-time
canonical positions. Every panel/tab above receives a slice of this one object — there is no
second query path computing the same facts differently. This is the strongest existing
anti-duplication guarantee B08 can build on and must not weaken.

## 4. Post-Match Report composition

- **Summary** (`post-match-summary-tab.tsx`) / **Timeline** (`match-timeline-list.tsx`, shared
  verbatim with Match Details Events) / **Players** (`PostMatchReportShell`, ARR-0034 — the one
  real mutation surface: goals/assists/attendance/score edits + `Complete report`) / **Debrief**
  (`PostMatchDebrief`, ADR-0152 §3) / **Review** (DRAFT only, plan-integrity) or **Combinations**
  (COMPLETED only, `MatchCombinationEvidencePanel`).
- `PostMatchReportHeader` renders the match identity/score/lifecycle badge once, at the top of the
  shell — not repeated per tab.

## 5. The B05 fixture-safe pattern B08 must reuse, not reimplement

`SafePostMatchReportShell` (`src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/
safe-post-match-report-shell.tsx`) is the exact JSX structure of production's
`PostMatchReportPageShell`, with every tab except Players rendering the real, unmodified
production components fed static/live-derived fixture data, and Players rendering the shared,
real `PostMatchReportShell` driven by a fixture-local reducer (`useSafeReportLifecycle`,
same directory — exposes `state.{status,goals,assists,players,ourScore,opponentScore,
completedBy,completedAt,timingReview,outOfRangeEventCount}` and `actions` for score/goal/assist/
attendance edits and `complete()`). All "live" derived facts (goal scorers, assist providers,
player involvement, attendance summary, the `MatchIdentityCard`'s own score) are recomputed from
`state` via the **same real pure functions** (`aggregateGoalScorers`, `buildPlayerInvolvement`,
`summarizeMatchAttendance`, …) — never hand-duplicated math. This is precisely the reconciliation
discipline spec §8 demands ("a successful local change updates all dependent presentation") and
the precedent to copy for B08-REPORT-DRAFT/-COMPLETED, parameterizing a new, B08-owned match
fixture rather than B05's.

`report-data.ts` (same directory) is the fixture-module shape to mirror for B08's own
`shared/fixture.ts`/`fixture-history.ts`: variant-aware (`draft`/`completed`) functions built on
the real aggregate functions, a hand-written literal for combination evidence (never computed
inline — see §7 below), and a real `MatchFormat`/period-relative-time contract
(`globalMinuteToPeriodRelative()`) matching `src/lib/live-match/period-config.ts`'s real encoding.

## 6. League/Event route asymmetry (confirmed, matches B06's own finding)

- League Match Details has a dedicated route (`match-detail-shell.tsx` above).
- Event has **no** dedicated Match Details route — Event matches live inside Event Detail's own
  Matches tab (`src/app/(app)/events/[eventId]/event-matches-tab.tsx`). There is no
  "EventMatchDetailShell" anywhere in the repository.
- Both League and Event live-reporting adapters (`league-live-match-client.tsx`,
  `event-live-match-client.tsx`) wrap the same shared `src/components/live-match/
  live-match-client.tsx` (2034 lines) — confirmed real parity at the live-reporting layer
  (ADR-0152 §1 "the shared `LiveMatchClient` component... League and Event both render it").
- Gate B W3 (B06) already built exactly the comparison scaffold B08 needs for its own
  "Event-origin parity, documented not re-solved" requirement:
  `src/app/dev/ui-lab/gate-b/b06-league-event-parity/{league,event}/{before,after}` plus two
  navigation-origin stand-ins (`league/match-details`, `event/event-detail`). B08 should reuse this
  pattern (a documented comparison, not a new Event Match Details route) rather than building a
  parallel one.

## 7. A real, load-bearing gotcha B08's shared fixture must respect

`report-data.ts`'s own doc comment (confirmed, not assumed): importing any **value** (not just a
type) from `combination-topology.ts`/`combination-aggregation.ts` pulls the server-only `db`/`pg`
client into a `"use client"` UI Lab page's bundle and breaks the production `Build` CI job
("Module not found: Can't resolve 'fs'/'net'/'tls'"). B05 works around this by hand-writing the
combination-evidence literal (verified in a separate test against the real derivation function) and
importing only the `CombinationEvidenceRow` **type**. B08's own shared fixture module must follow
the identical discipline for any server-derived value it needs (combination evidence, if reused for
REPORT-COMPLETED's Combinations tab).

## 8. Capture infrastructure

`scripts/ui-lab-visual-review.mjs` already supports per-scenario `viewports`/`themes` plus an
`interactions` array (named `perform` functions, optionally scoped to specific `interactionViewports`)
that captures a second screenshot in the same browser context after a deterministic action — this is
the existing mechanism spec §16's "interaction captures" require; B08 does not need a new capture
primitive, only new scenario entries.

## 9. Genuine production asymmetries/limitations disclosed here, not hidden

- Issues #691/#696 (ADR-0152/0158): Event has no `teamId`-equivalent, so qualitative evidence and
  the post-match-review context builder's `plan`/`playerContext`/`opponentHistory`/
  `recentTeamPatterns` sections are League-only. Any B08 Event-origin AFTER/Report candidate must
  disclose this rather than fabricate Event parity for Assistant Coach content.
  `CompletedMatchAdvisorPanel` itself (B07's reuse) is League/Event-generic at the component level,
  but its real content is materially thinner for an Event match.
  Non-goal #20 explicitly excludes implementing Event-origin AI parity in this wave.
- The AFTER Overview ↔ Stats / ↔ After-match field-level overlap (§3 above) is unresolved pending a
  full read of both components' bodies — tracked in `BLOCKERS.md`, not assumed redundant or
  assumed fine.
