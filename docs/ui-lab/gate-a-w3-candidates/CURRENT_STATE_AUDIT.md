# Gate A W3 — A03/A07/A09 Current State Audit

Package reference: `.matchboard-work/Matchboard_Gate_A_W3_A03_A07_A09_Agent_Bundle_2026-10-10/`
(external agent workspace, not committed). Base commit: `b6d932b98c5218b7f85d5101efc9cf5380437279`
(`main`, PR #778 already merged). Branch: `design/gate-a-w3-a03-a07-a09-context-local-actions`.

## Scope actually executed

Gate A W3 only — three UI Lab **candidates** (A03 decision anatomy, A07 Match Details edit
lineup, A09 Today quick action), dev-only, under `src/app/dev/ui-lab/gate-a/{a03-decision-
anatomy,a07-match-details-edit-lineup,a09-today-quick-action}/**`, plus one new cross-family
shared module set (`gate-a/shared/{fixture-identity.ts,fixture-operation.ts,match-w3-fixture.ts}`
— this wave's typed fixture-response port and shared match anchor, since none existed before: W1's
A01/A12 interactions are local-only and W2's A04 is read-only, confirmed by source audit before
building this), a narrow additive `scripts/ui-lab-visual-review.mjs` extension, and three new
entries in the existing Gate A index (`src/app/dev/ui-lab/gate-a/page.tsx`). No production route,
`src/domain/**`, production `src/components/**`, Prisma schema, auth/authz, or deployment file was
touched. W1's four approved candidates and W2's six `APPROVED_GOLDEN` A04 scenarios are unmodified
— re-confirmed by running the full `src/app/dev/ui-lab/gate-a` test suite (27 node-config files /
131 tests, 26 component-config files / 137 tests, all passing) after every family was built.

## Repository state found (independently re-verified against the live repo, not the bundle's dated claims)

- `src/components/matches/match-detail/match-detail-shell.tsx` preserves `?tab=` via
  `router.replace`; `MatchTacticsPanel` is self-fetching (confirmed) and not fixture-injectable —
  per the bundle's own `BLK-01`, A07 builds an isolated dev-only presentation candidate
  (`lineup-slot-editor.tsx`) from real shared Touchline primitives instead of prop-wrapping the
  shipped panel. It DOES reuse the real `TouchlinePlanningPitch`, `buildPlanningPitchSlotsFromFormationSlots`,
  and the canonical `primaryDisplayCellFor` (ADR-0154) for every tactical slot's grid position —
  no invented pitch coordinates.
- `src/app/(app)/matches/lineup-actions.ts`'s `assignPlayerToSlot` has **no optimistic-concurrency
  revision field** on `MatchLineupAssignment` — confirmed by direct read. A07-S4's "server
  conflict" is therefore disclosed as illustrative (`BLOCKERS.md` item 3), not a proof that
  production exposes this check today.
- `src/lib/selection/planning-boundary.ts`'s `isPlanningBoundaryClosed` real check order
  (cancelled → closed marker → live session ACTIVE → report started → `startsAt <= now`) is the
  one authoritative boundary; A07-S5/A09-S4's fixed clocks (`MATCH_W3_NOW_PLANNING_CLOSED`, 5
  minutes after the fixture's kickoff) mirror this real `startsAt <= now` instant check, not the
  coarser Europe/Oslo display-day boundary some other surface uses.
- `src/components/touchline/round-board/player-assignment-inspector.tsx` /
  `player-assignment-sheet.tsx` confirmed as the cleanest existing desktop-inspector/mobile-sheet
  reuse pattern (one shared body, sheet is a thin `TouchlineBottomSheet` wrapper, candidates carry
  server-supplied `reasons: string[]`, never invented). A07's `LineupSlotEditorBody`/`Inspector`/
  `Sheet` and A09's `TodayQuickActionBody`/`Inspector`/`Sheet` follow this exact shape.
- `src/components/matches/add-player-dialog.tsx` pre-filters candidates server-side and renders no
  excluded/ineligible rows at all — a different shape from Round Board's reasons-carrying model.
  A09 follows the Round Board shape instead (showing blocked candidates with their reasons), since
  the bundle requires visible denial reasons, not silent exclusion.
- `src/lib/matches/match-helper-eligibility.ts`'s `assertLeagueMatchHelperEligible` checks **only**
  match-not-cancelled, player active/not-removed, and not-already-a-participant — confirmed against
  ADR-0077's explicit exclusion list (round-finalisation and RSVP/time-conflict are deliberately
  NOT checked for League match-day additions, unlike the Event support-assignment path). A09-S6's
  Didrik candidate's `reasons` text mirrors this exact, narrow scope — it does not imply any
  broader permission than what this function actually checks.
- `docs/adr/0151-match-day-roster-changes-and-operational-participation.md`'s own `Status:` field
  still reads **Proposed**, even though several of its decisions (the `HelperProvenance` enum,
  the `/live/follow` fix, the formation `<select>` simplification, the 3-path "Add player" dialog)
  are already live in current source — a real doc/status mismatch, disclosed here rather than
  silently treated as settled policy. This wave does not resolve that mismatch; it only avoids
  relying on any ADR-0151 decision that isn't independently confirmed in shipped code.
- **Matchboard has no RSVP concept in source.** The closest canonical types are
  `AvailabilityStatus` (`AVAILABLE/UNAVAILABLE/INJURED/SICK/AWAY/TENTATIVE/UNKNOWN`) and
  `PlannedAbsenceReason` (`NO_SHOW/SICK/INJURED/DECLINED/NO_RSVP/OTHER/AWAY` — a manual, coach-
  selected post-match absence category, not an automated deadline-driven decline). No
  deadline-driven auto-decline logic exists anywhere in `src`. A09-S3's "RSVP deadline passed, no
  response" fixture is therefore explicitly labelled illustrative in `visual_vs_current/A09.md` and
  `BLOCKERS.md` item 1 — it does not claim Matchboard has this mechanism today.
- `docs/development/coding-agent-working-session.md` and `docs/agents/README.md`'s
  `ux-and-terminology.md`/`selection-planning-and-fairness.md`/`event-and-league-behavior.md`
  modules were read before implementation; no conflicting normative rule was found against this
  wave's scope (dev-only, read-only/simulated, no domain or schema change).

## Local capture-script limitation (disclosed, same pattern as the pre-existing `npm run build` sandbox limitation)

Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` could **not** be run to completion in
this session's sandbox: every page's client-side React never finishes becoming interactive — a
`useSearchParams()`-driven theme effect in the pre-existing `src/app/dev/ui-lab/ui-lab-frame.tsx`
never sets `data-theme`, and even a raw native `element.click()` dispatched via
`page.evaluate()` (bypassing Playwright's accessibility-tree-based `getByRole` entirely) does not
trigger a React `onClick` handler. The browser console shows the dev server's HMR WebSocket
repeatedly failing to upgrade (`net::ERR_INVALID_HTTP_RESPONSE`, retried continuously with a new
connection id each time) — this devcontainer's port-forwarding does not support the WebSocket
upgrade Turbopack's HMR client needs, and the resulting reconnect storm appears to starve React's
hydration/effect scheduling. **Confirmed pre-existing and unrelated to this PR's code:** the exact
same failure reproduces on `/dev/ui-lab/gate-a/a01-sports-first` — an untouched, already-merged W1
page, zero code changes. A freshly-restarted dev server (after killing a stale multi-day-old
`next-server` process) and a chromium reinstall did not change the result.

Consequently: **component/unit test coverage (vitest + jsdom) is the real verification signal in
this session** — it does not depend on real browser hydration and passed in full (see
"Validation" below). **Real screenshot capture is deferred to CI.** `capture-attestation.json` is
deliberately not included in this PR's first commit; it will be added in a follow-up commit
referencing the real `sourceCommitSha` and per-image SHA-256 once the PR's "UI Lab Visual Review"
GitHub Actions workflow (a clean, non-proxied runner) produces its artifact — the same two-commit
pattern W1/W2 used for their own attestations, not a new shortcut invented for this gap.

## Real bugs found and fixed while implementing (disclosed, not hidden)

1. **A07 dirty-draft-close discarded only visually.** Every A07 scenario's `close()` handler
   originally only hid the dialog (`setIsOpen(false)`) — it never called `op.discardDraft()`, so a
   discarded draft's state silently survived in the parent page's `useFixtureOperation` and
   reappeared if the editor was reopened. Found by the dirty-draft-close scenario's own test; fixed
   in all five A07 pages (`close` now calls `op.discardDraft()` before `setIsOpen(false)`).
2. **A09 shared component double-incremented the saved count.** `today-quick-action-sheet.tsx`
   originally computed `savedCount = currentCount + 1` for the SUCCESS display, but
   `useFixtureOperation`'s `authoritative` value is *already* the post-increment result by the time
   `status === "SUCCESS"` (the hook's own `applySuccess` reducer already applied it) — the display
   would have doubled 8→10 instead of 8→9. Fixed by rendering `currentCount` directly; the only
   place that still computes its own `+1` is the still-unsaved draft preview line, which genuinely
   has not been applied yet.
3. **A09 shared component had a duplicate, ambiguously-named "Discard draft" control.** One lived
   in the CONFLICT banner, one in the main action row — same accessible name, two different click
   targets. Fixed by removing the banner's own button and keeping the single canonical one in the
   action row.

## Validation run locally

- `npx tsc --noEmit -p tsconfig.json` (full project) — clean, 0 errors.
- `npx eslint src/app/dev/ui-lab/gate-a` — clean, 0 output.
- `npx vitest run src/app/dev/ui-lab/gate-a` (node config) — 27 files, 131 tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` (component
  config) — 26 files, 137 tests, all passing.
- `node --check scripts/ui-lab-visual-review.mjs` — syntactically valid.
- `npm run build` / full `npm run validate` — **NOT RUN locally**, same pre-existing sandbox
  limitation documented in W1/W2's own audits (reproduces on clean `main`, passes in real CI); CI
  will run them.
- Local browser capture — **NOT RUN to completion**, see "Local capture-script limitation" above;
  CI's "UI Lab Visual Review" workflow will produce the real artifact.

## Version impact

Classified **`none`** per `docs/VERSIONING.md`: this change cannot affect a deployed Matchboard
application (dev-only UI Lab route, gated off production per the existing `isProduction()` guard in
`src/app/dev/ui-lab/layout.tsx`) and does not introduce a product capability. Consistent with W1's
PR #777 and W2's PR #778, which also did not bump `package.json`'s version for the same reason.
