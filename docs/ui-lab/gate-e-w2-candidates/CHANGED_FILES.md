# Gate E W2 — Changed Files (E02)

## UI Lab candidate code (new)

- `src/app/dev/ui-lab/gate-e/e02-event-day/page.tsx` — E02 index.
- `src/app/dev/ui-lab/gate-e/e02-event-day/{upcoming,mixed-progression,completed}/{fixtures.ts,page.tsx}`
  — the three child candidates.
- `src/app/dev/ui-lab/gate-e/e02-event-day/shared/`
  - `event-day-fixture-types.ts` — fixture graph types (canonical `EventMatchWithReport`, type-only import).
  - `fixture-builders.ts` — record builders; live fields via the real `resolveLiveReportingPrimaryAction()`.
  - `event-day-schedule.ts` — the one Event-day schedule all three fixtures observe (review M1).
  - `event-day-projection.ts` — pure, fixed-clock Event-day projection over the real `buildMatchPresentation()`.
  - `event-day-fixture-mount.tsx` — fixture-safe Event Detail mount (header, banner, tabs, URL state).
  - `event-day-timeline-section.tsx` — real `TouchlineTimeline`/`TimelineItem`/`ScorebookMatchRow`;
    each match item is one UI-Lab link wrapping the link-less shared row and identity line (E02-R4).
  - `selected-match-context.tsx` — directional selected-match context with real outbound routes.
  - `event-day-aside.tsx` — squad progression and Event facts.
  - `e02-candidate-page.tsx` — shared page frame (UI-Lab chrome + production-width product surface).

## UI Lab code (modified)

- `src/app/dev/ui-lab/gate-e/page.tsx` — lists E02; comment/description updated for Wave 2.

## Tests

- `src/app/dev/ui-lab/gate-e/e02-event-day/__tests__/fixture-integrity.test.ts` (new) — hash
  recomputation + the 17 integrity assertions × 3 fixtures + cross-fixture id uniqueness.
- `src/app/dev/ui-lab/gate-e/e02-event-day/__tests__/event-day-projection.test.ts` (new).
- `src/app/dev/ui-lab/gate-e/e02-event-day/__tests__/pages.test.tsx` (new, component config).
- `e2e/ui-lab-gate-e.spec.ts` (modified) — E02 describe groups appended; the E01 tests are unchanged
  (only the import line gains `type Page` and the header comment mentions W2).

## Capture/CI wiring (modified)

- `scripts/ui-lab-visual-review.mjs` — registers the three E02 routes, each with one
  `continuity-match-selected` interaction capture (the same match in all three states).
- `.github/workflows/ui-lab-visual-review.yml` — job timeout 70 → 75 minutes (same step runs the
  extra Gate E tests; 24 extra captures). No step added or changed.

## Version

- `package.json`, `package-lock.json`, `src/lib/version/index.ts` — 0.169.17 → 0.169.18 (patch;
  UI Lab candidate + capture tooling change, no product behaviour change, same classification as
  earlier Gate waves).

## Documentation (new)

- `docs/ui-lab/gate-e-w2-candidates/` — SOURCE_RECONCILIATION, CURRENT_STATE_AUDIT, WAVE_SCOPE,
  SCENARIO_REGISTER, DATA_TRUTH_AND_FIXTURES, EVENT_AND_MATCH_IDENTITY_CONTRACT,
  TEMPORAL_AND_LIFECYCLE_AUDIT, INTERACTION_AND_STATE_AUDIT, VISUAL_VS_CURRENT, BLOCKERS,
  REVIEW_RECORD, CHANGED_FILES, `candidate_manifest.json`, and `capture-attestation.json` (added only
  after the CI capture run it describes).

## Not changed

No production route (`src/app/(app)/**`), production component (`src/components/**`), domain
service, Prisma schema, auth/tenancy code, global style or app shell. In particular
`src/components/events/event-day-timeline.tsx`, `src/app/(app)/events/[eventId]/event-detail.tsx`
and `src/app/(app)/events/[eventId]/event-matches-tab.tsx` are byte-identical to `main`. No Gate E
W1 file other than the shared `gate-e/page.tsx` index and the shared spec file was touched.
