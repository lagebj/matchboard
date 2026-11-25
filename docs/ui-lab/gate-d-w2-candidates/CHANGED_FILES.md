# Gate D W2 — Changed Files

No production code (anything outside `src/app/dev/ui-lab/`, `e2e/`, `scripts/`, and
`docs/ui-lab/`) is touched by this wave.

## New — shared UI Lab infrastructure (affects production code: no)

- `src/app/dev/ui-lab/gate-d/w2-shared/evidence-source-types.ts` — fixture-only
  `FixtureSourceRecord`/`EvidenceSourceMap` types and the `resolveEvidenceSource`/
  `resolveEvidenceSources` fixture-integrity validator.
- `src/app/dev/ui-lab/gate-d/w2-shared/__tests__/evidence-source-types.test.ts` — unit tests for
  the validator (written and confirmed red before the implementation existed).
- `src/app/dev/ui-lab/gate-d/w2-shared/evidence-source-detail.tsx` — `EvidenceSourceInspector`,
  the disclosed directional source-linking presentation.
- `src/app/dev/ui-lab/gate-d/w2-shared/no-defensible-hypothesis.tsx` — `NoDefensibleHypothesis`,
  the disclosed directional "no defensible conclusion" presentation.
- `src/app/dev/ui-lab/gate-d/w2-shared/assistant-coach-hypothesis-mount.tsx` —
  `AssistantCoachHypothesisMount`, the Gate C W3 C07 RSC-boundary fix reproduced for Gate D,
  wrapping the real, unmodified `AssistantCoachHypothesisPanel`.

## New — D03 family (affects production code: no)

- `src/app/dev/ui-lab/gate-d/d03-development-ai/page.tsx` — family index.
- `src/app/dev/ui-lab/gate-d/d03-development-ai/grounded-longitudinal-hypothesis/{fixtures.ts,page.tsx,__tests__/*}`
- `src/app/dev/ui-lab/gate-d/d03-development-ai/sparse-no-hypothesis/{fixtures.ts,page.tsx,__tests__/*}`
- `src/app/dev/ui-lab/gate-d/d03-development-ai/coach-decision-flow/{fixtures.ts,page.tsx,__tests__/*}`

## New — D06 family (affects production code: no)

- `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/page.tsx` — family index.
- `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/coherent-synthesis/{fixtures.ts,page.tsx,__tests__/*}`
- `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/genuine-contradiction/{fixtures.ts,page.tsx,__tests__/*}`
- `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/sparse-cross-source/{fixtures.ts,page.tsx,__tests__/*}`
- `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/source-inspection-confirmation/{fixtures.ts,page.tsx,__tests__/*}`

## Modified

- `src/app/dev/ui-lab/gate-d/page.tsx` — added D03/D06 entries to the Gate D root index
  (affects production code: no — this route is dev-only, see `src/app/dev/ui-lab/layout.tsx`).
- `scripts/ui-lab-visual-review.mjs` — registered the seven new Gate D W2 routes for CI capture
  (affects production code: no — this script runs only in `ui-lab-visual-review.yml`, never in
  the production build).
- `e2e/ui-lab-gate-d.spec.ts` — added D03/D06 Playwright coverage, extended the responsive
  overflow matrix (affects production code: no — `/dev/ui-lab` routes only).

## New — documentation (affects production code: no)

- `docs/ui-lab/gate-d-w2-candidates/{SOURCE_RECONCILIATION,CURRENT_STATE_AUDIT,WAVE_SCOPE,SCENARIO_REGISTER,DATA_TRUTH_AND_FIXTURES,EVIDENCE_AND_HYPOTHESIS_CONTRACT,INTERACTION_AND_STATE_AUDIT,VISUAL_VS_CURRENT,BLOCKERS,REVIEW_RECORD,CHANGED_FILES}.md`
- `docs/ui-lab/gate-d-w2-candidates/candidate_manifest.json`
- `docs/ui-lab/gate-d-w2-candidates/capture-attestation.json` — added in a follow-up commit once
  CI's real `ui-lab-visual-review.yml` run produced capture evidence; all 42 recorded hashes
  independently re-verified against the downloaded CI artifact before this file was written (see
  `BLOCKERS.md`, `REVIEW_RECORD.md`).

## GitHub issues filed (no code change in this repo)

- [#845](https://github.com/lagebj/matchboard/issues/845), [#846](https://github.com/lagebj/matchboard/issues/846)
  — disclosed production capability gaps, see `BLOCKERS.md`.
