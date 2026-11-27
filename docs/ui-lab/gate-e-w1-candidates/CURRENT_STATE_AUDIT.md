# Gate E W1 — Current State Audit

Scope: the production League surface (ADR-0144), audited against E01's acceptance question
("Current planning round identifiable among historical/upcoming; period navigation + context
restoration", XR-T01/XR-S02).

## What already exists in production

| Requirement | Production capability | Presentation gap |
|---|---|---|
| Canonical League route | `/o/{orgSlug}/fixtures` (`src/app/(app)/o/[orgSlug]/fixtures/page.tsx`) → `FixturesPage` → `LeagueSurface`. | None — this is the real, already-shipped composition. |
| Temporal "current round" fact | `buildLeagueOperatingViewModel()` (`src/lib/touchline/presentation/league-view-model.ts`) classifies CURRENT/PAST/FUTURE/UNSCHEDULED from real kickoff dates in the Europe/Oslo display ISO week (ADR-0144, replacing the old "first non-finalized round" guess). | None — already a real temporal fact, not a selection-state guess. |
| Season rail (period-wide week-by-week state) | `LeagueSeasonRail` renders one slot per ISO week across `LeagueSeason.startDate`/`endDate`, with EMPTY/FINAL/NEEDS_CLOSURE/CURRENT/ATTENTION/UPCOMING states conveyed by marker + text. | None. |
| Per-match operational issue | `resolveMatchIssue()` resolves exactly one priority-ordered issue (CANCELLED > BLOCKED > DECISION_REQUIRED > REPORT_MISSING/INCOMPLETE > DONE > TACTICS_MISSING > LIVE > READY). | None. |
| Compact recent/earlier history | `LeagueRecentRounds` (max 2) + `LeagueEarlierRounds` (collapsed disclosure). | None. |
| URL as selection authority | `season`/`round` query params, no separate client selection state. | None. |
| Period switching | `FixturesPage`'s `<select>` + `handleSelectPeriod()`. | None. |
| Context preservation to Season Review | "Review season" link, deep-linked with the active league season (ADR-0157 slice C7). | None. |

**Every piece of domain/presentation logic E01 needs already exists and is already wired in
production.** This is unlike Gate A's `match-preparation` (self-fetching, not fixture-injectable
without a seam) — `buildLeagueOperatingViewModel()` is explicitly documented as "Pure, DB-free"
and `LeagueSurface` takes a plain `viewModel` prop with no internal fetch.

## The one real integration gap

`FixturesPage` (the actual route-mounted component) is **not** directly reusable as a UI Lab
fixture host: it self-fetches via the `fetchFixturesOverview()` Server Action and wires a real
mutation (`fixturePopulateAllAction`, "Generate all draft squads") that must never be invoked from
synthetic UI Lab controls (mission brief §11).

**Resolution:** a new, small, fixture-safe presentation seam —
`src/app/dev/ui-lab/gate-e/shared/league-fixture-mount.tsx` — that reproduces
`FixturesPage`'s non-fetching URL-state orchestration (the exact same `season`/`round` query-param
logic) verbatim, including its real `TouchlinePageHeader`/`TouchlineButton` header composition
(an independent review initially found this reimplemented as hand-rolled markup instead; corrected
— see `REVIEW_RECORD.md` BLK-E01-05), and calls the real, unmodified
`buildLeagueOperatingViewModel()` + `LeagueSurface` with injected fixture `FixturePeriod[]` data.
This mirrors the Gate C W3 / Gate D W2 "actions-override mount" precedent exactly — a thin seam
around a self-fetching composition, not a second implementation of League. Only one mutation
control ("Generate all draft squads") is omitted from the mount, since there is no safe way to
represent it without a real Server
Action.

## Known, already-tracked residue this wave surfaces but does not fix

`buildLeagueOperatingViewModel()`'s own `buildFocusedRound()` hardcodes
`href: /matches/${m.id}` and `roundBoardHref: /rounds/${round.id}` — bare, unscoped paths, not the
org-scoped `/o/{orgSlug}/...` shape the rest of the app uses. This is **ARR-0035** ("Unscoped
internal route links remain outside the org-prefixed routing model"), which already lists
`src/components/fixtures/fixtures-page.tsx` by name in its open-residue file list. Nothing in this
wave fixes, works around, or masks that residue — the UI Lab candidate renders the real hrefs as
production actually produces them, and `e2e/ui-lab-gate-e.spec.ts` verifies they still resolve
correctly through `redirectToOrgSlug()`'s existing shim to the real auth boundary. See
`BLOCKERS.md`.

## Classification

E01 is **`IMPLEMENTED_WITH_PRESENTATION_GAP`** — a real, already-shipped, pure production
composition whose only gap is the self-fetching route wrapper, closed here with a fixture-safe
mount. No new domain capability, no directional/speculative presentation, no production change.
