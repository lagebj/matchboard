# Gate B W5 — Transition and Navigation Contract (B08)

The full lifecycle transition table from the task brief, each row stated against the real
implementation and the test that verifies it.

| From | Action | Destination | Implemented | Verified by |
|---|---|---|---|---|
| BEFORE | Open Live Reporting | LIVE reporter workspace | Real `Link` → `/live`, reproducing `match-detail-shell.tsx`'s own shell-level CTA (not `BeforeMatchOverview`, which only receives a boolean — `BLOCKERS.md` item #3's BEFORE note) | `before/__tests__/page.test.tsx` |
| LIVE | Return to match | Same match context | Real `Link` back to `/before` | `live/__tests__/page.test.tsx` |
| LIVE | Finish reporting | AFTER or report-entry flow | Disclosed scope limit — see "Known gap" below | — |
| AFTER | Continue report | REPORT-DRAFT | Real `Link` → `/report-draft` (page-level primary CTA) | `after/__tests__/page.test.tsx` |
| REPORT-DRAFT | Return to match | Same match, preserving context | Real `Link` → `/after` via `SafePostMatchReportShell`'s `backHref` prop | `report-draft/__tests__/page.test.tsx` |
| REPORT-DRAFT | Complete report | REPORT-COMPLETED state | Real fixture-local `useSafeReportLifecycle.complete()`, gated on the timing-review blocker actually resolving first | `report-draft/__tests__/page.test.tsx`; capture interaction `resolved-completion-transition` |
| REPORT-COMPLETED | Back to match | Historical AFTER view | Real `Link` → `/after` (B08-AFTER itself already **is** the historical view once a report exists — no separate "historical" route was built; see note below) | `report-completed/__tests__/page.test.tsx` |
| REPORT-COMPLETED | Reopen, where allowed | Explicit editable report state | Real `useSafeReportLifecycle` "Reopen report" control, same gating B05 already demonstrates | Covered by the shared shell's own existing B05 tests (unchanged logic, reused verbatim) |

## Why REPORT-COMPLETED routes back to `/after`, not a second "historical" page

The task brief distinguishes "back to the appropriate report-entry flow" (AFTER) from "back to the
historical Overview" only because production itself treats both `report_incomplete` and `done` as
AFTER-eligible lifecycle statuses rendering the same `AfterMatchOverview` composition
(`CURRENT_STATE_AUDIT.md` §1). B08-AFTER's own candidate is built around the `"draft"` fixture
variant; a genuinely separate "B08-AFTER-historical" page would be a second, disconnected
interpretation of the same match purely to satisfy a naming distinction the real component
hierarchy does not have. Documented here as a deliberate choice, not an oversight.

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
  or cross-surface tab key (`CURRENT_STATE_AUDIT.md` §2) — B08 reuses this real fallback via the
  same shared shell rather than reimplementing tab resolution. This exact fallback behavior is
  already covered by the shared shell's own existing B05 test suite (same component, same
  resolver); a dedicated `?tab=review`-after-lock **browser capture** was deliberately not added as
  a sixth B08 capture scenario (see `VISUAL_VS_CURRENT.md`) because the spec's own guidance (§16)
  says not to mechanically expand capture coverage once equivalent behavior is already proven — here
  it is proven at the component-test level against the real resolver function, not re-derived.
- Pinned-tab-survives-completion (`?tab=players` remaining selected after completion): the same real
  guarantee B05's own `post-match-report-page-shell.test.tsx` already covers for the shared
  component B08 reuses unchanged.

## Known gap — LIVE "Finish reporting" does not auto-navigate to AFTER

The real `LiveMatchClient` component itself has no "navigate to AFTER on session end" behavior —
that redirect is owned by the production adapters (`league-live-match-client.tsx`/
`event-live-match-client.tsx`), which B08-LIVE deliberately bypasses (mounting `LiveMatchClient`
directly with fixture-local actions, per `BLOCKERS.md` item #3's resolved decision). Calling the
fixture-local `endSession()` action therefore ends the session locally but does not itself route the
coach to `/after`; B08-LIVE's own breadcrumb link back to `/before` remains the real, working return
path, but a true "Finish reporting → AFTER" **transition action** (as opposed to a manual breadcrumb
click) was not built, since reproducing it correctly would mean reimplementing one of the two real
production adapters' own post-session routing logic — out of this wave's scope (spec §12/§19).
Recorded here as a disclosed gap, not fabricated as working.

## Known gap — disclosed, not fixed

`after/page.tsx`'s reused, unmodified `MatchAfterMatchPanel` component renders its own secondary
"Continue report"/"View full report" link via the real `orgUrl()` helper, which resolves to a
production-shaped `/o/.../matches/.../post-match` URL — not this candidate's own `/report-draft`
route. The **page-level primary** "Continue report" CTA (the one actually driving the AFTER →
REPORT-DRAFT transition this contract tracks) is correctly wired to `/report-draft`; this is a
second, secondary link inside a reused real production component whose target simply doesn't
resolve inside the UI Lab. Fixing it would mean threading a new prop into a shared production
component beyond this wave's scope (see `BLOCKERS.md`) — recorded as a verified production
dependency, not silently patched.
