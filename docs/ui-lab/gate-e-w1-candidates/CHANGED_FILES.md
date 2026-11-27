# Gate E W1 — Changed Files

## UI Lab candidate code (new)

- `src/app/dev/ui-lab/gate-e/page.tsx` — Gate E index.
- `src/app/dev/ui-lab/gate-e/shared/league-fixture-mount.tsx` — fixture-safe URL-state mount
  around the real, unmodified `buildLeagueOperatingViewModel()` + `LeagueSurface`.
- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/page.tsx` — E01 index.
- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round/{fixtures.ts,page.tsx}`
  — state 1.
- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round/{fixtures.ts,page.tsx}`
  — state 2.

## Tests (new)

- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round/__tests__/{fixtures.test.ts,page.test.tsx}`
- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round/__tests__/{fixtures.test.ts,page.test.tsx}`
- `src/app/dev/ui-lab/gate-e/e01-league-temporal-orientation/__tests__/fixture-temporal-integrity.test.ts`
  (E01-R1 remediation) — independent reconciliation layer verifying every period/round display
  label agrees with its real `startDate`/`endDate`/`startsAt` record.
- `e2e/ui-lab-gate-e.spec.ts` — real-browser navigation/interaction/responsive assertions,
  including (E01-R6 remediation) direct-URL round restoration, browser Back context restoration,
  real keyboard operation of the season rail and season selector, and (E01-R2 remediation) a
  1440px desktop product-surface width assertion.

## Capture/CI wiring (modified)

- `scripts/ui-lab-visual-review.mjs` — registered both Gate E routes for CI screenshot capture.
- `playwright.config.ts` — added the `ui-lab-gate-e` project (no-auth, scoped to
  `ui-lab-gate-e.spec.ts`), and added that spec to the default `chromium` project's `testIgnore`
  (same convention as every prior gate's own project).
- `.github/workflows/ui-lab-visual-review.yml` — added the Gate E Playwright acceptance step
  (same pattern as the Gate C/D steps), bumped the job timeout 65 → 70 minutes.

## Documentation (new, then twice revised during remediation)

- `docs/ui-lab/gate-e-w1-candidates/{SOURCE_RECONCILIATION,CURRENT_STATE_AUDIT,WAVE_SCOPE,SCENARIO_REGISTER,DATA_TRUTH_AND_FIXTURES,INTERACTION_AND_STATE_AUDIT,VISUAL_VS_CURRENT,BLOCKERS,CHANGED_FILES,REVIEW_RECORD}.md`,
  `candidate_manifest.json`, `capture-attestation.json` (this document set). Remediation round 1
  (header-fidelity fix, BLK-E01-05) and remediation round 2 (temporal-label fixes E01-R1,
  desktop-width fix E01-R2, documentation corrections E01-R3/R4, context-restoration clarification
  E01-R6) are both recorded in `REVIEW_RECORD.md` and `BLOCKERS.md` rather than edited away.

## Not changed

No production route (`src/app/(app)/**`), domain service (`src/domain/**`,
`src/lib/selection/**`), Prisma schema, auth/tenancy code, or shared non-UI-Lab component was
touched. `src/components/fixtures/**` and `src/lib/touchline/presentation/league-view-model.ts`
are reused exactly as they exist on `main` — zero lines changed.
