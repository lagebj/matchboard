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
| `src/app/dev/ui-lab/gate-a/a01-sports-first/page.tsx` | **modified** (PR #777) | yes | no | Composes only real production primitives (`OperationalMatchCard`, `TouchlineWidget`, `MetricStrip`, `QuickActionGrid`, `TouchlineBottomSheet`) — no new component to promote |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/__tests__/a01-fixture.test.tsx` | new (PR #777) | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/fixtures.ts` | **modified** (PR #777) | yes | no | N/A — fixture data; added `lineupPreview` |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/page.tsx` | new | yes | no | Composes only real production primitives (`OperationalMatchCard`, `MatchScoreHeader`) — no new component to promote |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/__tests__/a02-fixture.test.tsx` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/page.tsx` | **modified** (PR #777) | yes | no | N/A — dev page |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/fixtures.ts` | **modified** (PR #777) | yes | no | N/A — fixture data; now exercises all 24 canonical positions |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-position-map.tsx` | new | yes | no | A flat-grid production renderer would require a separate human visual-approval gate and an ADR-0154 follow-up decision on whether a flat (non-perspective) treatment replaces or supplements `TouchlinePositionMap` |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-pitch-markings.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/__tests__/a06-fixture.test.tsx` | new (PR #777) | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/page.tsx` | **modified** (PR #777) | yes | no | N/A — dev page |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/fixtures.ts` | **modified** (PR #777) | yes | no | N/A — fixture data; added `initialDeclaredTriple`, `legacyForwardConsolidationPreview` |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-position-selector.tsx` | unchanged | yes | no | A real 14-role picker in `PlayerEditorForm` requires a separately-authorized domain migration (profile vocabulary + storage decision for `DM`/`AM`/`F` → `CDM`/`CAM`/`CF`), not a UI swap |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-position-triple-editor.tsx` | new (PR #777) | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-triple-selection.ts` | new (PR #777) | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/legacy-evidence-drilldown.tsx` | unchanged | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/__tests__/a12-fixture.test.tsx` | **modified** (PR #777) | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/__tests__/profile-triple-selection.test.ts` | new (PR #777) | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts` | **modified** (PR #777) | yes | no | Grid coordinates fixed (unique cells); same promotion requirement as original |
| `src/app/dev/ui-lab/gate-a/shared/__tests__/profile-position-model.test.ts` | **modified** (PR #777) | yes | no | Added grid-uniqueness tests |
| `scripts/ui-lab-visual-review.mjs` | **modified** (PR #777) | yes | no (CI/local script only) | Narrow additive change: added a `narrow` (320px) viewport, per-capture SHA-256, `sourceCommitSha` (real `git rev-parse HEAD`, not a placeholder), environment metadata; existing 4 scenarios' routes/output filenames unchanged |
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
