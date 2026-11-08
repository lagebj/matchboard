# Gate B W5 — Transition and Navigation Contract (B08)

**Updated for the W5 remediation (independent PR #822 review, 2026-11-08).** The full lifecycle
transition table from the task brief, each row stated against the real implementation and the test
that verifies it. Two rows previously marked "disclosed gap" are now fixed — see the changelog at
the bottom.

| From | Action | Destination | Implemented | Verified by |
|---|---|---|---|---|
| BEFORE | Open Live Reporting | LIVE reporter workspace | Real `Link` → `/live`, reproducing `match-detail-shell.tsx`'s own shell-level CTA | `before/__tests__/page.test.tsx`, `e2e/ui-lab-b08.spec.ts` |
| LIVE | Return to match | Same match context | Real `Link` back to `/before` | `live/__tests__/page.test.tsx`, `e2e/ui-lab-b08.spec.ts` |
| LIVE | Finish reporting | REPORT-DRAFT | **FIXED (P2-7):** the real `LiveMatchClient.handleEndSession()` already navigates via `actions.reportUrl()` once `endSession()` returns a `reportId` — B08's fixture supplies both. "Finish live reporting" → confirm → real `window.location.href` navigation to `/report-draft`. The prior "known gap" claim here was stale documentation, not a real limitation; corrected. | `e2e/ui-lab-b08.spec.ts` ("LIVE-to-report continuity" suite) |
| AFTER | Continue report | REPORT-DRAFT | Real `Link` → `/report-draft` (page-level primary CTA) | `after/__tests__/page.test.tsx`, `e2e/ui-lab-b08.spec.ts` |
| REPORT-DRAFT | Return to match | Same match, preserving context (and the CURRENT status — see P1-5 below) | Real `Link` → `/after` (draft) or `/after?report=completed` (once locked in place) — reactive via `SafePostMatchReportShell`'s `backHrefForStatus`/`onStatusChange` props | `report-draft/__tests__/page.test.tsx`, `e2e/ui-lab-b08.spec.ts` |
| REPORT-DRAFT | Complete report | REPORT-COMPLETED state | Real fixture-local `useSafeReportLifecycle.complete()`, gated on the timing-review blocker actually resolving first | `report-draft/__tests__/page.test.tsx`; capture interaction `resolved-completion-transition`; `e2e/ui-lab-b08.spec.ts` |
| REPORT-COMPLETED | Back to match | AFTER, showing the COMPLETED state | **FIXED (P1-5):** real `Link` → `/after?report=completed` — AFTER reads the explicit `?report=` variant switch and renders `b08AfterData("completed")` instead of its own default draft/incomplete variant. Previously this linked to plain `/after`, which always showed "report incomplete" even immediately after locking the report — a real, now-fixed contradiction. | `report-completed/__tests__/page.test.tsx`, `after/__tests__/page.test.tsx`, `e2e/ui-lab-b08.spec.ts` |
| REPORT-COMPLETED | Reopen, where allowed | Explicit editable report state | Real `useSafeReportLifecycle` "Reopen report" control, same gating B05 already demonstrates | Covered by the shared shell's own existing B05 tests (unchanged logic, reused verbatim) |

## P1-6 — LIVE-to-report continuity (new, real)

A real, sessionStorage-backed journey (`shared/b08-journey.ts`) distinguishes two modes without an
explicit flag: a direct visit to any B08 route (every CI/Playwright capture gets a fresh browser
context — `scripts/ui-lab-visual-review.mjs` creates and closes a new `browser.newContext()` per
scenario/viewport/theme) always reads an empty/absent journey and renders the unchanged canonical
reference fixture. A real interactive session that records an event on LIVE and clicks "Finish live
reporting" persists it; REPORT-DRAFT derives its own goals/assists/score from what was ACTUALLY
recorded (`b08GoalsAndAssistsFromJourney()`) instead of always showing the fixed canonical report.
An unfinished journey is never read by REPORT-DRAFT (no half-recorded session leaks in).

Verified for real in `e2e/ui-lab-b08.spec.ts`: finishing LIVE without recording the 48' winner
leaves REPORT-DRAFT showing a real 1-1 (not the fixed canonical 2-1); recording it live first
(`"Goal for us"` → `"Skip"`, the exact real production pattern `e2e/live-reporting.spec.ts` already
proves against the authenticated flow) carries it through as a real 2-1.

## Why REPORT-COMPLETED routes back to `/after` (with `?report=completed`), not a second "historical" page

The task brief distinguishes "back to the appropriate report-entry flow" (AFTER) from "back to the
historical Overview" only because production itself treats both `report_incomplete` and `done` as
AFTER-eligible lifecycle statuses rendering the same `AfterMatchOverview` composition
(`CURRENT_STATE_AUDIT.md` §1). B08-AFTER's candidate now represents BOTH real AFTER states (draft
and completed) through the same composition, switched by the explicit `?report=` query param — one
Match Details surface, not a second, disconnected interpretation of the same match. ADR-0147's "one
Match Details composition per lifecycle state" is preserved; no third composition was introduced.

## Origin preservation

- **Match identity origin** (the same canonical match stays in scope): true throughout — all five
  pages import from the one shared `fixture.ts`/`fixture-history.ts` module, never a second
  identity.
- **Navigation origin** (League/Event/Today/Round Board): B08-BEFORE links back to B06's existing
  League Match Details navigation-origin stand-in
  (`/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details`) rather than inventing a new
  generic Fixtures destination. Per the task brief's explicit non-goal, **no new Event Match
  Details route was built** — Event's own origin asymmetry (no dedicated Match Details route; lives
  inside Event Detail's Matches tab) is documented, not re-solved, reusing B06's own comparison
  scaffold as the authority (`CURRENT_STATE_AUDIT.md` §6).

## URL and tab behavior

- Report DRAFT defaults to `players`; COMPLETED defaults to `summary` — both are production's own
  real `match-detail-tabs.ts` defaults, reused verbatim via the real `SafePostMatchReportShell`, not
  reimplemented.
- `?tab=review` is a real DRAFT-only tab; COMPLETED replaces it with `combinations`. Production's
  real `resolvePostMatchReportTab()` already falls back to each surface's own default for an unknown
  or cross-surface tab key (`CURRENT_STATE_AUDIT.md` §2) — now also verified directly in a real
  browser: `e2e/ui-lab-b08.spec.ts`'s "an invalid report tab falls back to the real default without
  showing stale content, once locked" test visits `/report-completed?tab=review` and asserts the
  stale Review content never renders.
- Pinned-tab-survives-completion (`?tab=players` remaining selected after completion): the same real
  guarantee B05's own `post-match-report-page-shell.test.tsx` already covers for the shared
  component B08 reuses unchanged; also exercised for real in `e2e/ui-lab-b08.spec.ts`'s reload/
  browser-Back test.
- Reload and browser Back on REPORT-DRAFT: verified for real in a browser (`e2e/ui-lab-b08.spec.ts`)
  — select a different tab, reload, confirm the selection survives; browser Back returns to the
  prior tab's URL.

## RESOLVED — LIVE "Finish reporting" navigation (previously documented as a gap)

**This section previously claimed `LiveMatchClient` has no "navigate on session end" behavior and
that a true Finish → Report transition was not built.** That was incorrect, stale documentation —
confirmed by reading `handleEndSession()` directly: it calls `actions.endSession(sessionId)`, and if
`result.data?.reportId && actions.reportUrl` it navigates via `window.location.href =
actions.reportUrl(result.data.reportId)`. B08's fixture-local `endSession()` already returns a
`reportId`, and `reportUrl()` already returns `/report-draft` — the transition was already
functionally correct; only this document's own claim about it was wrong. Corrected above and
verified for real in `e2e/ui-lab-b08.spec.ts`.

## RESOLVED — the `MatchAfterMatchPanel` secondary link (previously disclosed, not fixed)

**Previously:** `after/page.tsx`'s reused `MatchAfterMatchPanel` rendered its own secondary
"Continue report"/"View full report" link via the real `orgUrl()` helper, resolving to a
production-shaped `/o/.../matches/.../post-match` URL that doesn't exist inside the UI Lab.

**Now:** `MatchAfterMatchPanel` takes a new, optional, backward-compatible `reportHrefOverride`
prop (same pattern as `SafePostMatchReportShell`'s pre-existing `backHref`) — defaults to the exact
prior `orgUrl(...)` behavior for every production call site (verified: only
`match-detail-shell.tsx` calls it in production, and it does not pass this prop). B08-AFTER passes
its own fixture-local `/report-draft` or `/report-completed` route depending on the current
`?report=` variant. Every visible report link on B08-AFTER now resolves inside the UI Lab — no
production-shaped fixture links remain reachable. Verified in `after/__tests__/page.test.tsx` and
`e2e/ui-lab-b08.spec.ts`.
