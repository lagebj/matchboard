# Gate B W5 — Transition and Navigation Contract (B08)

**Updated for the W5 THIRD remediation (independent review, 2026-11-08, "final data-integrity
remediation").** The full lifecycle transition table from the task brief, each row stated against
the real implementation and the test that verifies it. Several rows previously marked "disclosed
gap" are now fixed — see the changelogs at the bottom. The second pass's biggest change: AFTER
and REPORT-COMPLETED now participate in the SAME persisted-report priority cascade REPORT-DRAFT
already used after the first remediation — see "The shared data-consistency cascade" below. This
third pass's biggest change: that cascade's own tier 1 (a persisted report) now resolves its real
chronology by an explicit `historyOrigin`, not by inferring it from an event array's own emptiness
— see "History provenance" below, and Journey C (a real browser Undo) is no longer a disclosed gap.

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

## The shared data-consistency cascade (W5 second remediation)

The first remediation pass (P1-6) made REPORT-DRAFT journey-aware but left AFTER and
REPORT-COMPLETED reading the static reference fixture regardless — so a coach could finish LIVE
with a 1-1 result, see 1-1 on the draft report, and then see the fixed 2-1 reference narrative on
AFTER. The independent review's own words: "B08 currently maintains two competing interpretations
of the match." Fixed: AFTER, REPORT-DRAFT and REPORT-COMPLETED now all resolve their own data from
the SAME three-tier priority cascade, in order:

1. **A persisted, reconciled report** (`loadB08JourneyReport()`) — the coach already
   edited/completed this exact report in an earlier visit on REPORT-DRAFT. Resume/display it
   EXACTLY — authoritative over everything else, including AFTER's own `?report=` URL param (a URL
   can select a presentation state but cannot override the real stored lifecycle — see the
   independent review's own explicit requirement). Its own real chronology is resolved by
   `historyOrigin`, not re-derived from the raw event array (see "History provenance" below) — a
   direct edit of the reference report keeps the real canonical chronology; a LIVE-seeded report
   keeps what was actually recorded.
2. **A finished LIVE journey with no reconciliation yet** (`loadFinishedB08JourneyEvents()`) —
   seed from what was ACTUALLY recorded, reversal-aware
   (`shared/b08-projection.ts`'s `computeEffectiveLiveEvents()`/`deriveGoalsAndAssists()`/
   `deriveEffectiveScore()` — a reversed goal correctly seeds nothing).
3. **No journey at all** (every direct visit, including every CI/Playwright capture) — the
   unchanged canonical reference fixture, exactly as before either remediation pass. AFTER's own
   `?report=` URL switch behaves exactly as the first remediation pass left it, ONLY in this tier.

Real edits on REPORT-DRAFT (`onStateChange`) persist back into the same slot, so AFTER and
REPORT-COMPLETED read the identical reconciled record the next time they're opened — one
authoritative projection, not three independently-plausible pages.

Verified end-to-end in a real browser (`e2e/ui-lab-b08.spec.ts`, Journeys A/B): finishing LIVE
without recording the 48' winner shows a real 1-1 continuously through REPORT-DRAFT → completion →
AFTER → REPORT-COMPLETED → a page reload; recording it live first (`"Goal for us"` → `"Skip"`, the
exact real production pattern `e2e/live-reporting.spec.ts` already proves against the authenticated
flow) carries a real 2-1 through the identical chain. Journey E proves the reference fixture stays
genuinely isolated: a fresh context always sees the unchanged 2-1 reference on AFTER/REPORT-COMPLETED
directly, and using the real "Reset journey" dev control after an interactive journey restores it.
Journey D (third remediation) proves the SAME consistency holds for a direct, reference-mode edit
(no LIVE journey at all) — the real 10'/22'/48' chronology stays intact through REPORT-DRAFT's own
Timeline tab, AFTER's Events/Stats tabs, and REPORT-COMPLETED's Timeline tab, not just its score.

### History provenance (`historyOrigin`, third remediation)

Tier 1 above (a persisted report) previously derived its chronology from whatever raw event array
happened to be in storage — but a reference-mode edit (REPORT-DRAFT without ever visiting LIVE)
legitimately has NO such array; `saveB08JourneyReport()` wrote `events: []`, and AFTER/REPORT-
COMPLETED then derived an EMPTY timeline from it, discarding the real canonical chronology entirely.
`b08-journey.ts` v3 adds `historyOrigin` (`"REFERENCE"` | `"LIVE_JOURNEY"`), set once by whichever
write happens first and never silently changed by a later report edit;
`shared/b08-projection.ts`'s `resolveB08EffectiveHistory()` is the one place every page now resolves
the real chronology/goal-count/team-note by it — `"REFERENCE"` (or no journey at all) always returns
the unchanged canonical history, `"LIVE_JOURNEY"` returns what was actually recorded. LIVE's own
`initialLiveEvents()` had the identical blind spot in reverse (a reference-origin report's `events:
[]` looked exactly like a resumed, empty LIVE session) and is fixed the same way. Proven directly,
with literal expected values, in `b08-projection.test.ts`'s own `resolveB08EffectiveHistory`
describe block and `report-draft/__tests__/page.test.tsx`'s new describe block, and end-to-end in a
real browser by Journey D above.

### Reversal and duplicate-event semantics

`computeEffectiveLiveEvents()` mirrors the REAL production algorithm (`get-match-detail-after-data.ts`)
exactly: a reversed `GOAL_FOR`/`GOAL_AGAINST` event is excluded from every downstream derivation —
score, goals/assists, timeline — matching the reporter's own real `LiveMatchClient` score exactly
even after a real "Undo." Proven with literal expected values (not a self-comparison) in
`shared/__tests__/b08-projection.test.ts`, including a dedicated negative test confirming the two
real correction-reference namespaces (`EVENT_REVERSED` → target's own `id`; `SCORER_SET`/
`ASSIST_SET` → the goal's `clientEventId`) are genuinely distinct, not interchangeable.

**Now also proven as a real browser test (Journey C, third remediation)** — the second remediation's
own disclosed reason for not testing this (a real timing risk: `LiveMatchClient.handleUndo()` can
target a Recent Events row still on the local overlay, whose own `id` is a `clientEventId`, not yet
the real stored id) is closed, not merely avoided: `recordEvent()` in `safe-transition-controller.ts`
now normalizes an `EVENT_REVERSED`'s `correctsEventId` to the real target id even when submitted
against a `clientEventId`, proven directly in `safe-transition-controller.test.tsx`. Journey C
records a goal, Undoes it through the real mounted `LiveMatchClient`'s own Recent Events panel, and
verifies reporter/follower agreement before and after, plus downstream non-resurfacing through
REPORT-DRAFT/AFTER/REPORT-COMPLETED/reload.

### Idempotent event recording (`recordEvent()`, third remediation)

`recordEvent()` previously always generated a fresh id and appended a new row, with no check against
an already-accepted `clientEventId` — a genuine retry (reconnect, reload mid-send, a resent command)
would have silently double-counted a goal/correction/reversal. Fixed to mirror production's own real
contract exactly (confirmed against `LiveMatchClient`'s own `reconcileOutboxWithServer()` doc
comment: "a resend is dedup-safe server-side by clientEventId") — an identical retry is a no-op
(returns the already-accepted real id), a conflicting one (same `clientEventId`, different content)
is rejected outright, never silently appended or silently overwritten. Proven with the full required
matrix (new goal, identical retry, reload+retry, conflicting retry, two distinct goals, reversal
retry, scorer-correction retry, distinct assist) in `safe-transition-controller.test.tsx`.

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
