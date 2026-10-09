# Gate A W0/W1 — Current State Audit

Handoff: `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/`
(external agent workspace, not committed). Base commit: `b070df73664d816f1b0ebc61d54487a24044972e`
(`main`, PR #776 already merged). Branch: `design/gate-a-w1-ui-lab-candidates`.

## Scope actually executed

Gate A W0/W1 only — four UI Lab **candidates** (A01, A02, A06, A12), dev-only, under
`src/app/dev/ui-lab/gate-a/**`. No production route, `src/domain/**`, production
`src/components/**`, Prisma schema, auth/authz, or deployment file was touched. Nothing here is
an approved golden; see `A01_A02_A06_A12_REVIEW.md` for the per-case status (`CANDIDATE`, never
`APPROVED`).

## Repository state found (independently re-verified, not trusted from the handoff's dated claims)

- `main` was clean at `b070df736` before this branch was created. `git fetch origin main` /
  `gh pr view 776` confirmed PR #776 (the baseline `ui-lab-visual-review` workflow + script) is
  genuinely merged upstream — the handoff's claim about it was correct.
- `origin/design/gate-a-w1-fixture-candidates` exists but is byte-identical to `main`
  (`git diff main...origin/design/gate-a-w1-fixture-candidates --stat` is empty) — confirmed
  empty as the handoff warned, not used as a base for this work.
- Canonical 24-code tactical vocabulary (`CANONICAL_TACTICAL_POSITIONS`,
  `src/domain/positions/roles.ts`, ADR-0154) is real, production, and is exactly what
  `PlayerEditorForm` (`src/components/players/player-editor-form.tsx` via
  `src/lib/player-form-options.ts`) already offers as all 24 sided options. Confirmed read-only;
  not edited by this candidate.
- No 14-value "profile" position vocabulary exists anywhere in the codebase before this PR
  (`GeneralRole`/`ProfilePosition` as exact identifiers: zero matches). Introduced here only as a
  new, explicitly-labeled, dev-only module
  (`src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts`) that no production code imports.
- `TouchlinePositionMap` (`src/components/touchline/pitch/touchline-position-map.tsx`) and
  `TouchlinePlanningPitch` both use real perspective projection
  (`projectPlanningPitchPoint`, `src/components/touchline/pitch/projection.ts`) — confirmed this
  is a genuine blocker (BLK-02) to representing a flat 3×6 analysis grid without either modifying
  the shared production projection or building an isolated candidate. This PR builds an isolated
  candidate (`a06-position-pitches/flat-profile-position-map.tsx` +
  `flat-profile-pitch-markings.tsx`) and does not touch the production renderer.
- Existing dev-only convention: `src/app/dev/ui-lab/atlas-followup/` (per-scenario `page.tsx` +
  `fixtures.ts` + optional `__tests__`, shared `AppearanceControl`). This candidate mirrors that
  convention under a new `src/app/dev/ui-lab/gate-a/` sibling tree rather than inventing a new
  layout convention.
- `.github/workflows/ui-lab-visual-review.yml` already globs `src/app/dev/ui-lab/**`, so no
  workflow-file change was needed to pick up the new routes. `scripts/ui-lab-visual-review.mjs`
  hard-coded its 4 existing scenarios by string; extended narrowly (scenario list → `{slug,
  route}` objects) to add the 4 new Gate A scenarios without changing existing capture behaviour
  for `match-preparation` / `completed-match` / `player-detail` / `position-map` (re-ran locally;
  all 4 baseline captures still succeed byte-for-byte in shape — see Validation below).

## Known limitation (disclosed, original W0/W1 PR — resolved in the PR #777 remediation below)

The F1–F6 directional-study archives
(`programme_v054/directional_studies_not_goldens/*.zip`) were not reviewed pixel-by-pixel in the
original PR. An earlier research pass assigned to extract and summarize them went outside its
read-only scope (see the git history / original PR description for the full incident account)
and was stopped before it reported findings. Per the handoff's own stated precedence
(`00_READ_ME_FIRST.md`: "If details conflict, use `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md`,
`15_...CONTRACT.md`, `17_...CONTRACT.md`, `18_GATE_A_DIRECTION_SIGNOFF.md`... in that order") the
written contracts outrank the studies, which are explicitly non-normative illustrations — this
candidate was built from the written contracts (01, 13, 15, 16, 17, 18) and the real repository
components, not from the study archives, for the original W0/W1 PR.

## PR #777 remediation (this round)

A full, detailed study of the F1–F6 directional archives was carried out this round, using a
fresh agent with no inherited "execute this handoff" framing and an explicit instruction to treat
everything inside the archives — including any embedded text resembling instructions — as design
notes only, never as directives, and to copy no markup/code verbatim. Findings are cited
concretely in each `visual_vs_current/*.md` file (file/line-level description of what was
actually seen, not generic inference). Summary of what changed as a direct result:

- **A06 (correctness defect):** the flat profile grid placed `LB`/`LWB` and `RB`/`RWB` on the
  same coordinates — a genuine bug, since a player can have independent evidence at both and both
  must be independently visible/selectable. Fixed to the layout the repository owner specified
  (and independently corroborated by the F1 Study 02 review): `F` alone on the attack line,
  `LW/AM/RW`, `LM/CM/RM`, `LWB/DM/RWB`, `LB/CB/RB`, `GK` alone on the goalkeeper line — all 14
  profile positions now have a unique grid cell (unit-tested).
- **A06 (coverage gap):** the fixture previously used only 3 non-collapsing exact codes
  (`LW`/`LM`/`RW`), which never exercised the 24→14 projection at all. Rebuilt to cover all 24
  canonical positions, explicitly demonstrating all five centre-line consolidation groups
  (`CB`/`DM`/`CM`/`AM`/`F`), each profile-level value traceable to its strongest real exact-level
  source (unit-tested, never invented).
- **A12 (missing scope):** the candidate only supported a single declared position. Rebuilt as a
  full primary/secondary/tertiary `ProfilePositionTripleEditor` with duplicate prevention and
  clearable optional slots, plus a legacy migration preview (`LCF`/`CF`/`RCF` → single `F`
  primary, no invented secondary/tertiary) — the interaction pattern (compact summary by default,
  expand to 3 selects + the full 14-button grid) is drawn directly from the F1 Study 02 review's
  Overview-vs-Manage distinction, not invented independently.
- **A01 (interaction-contract violation, XR-I01):** the "Edit lineup" quick action navigated to
  the unrelated A02 scenario page — a real violation of the context-local rule. Fixed to a
  real, shipped `TouchlineBottomSheet` opening an in-page, read-only lineup preview, confirmed
  against the F6 Interactive Study 01's "stays in this match" drawer pattern. Relabeled "Lineup"
  (not "Edit lineup") since no editing capability is actually implemented.
- **Capture/manifest hygiene:** `candidate_manifest.json`'s self-referential `prCommitSha:
  "PENDING_COMMIT"` field is removed — a commit cannot reliably contain its own final hash. Stable
  candidate metadata stays in that file; the actual source commit SHA, per-capture SHA-256,
  capture timestamp/environment and known limitations now live in a separately-generated,
  separately-committed `capture-attestation.json`, referencing an already-existing prior commit
  (avoids the circular-dependency problem entirely).
- Capture matrix extended to three widths (desktop 1440px, mobile 390px, narrow 320px) × dark/light,
  applied uniformly to all 8 scenarios (4 existing baseline + 4 Gate A).

No change was made outside `src/app/dev/ui-lab/gate-a/**`, `docs/ui-lab/gate-a-w1-candidates/**`,
and the narrow capture-script edit — exactly the scope this remediation was authorized for.

## F1 approval status

`18_GATE_A_DIRECTION_SIGNOFF.md` records F1 (player positions, underlying A06/A12) as an
informal "I like this!", not a formal "I approve" like F2/F3/F4/F6. The repository owner gave a
direct, first-party formal approval of the F1 direction in this working session (2026-10-09),
scoped specifically to unblocking A06/A12 candidate construction in this PR. This does **not**
retroactively edit the historical `18_GATE_A_DIRECTION_SIGNOFF.md` record, and it does not make
the resulting A06/A12 renders approved goldens — those still require the normal per-case visual
review below.

## Validation run locally (original W0/W1 PR)

- `npx eslint src/app/dev/ui-lab/gate-a scripts/ui-lab-visual-review.mjs` — clean.
- `npx tsc --noEmit` (full project) — clean.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` — 2 files, 7
  tests, all passing.
- `npx vitest run src/app/dev/ui-lab/gate-a/shared/__tests__/profile-position-model.test.ts` — 1
  file, 6 tests, all passing.
- Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` (after
  `npx playwright install --with-deps chromium`, which this sandbox needed) — all 32 screenshots
  captured successfully (16 existing baseline + 16 new Gate A), including the 4 pre-existing
  `atlas-followup` scenarios, confirming the capture-script extension did not break the existing
  baseline capture.
- `npm run build` — **NOT RUN** locally. Known pre-existing sandbox limitation (OOMs on this
  devcontainer regardless of branch); passes in real CI.
- `npm run validate` (full, incl. `policy:verify`) — **NOT RUN** locally; ran the component
  pieces above individually instead. CI will run the full command.

## Validation run locally (PR #777 remediation)

- `npx eslint src prisma.config.ts next.config.ts eslint.config.mjs prisma/seed-demo.cjs
  playwright.config.ts e2e scripts/ui-lab-visual-review.mjs` (full repo + the modified script) —
  clean (3 pre-existing, unrelated warnings in `src/lib/selection/compute-plan-integrity.ts`, not
  touched by this change).
- `npx tsc --noEmit` (full project) — clean.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` — 4 files, 18
  tests, all passing.
- `npx vitest run src/app/dev/ui-lab/gate-a` (default config) — 2 files, 19 tests, all passing.
- Local `next dev -p 3333` + the extended `scripts/ui-lab-visual-review.mjs` — all 48 screenshots
  captured successfully (8 scenarios × desktop/mobile/narrow × dark/light), visually spot-checked
  (A06's full 24/14 coverage with no LB/LWB or RB/RWB overlap at desktop and narrow widths, A12's
  collapsed primary/secondary/tertiary summary + per-slot evidence + legacy preview, A01's renamed
  "Lineup" action) — no horizontal overflow observed at 320px on any Gate A scenario.
- Real capture output copied into `capture-attestation.json`, `sourceCommitSha`
  `e45fb2cce2d39b0c46c543fc92af682b15916e04` (the already-pushed remediation commit; this
  attestation file is committed separately, after that commit, so it references real, existing
  history rather than its own not-yet-known hash).
- `npm run build` / full `npm run validate` — **NOT RUN** locally (same pre-existing sandbox OOM
  limitation as the original PR); CI will run them.

## PR #777 remediation — round 2 (findings A06-1, A06-2, A12-1, and A01/A12 interactive-state evidence)

Fixed: clipped `F`/`GK` dots on the A06 flat grid (added a 9% vertical margin, unit-tested);
removed the unapproved "strongest of group" aggregation rule for A06's consolidated dots
(replaced with an explicitly-labeled flat illustrative placeholder, with an on-page disclosure,
and the open product question documented rather than decided); split A12's legacy-migration
preview into clearly separate "Legacy declared positions" (Case A) and "Recorded match exposure"
(Case B) sections so declared authority and measured evidence are never conflated; extended the
capture script to perform deterministic Playwright interactions for A01 ("Lineup" click) and A12
("Edit" click) in the same browser context as the initial capture, with a URL-unchanged assertion
and an `interactionState` field on every capture record, plus Escape-to-close and focus
restoration for A01 (unit-tested). Full detail per case in each `visual_vs_current/<CASE>.md`.

## Validation run locally (PR #777 remediation, round 2)

- `npx eslint src ... scripts/ui-lab-visual-review.mjs` (full repo + script) — clean (same 3
  pre-existing, unrelated warnings).
- `npx tsc --noEmit` (full project) — clean.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` — 4 files, 27
  tests, all passing.
- `npx vitest run src/app/dev/ui-lab/gate-a` (default config) — 2 files, 26 tests, all passing.
- Local `next dev -p 3333` + the extended `scripts/ui-lab-visual-review.mjs` (including the new
  interaction captures) — all screenshots captured successfully across desktop/mobile/narrow ×
  dark/light, including the new `lineup-open` (A01) and `editor-expanded` (A12) interaction-state
  captures; visually spot-checked for the A06 clipping fix (no dot touches the pitch edge at any
  viewport) and the A12 Case A/Case B labeling. No URL-unchanged assertion failures. No horizontal
  overflow observed at 320px.
- `npm run build` / full `npm run validate` — **NOT RUN** locally (same pre-existing sandbox OOM
  limitation); CI will run them.

## PR #777 final A01 correction — round 3 (desktop/mobile responsive interaction)

Round 2's capture revealed `TouchlineBottomSheet` running full-width at every viewport, including
desktop — not the approved desktop-inspector/mobile-sheet responsive grammar. Fixed:
`useMediaQuery("(min-width: 600px)")` (Touchline's own `medium` breakpoint) now selects exactly
one presentation — a new isolated `LineupContextualInspector` (inline, beside the match, in a
two-column layout that collapses back to one column when closed) on desktop, the existing
`TouchlineBottomSheet` on mobile, now `tone="utility"` instead of `tone="context"` to fix a
readability regression (page text showing through the sheet's translucent background). Both
presentations share one `LineupList` component and one fixture; exactly one is ever mounted in the
DOM (the other branch doesn't render at all), so there is no duplicate-accessible-control risk to
reason about separately. Full detail in `visual_vs_current/A01.md`.

## Validation run locally (PR #777 final A01 correction, round 3)

- `npx eslint src ... scripts/ui-lab-visual-review.mjs` (full repo + script) — clean (same 3
  pre-existing, unrelated warnings).
- `npx tsc --noEmit` (full project) — clean.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` — 4 files, 35
  tests, all passing (A01 alone: 14 tests, including a new responsive-presentation suite that
  mocks `window.matchMedia("(min-width: 600px)")` per test to exercise both branches).
- `npx vitest run src/app/dev/ui-lab/gate-a` (default config) — 2 files, 26 tests, all passing.
- Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` — all A01 captures regenerated and
  visually spot-checked: desktop `lineup-open` shows the two-column inspector layout (match still
  primary, inspector clearly subordinate, same page); mobile/narrow `lineup-open` shows a solid,
  readable sheet with no page text bleeding through; no horizontal overflow at 320px in either
  theme.
- `npm run build` / full `npm run validate` — **NOT RUN** locally (same pre-existing sandbox OOM
  limitation); CI will run them.

## Owner visual feedback and round 4 (A06 LW/RW line + A01 responsive squeeze)

Owner review, reviewed head `40b92d5bd9d64a887b121dc49aeeb52acbe901f5`, recorded verbatim in
`A01_A02_A06_A12_REVIEW.md`: A01/A02/A12 visually acceptable ("Else they look good", not a formal
approval); A06 marked REVISE — "A06 24 point positions should have LW and RW on Attacking
midfielder horizontal similar to 14 point position. GK and F are always central."

**A06 fix:** confirmed via direct source read that production's `primaryDisplayCellFor`
(`src/domain/positions/grid.ts`) deliberately picks `LW`/`RW`'s attack-line (y0) cell — exactly
why the candidate showed them there. Built a candidate-only presentation override
(`candidate-position-grid.ts` + `candidate-tactical-position-map.tsx`) that moves `LW`/`RW` to
their real, already-valid y1 cell for THIS candidate's rendering only; every other position
delegates straight to the real `primaryDisplayCellFor`, verified by direct equality in tests.
Production's grid table, `primaryDisplayCellFor`, `position-coordinates.ts`, and the real
`TouchlinePositionMap` component are completely untouched — confirmed by tests that assert
`primaryDisplayCellFor("LW"/"RW")` still returns the unmodified attack-line cell.

**A01 fix:** independently verified the 600-840px range the owner's review flagged as
outstanding — found a real layout squeeze (the two-column row and the inspector-vs-sheet decision
shared the same 600px threshold, leaving a fixed 480px match column almost no room for the
inspector between 600-840px). Fixed by moving the row-vs-stacked layout decision to Touchline's
wider `expanded` (840px) breakpoint, decoupled from the 600px component-choice decision.

**Capture provenance:** documented explicitly in `A01_A02_A06_A12_REVIEW.md` that a local capture
set's `sourceCommitSha` and a GitHub Actions CI capture set's `sourceCommitSha` can legitimately
differ — CI's `pull_request` trigger checks out a synthetic merge commit, not the branch tip — and
that this is not, by itself, an integrity failure.

## Validation run locally (owner feedback + round 4)

- `npx eslint src ... scripts/ui-lab-visual-review.mjs` (full repo + script) — clean (same 3
  pre-existing, unrelated warnings).
- `npx tsc --noEmit` (full project) — clean.
- New tests: `candidate-position-grid.test.ts` (10 tests, proves the override matches the owner's
  table exactly and changes nothing else), A06 component tests extended (4 new tests: selection,
  distinctness, CF/GK centrality, presentation disclosure), A01 test suite extended (1 new test:
  breakpoint decoupling).
- Local `next dev -p 3333` + the extended capture script (new `extraViewports` for A01 at
  600/768/900px) — all screenshots captured and visually spot-checked: A06's left panel now shows
  `LW`/`RW` on the attacking-midfield line (same line as `LAM`/`CAM`/`RAM`), `GK`/`CF` still
  central; A01's 600px and 768px captures show the inspector stacked full-width below the match
  (no squeeze), 900px shows a comfortable two-column row.
- `npm run build` / full `npm run validate` — **NOT RUN** locally (same pre-existing sandbox OOM
  limitation); CI will run them.

## Governance verification and merge preparation (2026-10-09)

Final verification pass after the repository owner's `APPROVED_GOLDEN` approval of A01/A02/A06/A12
(see `A01_A02_A06_A12_REVIEW.md`'s "Formal approval record"), against commit
`370561c58a25ae852fdf5477da90a5741824d65b` (the approval-record commit, built on the corrected
`7dbdf85cc` revision the approval itself was recorded against).

**Local verification:**
- `npx eslint` (full repo + `scripts/ui-lab-visual-review.mjs`) — clean (3 pre-existing, unrelated
  warnings, untouched by this work).
- `npx tsc --noEmit` (full project) — clean.
- `npm test` (the repository's full test suite, both vitest configs) — **518 + 90 = 608 test
  files, 5938 + 578 = 6516 tests, all passing.** Not scoped to Gate A — this is every test in the
  repository.
- `npm run build` — attempted again for this final check; still hangs/times out locally. Confirmed
  this is the same pre-existing sandbox-only limitation documented throughout this work (not a
  regression) — see the CI result below for the authoritative outcome.

**CI verification (`gh pr checks 777`, against head `370561c58`):** every check passes —
`Build`, `Lint`, `TypeScript Check`, `Tests` (7m34s), `Tests (Workers)`, `TypeScript Check
(Workers)`, `Policy Verify`, `Prisma Query Fields`, `Forbidden SQL Methods` (both instances),
`Migration from Zero`, `Authorization Security Tests`, `Gitleaks Secret Detection`, `Semgrep
SAST`, `OSV Dependency Scan`, `Supply Chain Integrity` (both instances), `CodeQL`, `Version
Verify`, `check-cla`, and — specific to this work — **`Capture fixture-backed UI Lab views`**
(the Gate A screenshot capture CI job itself). No failing or pending checks.

**Merge state:** `gh pr view 777` reports `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN` — no
conflicts with `main`.

**Still open, disclosed (not a blocker for CI/code correctness, but a real gap against doc 07's
full storage strategy):** the durable GitHub Release holding the 48 approved screenshots (D7
storage strategy, "preserve approved screenshots beyond CI artifact expiration") could not be
created in this session — blocked by the sandbox's own permission classifier, which requires
explicit human authorization to create a new public GitHub surface. The exact prepared command is
in `A01_A02_A06_A12_REVIEW.md`'s "Formal approval record" section. This does not affect the
approval record's own durability (it's committed to git) or CI/mergeability.

**PR state:** left in draft, per this session's standing instruction not to merge or mark
production-ready without explicit further direction — all governance/CI preconditions for merge
are satisfied; moving out of draft and/or merging is the repository owner's call.
