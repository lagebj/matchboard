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
by re-running the local capture script and confirming all 32 of their screenshot SHA-256 values are
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
  file change was needed. `scripts/ui-lab-visual-review.mjs` was extended narrowly: a shared
  `openFirstSourceInspector` interaction function (reused by 5 of 6 A04 scenarios) and an optional,
  backward-compatible `scenario.interactionViewports` filter (limits which viewports run a given
  scenario's interactions — used here to keep A04's interaction count at exactly the documented
  minimum of 20, by running `source-open` only at desktop/mobile, not narrow). Every existing W1
  scenario is untouched by this filter (it has no `interactionViewports` field, so its existing
  all-viewports interaction behavior is unchanged) — confirmed by re-running the full capture
  locally and diffing all 32 W1 screenshot hashes against the already-approved ones (identical).

## Validation run locally

- `npx tsc --noEmit` (full project) — clean.
- `npx eslint src prisma.config.ts next.config.ts eslint.config.mjs prisma/seed-demo.cjs
  playwright.config.ts e2e` — clean (3 pre-existing, unrelated warnings in
  `src/lib/selection/compute-plan-integrity.ts`, not touched by this change; `scripts/` is not in
  the lint glob, and `node --check scripts/ui-lab-visual-review.mjs` confirms the extended script
  is syntactically valid).
- `npx vitest run src/app/dev/ui-lab/gate-a/a04-evidence-grammar` (node config) — 8 files, 36
  tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a/a04-evidence-grammar`
  — 6 files, 25 tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` (W1 + W2
  regression together) — 10 files, 65 tests, all passing.
- `npm test` (both vitest configs, full repository) — **526 + 96 = 622 test files, 5974 + 603 =
  6577 tests, all passing.** Not scoped to Gate A — every test in the repository.
- Local `next dev -p 3333` + the extended `scripts/ui-lab-visual-review.mjs` — all 128 screenshots
  captured successfully (72 existing baseline/W1 + 56 new A04), including the 4 pre-existing
  `atlas-followup` scenarios and all 4 W1 Gate A candidates (byte-identical hashes to the approved
  `candidate_manifest.json` — confirmed via direct comparison). A04's 56 captures = 6 scenarios ×
  (3 viewports × 2 themes) = 36 initial + 5 scenarios × (2 viewports × 2 themes) `source-open`
  interaction = 20, matching `04_TEST_AND_CAPTURE_MATRIX.md`'s documented minimum exactly (S2 has
  no `source-open` interaction capture — its own scope explicitly forbids any trend/derived visual,
  and its question panel's "Inspect sources" control is still fully keyboard/mouse operable; S1,
  S3, S4, S5, S6 each have one). Spot-checked rendered PNGs directly (desktop/mobile/narrow, both
  themes, several `source-open` states) — no horizontal overflow, no clipped labels, correct
  dark/light contrast, mobile bottom sheet settles with a visible drag handle and close control,
  desktop inline inspector sits beside/below content without navigating.
- `npm run build` / full `npm run validate` (incl. `policy:verify`) — **NOT RUN locally**, same
  pre-existing sandbox limitation documented in W1's audit (reproduces on clean `main`, passes in
  real CI); CI will run them.

## Version impact

Classified **`none`** per `docs/VERSIONING.md`: this change cannot affect a deployed Matchboard
application (dev-only UI Lab route, gated off production/preview per the existing dev-route guard)
and does not introduce a product capability. Consistent with W1's PR #777, which also did not bump
`package.json`'s version for the same reason.
