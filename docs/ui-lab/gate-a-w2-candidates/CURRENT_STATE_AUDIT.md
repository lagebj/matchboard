# Gate A W2 — A04 Current State Audit

Package: `.matchboard-work/Matchboard_Gate_A_W2_A04_Agent_Bundle_2026-10-09/` (external agent
workspace, not committed). Base commit: `5daded8d4912efef13e9b9a59f125bebb143045e` (`main`, PR
#777 already merged). Branch: `design/gate-a-w2-a04-evidence-grammar`.

## Scope actually executed

Gate A W2 only — one UI Lab **candidate** (A04, "evidence grammar"), dev-only, under
`src/app/dev/ui-lab/gate-a/a04-evidence-grammar/**`, plus a narrow, additive
`scripts/ui-lab-visual-review.mjs` extension and one new entry in the existing Gate A index
(`src/app/dev/ui-lab/gate-a/page.tsx`). No production route, `src/domain/**`, production
`src/components/**`, Prisma schema, auth/authz, or deployment file was touched. W1's four approved
candidates (A01, A02, A06, A12) and their approval records are byte-for-byte unmodified — verified
by re-running the local capture script and confirming all 48 of their screenshot SHA-256 values are
identical to the ones already recorded as `APPROVED_GOLDEN` in
`docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json`. A04 itself is `CANDIDATE`, never
`APPROVED`, pending independent review and the repository owner's explicit decision.

## Repository state found (independently re-verified against the live repo, not the bundle's dated claims)

- `main` was clean at `5daded8d4912efef13e9b9a59f125bebb143045e` before this branch was created;
  `git log --oneline -5` confirms PR #777 (W1 approval/merge-readiness) is the tip.
- `EvidenceStory` (`src/components/touchline/evidence/evidence-story.tsx`) is real and production,
  but `detailHref` navigates via `next/link` — confirmed by direct read — so it cannot serve as
  A04's drilldown trigger without a dev-only adapter. Built `EvidenceQuestionPanel`
  (`a04-evidence-grammar/shared/evidence-question-panel.tsx`): same visual tokens and editorial
  order, `onInspect` callback instead of `detailHref`, and a `coverage: CoverageStatus` field
  instead of `EvidenceStory`'s `confidence: string | null` — a coverage state and a confidence
  label are different concepts and A04 must not conflate them.
- `PlayerParticipationStrip` (`src/components/touchline/player/player-participation-strip.tsx`)
  takes `minutes: number` and always renders it as a number — confirmed it has no path to render
  `NOT_RECORDED` truthfully. Not reused for A04-S1; a dev-only composition renders the coverage
  state explicitly instead.
- `player-match-timeline.tsx` omits the minutes label entirely when `minutes` is null — confirmed
  by direct read. A04 needs the opposite: an explicit "Not recorded" statement, not silence. Not
  reused directly.
- `player-position-timeline.tsx`'s own sparse-entry empty state is real but scoped to that
  component's own threshold — not treated as a new approved trend-sufficiency rule anywhere in
  A04's S2/S3 logic.
- `src/app/dev/ui-lab/atlas-followup/season-review/**` and `player-detail/**` use real production
  view-models with fixtures that already carry fully-known minutes/history — confirmed neither can
  represent a 5/5-opportunity-but-unrecorded-minutes state or a 2-of-6-sparse state without
  inventing new fixture semantics outside their own contract. Marked `NO_BASELINE_CAPABILITY` for
  A04-S1/S2/S3 in `visual_vs_current/A04.md`, citing the closest real component and its limitation
  per `XR-V01`.
- `src/lib/players/get-player-match-history.ts` is `server-only` and derives minutes from actual
  recorded intervals only — confirmed it has no notion of an "eligible opportunity without a
  played interval" and cannot be invoked from a client-rendered dev fixture page regardless; not
  imported.
- W1's `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts`
  (`collapseTacticalToProfile`/`aggregateExactAppearancesByProfile`) is reused unmodified for
  A04-S5/S6's CM projection — confirmed it already preserves distinct sided intervals in
  `breakdown` and dedupes matches by `matchId`, exactly what A04-S5 requires (one CM contribution,
  30 total minutes, 1 distinct match, LCM/RCM still inspectable). No new aggregation rule was
  added; the five-group illustrative-placeholder caveat from A06/A12 does not apply here since A04
  never aggregates confidence/support across positions.
- No `CONFLICT` coverage state exists in the approved six-state vocabulary
  (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`'s "Data categories" list) and no source-priority order is
  defined anywhere in the current domain/ADRs for resolving genuinely conflicting source values.
  Per `07_DECISIONS_DEFERRALS_AND_BLOCKERS.md` ("Do not invent a source-priority order... Record
  blocker if unresolved"), the conflicting-values data-truth test (#3) is implemented as a
  test-only pure function (`shared/invariants.ts`'s `describeConflict`) that flags a disagreement
  without resolving it — no production-looking "conflict" UI state was invented. See `BLOCKED`
  items in `A04_REVIEW.md`.
- `.github/workflows/ui-lab-visual-review.yml` already globs `src/app/dev/ui-lab/**`; no workflow
  file change was needed. `scripts/ui-lab-visual-review.mjs` was extended narrowly: named
  `openSourceInspectorByName(name)` interaction functions (one per scoped inspect trigger — see
  "Independent review round 1" below), an optional backward-compatible `scenario.
  interactionViewports` filter (limits which viewports run a given scenario's interactions),
  `a04ExtraSmokeViewports` (360/430px), an A04-scoped `data-ui-lab-ready` wait, and a console/
  page-error gate (fails only for `gate-a-a04-*` routes, warns elsewhere). Every existing W1
  scenario is untouched by these additions (no `interactionViewports`/`extraViewports` field
  added to them, and the error gate only warns for them) — confirmed by re-running the full
  capture locally and diffing all 48 W1 `gate-a-*` screenshot hashes against the already-approved
  ones (identical; see "Independent review round 1" below for the one unrelated, pre-existing,
  out-of-scope non-determinism observed in a non-Gate-A baseline scenario).

## Independent review round 1 (PR #778, this round)

An independent technical review (recorded verbatim in `A04_REVIEW.md`'s "Independent review round
1" section) returned `REVISE` against head `56ff0402c`, with three required fixes and several
verification gaps. All are implemented; full detail and the affected files are in `A04_REVIEW.md`.
In researching the fixes:

- **R1 (S1 opportunity fact):** confirmed the original fixture's `buildSourceRecords` counted a
  round as having "an opportunity" purely from `opportunitySourceId` being a non-empty string,
  while its own rendered text said "Eligible — player was selectable", conflating eligibility
  (administrative) with a recorded opportunity (concrete squad selection) — two different real-
  world facts that happened to always co-occur in the original fixture, hiding the distinction.
  Fixed by splitting each round's source into two records with their own IDs and matching text.
- **R2 (S6 coverage conflation):** confirmed Case A's single panel carried one `NOT_APPLICABLE`
  badge covering both "is there a declaration" (yes, fully recorded) and "is there actual
  exposure" (no) — two different coverage states folded into one. Fixed by splitting every case
  into a declaration panel (`COMPLETE`) and an exposure/evidence panel (`NOT_RECORDED` for Case A,
  `COMPLETE` for Case B), each with its own source.
- **R3 (scoped inspection):** confirmed the shared `SourceInspector` instance pattern meant every
  "Inspect..." button in a scenario opened the identical combined list. Fixed by giving S1, S4, and
  S6 their own `useSourceInspector()` instance per claim, each wired to its own scoped
  `buildXSourceRecords()` function.
- **200% zoom check (attempted, then removed):** first implemented via Chromium's non-standard
  `document.documentElement.style.zoom = "2"`, but this scales rendered layout boxes without
  correspondingly shrinking `document.documentElement.clientWidth` the way real browser/OS page
  zoom does (which reduces the effective CSS-pixel viewport and lets responsive layout reflow) —
  confirmed by observing it fail at narrow viewports for pages whose initial, unzoomed screenshots
  show no overflow at all. This check does not measure what it claims to; removed rather than kept
  as a flaky/misleading gate. 200% zoom legibility remains a manual-QA item, not automated here.
- **Sequential-interaction bug found while re-capturing:** S1/S4/S6 each chain two interactions on
  the same page/context. The first interaction's mobile bottom sheet (a full-screen `fixed inset-0`
  overlay) was still open when the second interaction tried to click its own trigger underneath it,
  causing a real Playwright click-interception timeout. Fixed by having
  `openSourceInspectorByName` close any already-open dialog (Escape) before opening its target.
- **Console/page-error gate, first attempt:** initially fired on three messages present on every
  single scenario (a report-only CSP `upgrade-insecure-requests` warning plus two
  `net::ERR_FAILED` resource-load messages) — confirmed these are local-dev-server environment
  noise, not caused by any page's own code (they appear identically on W1's already-approved
  pages). Filtered by message pattern before evaluating the gate, so it only reacts to a genuine
  new error.

## Independent review round 2 (PR #778, this round)

A second review (head `f6b47e6f1`) confirmed R1/R2/R3 and every round-1 verification gap as
`PASS`, and raised one new finding, **R4**: `partial-minutes`, `sparse-score-events`, and
`declared-only-versus-evidenced` each used one independent `useSourceInspector()` instance per
claim; since the desktop inline inspector is `aria-modal="false"`, nothing stopped a user opening
a second claim's inspector while the first was still open, leaving more than one dialog active
(S6 could reach four). The capture script's own pre-click "close any open dialog" step hid this
in automated captures without demonstrating the real desktop behavior.

**R4 fixed:** all three scenarios now share one `useActiveSourceClaim<K>()` hook
(`shared/use-active-source-claim.ts`) and exactly one `SourceInspector` element — a single
`activeClaim` key selects which scoped source list/title is shown, so clicking a second trigger on
desktop swaps the inspector's content in place (verified: exactly one `role="dialog"`, no stale
rows, in new component tests that switch claims **without** pressing Escape first). The capture
script's `openSourceInspectorByName()` now only force-closes an existing dialog when it is
genuinely modal (`aria-modal="true"`, i.e. the mobile sheet) — on desktop it clicks the next
trigger directly, so the EXISTING chained interactions now themselves demonstrate the real
switch-without-closing behavior, visible in `gate-a-a04-declared-only-versus-evidenced-desktop-*-
source-open-case-b.png`.

**A genuine remount bug found and fixed while implementing this, not hidden:** S6's first attempt
kept the inspector "visually adjacent to the active case group" by rendering it at two different
conditional JSX call sites (inside Case A's `<div>` vs Case B's `<div>`). Switching across groups
unmounted the old instance and mounted a fresh one; the new instance's `useMediaQuery` briefly
reported its SSR-safe default (`false`, "not desktop") before its own effect corrected it — so a
desktop cross-group switch flashed the mobile bottom sheet for one render. This hung the capture
script's sheet-settle wait (`page.waitForFunction` timeout, reproduced and captured in
`/tmp/ui-lab-capture6.log` during this session). Fixed by mounting the inspector exactly ONCE and
repositioning it via a CSS `order` utility on a shared flex container, instead of a second JSX call
site — same element throughout, no remount, the visual-adjacency goal still holds.

**Minor editorial fix:** S1's minutes source record label changed from `Minutes (recorded
opportunity)` (reusing the opportunity claim's measure name for an unrelated fact) to `Actual
playing minutes`.

## Validation run locally (initial commit, `c5ebfda08`, before any review)

- `npx tsc --noEmit` (full project) — clean.
- `npx eslint` (full repo + script syntax check) — clean, 3 pre-existing unrelated warnings.
- `npx vitest run src/app/dev/ui-lab/gate-a/a04-evidence-grammar` (node config) — 8 files, 36
  tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a/a04-evidence-grammar`
  — 6 files, 25 tests, all passing.
- `npm test` (both vitest configs, full repository) — 622 test files, 6577 tests, all passing.
- Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` — 128 screenshots captured (72
  existing baseline/W1 + 56 new A04: 6 scenarios × 3 viewports × 2 themes = 36 initial + 5
  scenarios × 2 viewports × 2 themes `source-open` interaction = 20), all 48 `gate-a-*` W1 hashes
  byte-identical to the approved record.
- `npm run build` / full `npm run validate` — **NOT RUN locally**, same pre-existing sandbox
  limitation documented in W1's audit; CI will run them.

## Validation run locally (round 2, current — after R1–R4 and all verification gaps)

- `npx tsc --noEmit` (full project) — clean.
- `npx eslint src prisma.config.ts next.config.ts eslint.config.mjs prisma/seed-demo.cjs
  playwright.config.ts e2e` — clean (3 pre-existing, unrelated warnings in
  `src/lib/selection/compute-plan-integrity.ts`, not touched by this change; `scripts/` is not in
  the lint glob, and `node --check scripts/ui-lab-visual-review.mjs` confirms the extended script
  is syntactically valid).
- `npx vitest run src/app/dev/ui-lab/gate-a/a04-evidence-grammar` (node config) — 8 files, 53
  tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a/a04-evidence-grammar`
  — 6 files, 35 tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` (W1 + W2
  regression together) — 10 files, 75 tests, all passing.
- `npm test` (both vitest configs, full repository) — **526 + 96 = 622 test files, 5991 + 613 =
  6604 tests, all passing.** Not scoped to Gate A — every test in the repository.
- Local `next dev -p 3333` + the revised `scripts/ui-lab-visual-review.mjs` — all 164 screenshots
  captured successfully (72 existing baseline/W1 + 92 A04), including the 4 pre-existing
  `atlas-followup` scenarios and all 4 W1 Gate A candidates (all 48 `gate-a-*` captures
  byte-identical to the approved `candidate_manifest.json` hashes — confirmed via direct
  comparison; the non-Gate-A `match-preparation` baseline's 6 captures legitimately differ
  run-to-run due to its own `Date.now()`-based fixture, unrelated to this PR). A04's 92 captures =
  6 scenarios × 5 widths × 2 themes = 60 initial + per-scenario `source-open`-family interactions
  at desktop/mobile × 2 themes = 32 (S1/S4/S6 two each = 16, S3/S5 one each = 8, S2 none). Spot-
  checked rendered PNGs directly, including the S6 cross-group switch-without-Escape capture
  (`...-desktop-light-source-open-case-b.png`): exactly one dialog, correct Case B evidence rows,
  positioned adjacent to the Case B group — confirming the R4 fix. No horizontal overflow, no
  clipped labels, correct dark/light contrast, mobile bottom sheet settles with a visible drag
  handle and close control, desktop inline inspector sits beside/below content without navigating.
- `npm run build` / full `npm run validate` (incl. `policy:verify`) — **NOT RUN locally**, same
  pre-existing sandbox limitation documented in W1's audit (reproduces on clean `main`, passes in
  real CI); CI will run them.

## Version impact

Classified **`none`** per `docs/VERSIONING.md`: this change cannot affect a deployed Matchboard
application (dev-only UI Lab route, gated off production/preview per the existing dev-route guard)
and does not introduce a product capability. Consistent with W1's PR #777, which also did not bump
`package.json`'s version for the same reason.
