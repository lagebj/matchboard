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
