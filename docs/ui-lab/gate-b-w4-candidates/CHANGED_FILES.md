# Gate B W4 — Changed Files (B07)

## New — candidate source

- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/fixtures.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/page.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/__tests__/fixtures.test.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/fixtures.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/page.tsx`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/__tests__/fixtures.test.ts`
- `src/app/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact/__tests__/page.test.tsx`

## Modified — shared fixtures and registration

- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — appended the B07 section (three new
  match identities, two timelines, six-record source list), same file B01-B06 already share.
- `src/app/dev/ui-lab/gate-b/page.tsx` — registered both B07 candidate links; updated the
  "deferred" note (B07 implemented, only B08 remains deferred).
- `scripts/ui-lab-visual-review.mjs` — registered both new routes for CI visual capture
  (`gate-b-w4-b07-historical-pattern`, `gate-b-w4-b07-trivial-fact`), explicitly to avoid
  repeating B06's own B5/R7 finding (new pages shipped with zero capture evidence because they
  were never added to this array).

## New — W4 documentation set (this directory)

- `SCENARIO_REGISTER.md`, `CURRENT_STATE_AUDIT.md`, `THREE_PART_EXPERIENCE_CONTRACT.md`,
  `DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`, `INTERACTION_AND_STATE_AUDIT.md`,
  `VISUAL_VS_CURRENT.md`, `BLOCKERS.md`, `REVIEW_RECORD.md`, `CHANGED_FILES.md` (this file),
  `candidate_manifest.json`, `capture-attestation.json` (placeholder — see `BLOCKERS.md`).

## Not touched

B01-B06 candidate source, fixtures, tests, and documentation (`gate-b-w1/w2/w3-candidates/`) are
unmodified. No production route, component, data loader, AI capability, or server action was
changed.
