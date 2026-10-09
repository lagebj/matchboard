# Gate A W0/W1 — Changed Files

All paths are new unless marked "modified". Every path is UI-Lab-only, test, or review
documentation. Nothing under `src/domain/**`, production `src/components/**`, production routes,
Prisma schema, auth, or deployment config is touched.

| Path | Type | UI-Lab-only? | Imported by production? | Promotion-to-production requirement |
|---|---|---|---|---|
| `src/app/dev/ui-lab/gate-a/page.tsx` | new | yes | no | N/A — dev index route |
| `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts` | new | yes | no | A real 14-role profile domain model would need its own ADR + `src/domain/positions/` migration before any production import — explicitly out of scope here |
| `src/app/dev/ui-lab/gate-a/shared/match-identity-fixture.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/shared/__tests__/profile-position-model.test.ts` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/page.tsx` | **modified** (PR #777, rounds 1-3) | yes | no | Composes only real production primitives (`OperationalMatchCard`, `TouchlineWidget`, `MetricStrip`, `QuickActionGrid`, `TouchlineBottomSheet`) plus the new isolated `LineupContextualInspector` — no new *production-facing* component to promote. Round 2: trigger-focus capture/restore. Round 3 (final A01 correction): `useMediaQuery` selects exactly one of inspector (desktop)/sheet (mobile), never both; sheet switched to `tone="utility"` for contrast |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/__tests__/a01-fixture.test.tsx` | new (PR #777), **modified** (rounds 2+3) | yes | no | N/A — test; round 2 added Escape-to-close + focus-restoration tests; round 3 added the responsive-presentation test suite (14 tests total) |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/fixtures.ts` | **modified** (PR #777) | yes | no | N/A — fixture data; added `lineupPreview` |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/lineup-list.tsx` | new (round 3) | yes | no | Shared read-only row markup — same component, same data, used by both the desktop inspector and the mobile sheet |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/lineup-contextual-inspector.tsx` | new (round 3) | yes | no | A desktop-only production component would need the same domain-migration authority as A12's picker before promotion, plus its own human visual-approval gate — explicitly out of scope here |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/page.tsx` | new | yes | no | Composes only real production primitives (`OperationalMatchCard`, `MatchScoreHeader`) — no new component to promote |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/__tests__/a02-fixture.test.tsx` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/page.tsx` | **modified** (PR #777, rounds 1+2) | yes | no | N/A — dev page; round 2 added the illustrative-values disclosure |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/fixtures.ts` | **modified** (PR #777, rounds 1+2) | yes | no | N/A — fixture data; round 1 added full 24-code coverage, round 2 removed the "strongest of group" derivation for consolidated dots (flat illustrative placeholder instead) |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-position-map.tsx` | new | yes | no | A flat-grid production renderer would require a separate human visual-approval gate and an ADR-0154 follow-up decision on whether a flat (non-perspective) treatment replaces or supplements `TouchlinePositionMap` |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-pitch-markings.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/__tests__/a06-fixture.test.tsx` | new (PR #777), **modified** (round 2) | yes | no | N/A — test; round 2 replaced the max-support test with source-preservation/mapping/honest-labeling tests |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/page.tsx` | **modified** (PR #777, rounds 1+2) | yes | no | N/A — dev page; round 2 split the legacy preview into Case A/Case B |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/fixtures.ts` | **modified** (PR #777, rounds 1+2) | yes | no | N/A — fixture data; round 2 replaced `legacyForwardConsolidationPreview` with `legacyDeclaredConsolidationPreview` (Case A) + `matchExposureOnlyAppearances`/`matchExposureOnlyAggregates` (Case B) |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-position-selector.tsx` | unchanged | yes | no | A real 14-role picker in `PlayerEditorForm` requires a separately-authorized domain migration (profile vocabulary + storage decision for `DM`/`AM`/`F` → `CDM`/`CAM`/`CF`), not a UI swap |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-position-triple-editor.tsx` | new (PR #777) | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-triple-selection.ts` | new (PR #777), **modified** (round 2) | yes | no | Same as above; round 2 replaced `previewLegacyConsolidation` with `previewLegacyDeclaredConsolidation` (Case A only — Case B reuses the existing aggregator, no new function needed) |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/legacy-evidence-drilldown.tsx` | unchanged | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/__tests__/a12-fixture.test.tsx` | **modified** (PR #777, rounds 1+2) | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/__tests__/profile-triple-selection.test.ts` | new (PR #777), **modified** (round 2) | yes | no | N/A — test; round 2 added Case A/Case B coverage |
| `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts` | **modified** (PR #777, rounds 1+2) | yes | no | Grid coordinates fixed (unique cells) in round 1; round 2 added `PROFILE_GRID_VERTICAL_MARGIN_PCT` to stop edge clipping. Same promotion requirement as original |
| `src/app/dev/ui-lab/gate-a/shared/__tests__/profile-position-model.test.ts` | **modified** (PR #777, rounds 1+2) | yes | no | Round 1 added grid-uniqueness tests; round 2 added clipping-safety/margin tests |
| `scripts/ui-lab-visual-review.mjs` | **modified** (PR #777, rounds 1+2) | yes | no (CI/local script only) | Round 1: `narrow` (320px) viewport, per-capture SHA-256, real `sourceCommitSha`, environment metadata. Round 2: per-scenario `interactions` (deterministic Playwright actions for A01/A12), a URL-unchanged assertion per interaction, and an `interactionState` field on every capture record. Existing baseline scenarios' routes/filenames unchanged |
| `docs/ui-lab/gate-a-w1-candidates/*` | new/modified | n/a (docs) | no | Review/evidence documentation for this PR, including `capture-attestation.json` (new, PR #777) |

## Explicitly NOT changed

- `src/domain/positions/roles.ts` (canonical 24-code vocabulary) — read-only import in the new
  shared module.
- `src/components/players/player-editor-form.tsx`, `src/lib/player-form-options.ts` — still offer
  all 24 sided codes; untouched.
- `src/components/touchline/pitch/touchline-position-map.tsx`,
  `touchline-planning-pitch.tsx`, `projection.ts`, `pitch-markings.tsx`,
  `position-evidence-dot.tsx` (only *imported*, not modified), `position-coordinates.ts`.
- `.github/workflows/ui-lab-visual-review.yml` — its path globs already covered the new routes;
  no edit needed.
- Any Prisma schema/migration, any `src/app/(app)/**` production route, any auth/authz code.
