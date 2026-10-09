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
| `src/app/dev/ui-lab/gate-a/a01-sports-first/page.tsx` | new | yes | no | Composes only real production primitives (`OperationalMatchCard`, `TouchlineWidget`, `MetricStrip`, `QuickActionGrid`) — no new component to promote |
| `src/app/dev/ui-lab/gate-a/a01-sports-first/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/page.tsx` | new | yes | no | Composes only real production primitives (`OperationalMatchCard`, `MatchScoreHeader`) — no new component to promote |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a02-match-lifecycle/__tests__/a02-fixture.test.tsx` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/page.tsx` | new | yes | no | N/A — dev page |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-position-map.tsx` | new | yes | no | A flat-grid production renderer would require a separate human visual-approval gate and an ADR-0154 follow-up decision on whether a flat (non-perspective) treatment replaces or supplements `TouchlinePositionMap` |
| `src/app/dev/ui-lab/gate-a/a06-position-pitches/flat-profile-pitch-markings.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/page.tsx` | new | yes | no | N/A — dev page |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/fixtures.ts` | new | yes | no | N/A — fixture data |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/profile-position-selector.tsx` | new | yes | no | A real 14-role picker in `PlayerEditorForm` requires a separately-authorized domain migration (profile vocabulary + storage decision for `DM`/`AM`/`F` → `CDM`/`CAM`/`CF`), not a UI swap |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/legacy-evidence-drilldown.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a12-profile-editor/__tests__/a12-fixture.test.tsx` | new | yes | no | N/A — test |
| `scripts/ui-lab-visual-review.mjs` | **modified** | yes | no (CI/local script only) | N/A — narrow additive change (scenario list → `{slug, route}`, 4 new entries); existing 4 scenarios' routes and output filenames are unchanged |
| `docs/ui-lab/gate-a-w1-candidates/*` | new | n/a (docs) | no | Review/evidence documentation for this PR |

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
