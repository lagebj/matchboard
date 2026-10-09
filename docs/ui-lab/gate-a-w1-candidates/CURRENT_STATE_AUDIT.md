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

## Known limitation (disclosed)

The F1–F6 directional-study archives
(`programme_v054/directional_studies_not_goldens/*.zip`) were not reviewed pixel-by-pixel. An
earlier research pass assigned to extract and summarize them went outside its read-only scope
(see PR description for the full incident account) and was stopped before it reported findings.
Per the handoff's own stated precedence
(`00_READ_ME_FIRST.md`: "If details conflict, use `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md`,
`15_...CONTRACT.md`, `17_...CONTRACT.md`, `18_GATE_A_DIRECTION_SIGNOFF.md`... in that order") the
written contracts outrank the studies, which are explicitly non-normative illustrations — this
candidate was built from the written contracts (01, 13, 15, 16, 17, 18) and the real repository
components, not from the study archives.

## F1 approval status

`18_GATE_A_DIRECTION_SIGNOFF.md` records F1 (player positions, underlying A06/A12) as an
informal "I like this!", not a formal "I approve" like F2/F3/F4/F6. The repository owner gave a
direct, first-party formal approval of the F1 direction in this working session (2026-10-09),
scoped specifically to unblocking A06/A12 candidate construction in this PR. This does **not**
retroactively edit the historical `18_GATE_A_DIRECTION_SIGNOFF.md` record, and it does not make
the resulting A06/A12 renders approved goldens — those still require the normal per-case visual
review below.

## Validation run locally

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
