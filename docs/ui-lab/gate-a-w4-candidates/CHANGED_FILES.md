# Gate A W4 — Exact Changed Files

78 files changed relative to `main` at `1a2b5095ead2568aef2a7a505a15409b588107ac`. Zero files under
`src/domain/`, `prisma/`, `src/app/(app)/`, `src/lib/ai/` (write paths), or any W1–W3
`src/app/dev/ui-lab/gate-a/{a01,a02,a03,a04,a06,a07,a09,a12}-*` / `shared/{fixture-identity,
fixture-operation,match-w3-fixture,roster-projection}.ts` file were modified — confirmed by
`git add -A -n` dry-run listing below.

## Modified (additive only)

- `scripts/ui-lab-visual-review.mjs` — added `fillAndClick` helper, `w4ExtraSmokeViewports`,
  `isW4Route` gate, and 13 new scenario entries. Every existing scenario entry, helper, and gate is
  byte-unchanged.
- `src/app/dev/ui-lab/gate-a/page.tsx` — added four new index rows (A05/A08/A10/A11) and widened
  the header doc-comment to mention W4; the `SCENARIOS` array's existing eight rows are unchanged.

## New — Phase 0 and delivery docs

- `docs/ui-lab/gate-a-w4-candidates/CONTRACT_RECONCILIATION.md`
- `docs/ui-lab/gate-a-w4-candidates/CURRENT_STATE_AUDIT.md`
- `docs/ui-lab/gate-a-w4-candidates/BLOCKERS.md`
- `docs/ui-lab/gate-a-w4-candidates/ACTION_OWNERSHIP.md`
- `docs/ui-lab/gate-a-w4-candidates/A05_A08_A10_A11_REVIEW.md`
- `docs/ui-lab/gate-a-w4-candidates/candidate_manifest.json`
- `docs/ui-lab/gate-a-w4-candidates/capture-attestation.json` (committed as a separate, later
  commit referencing the code commit's own SHA — same two-commit pattern as W1-W3)
- `docs/ui-lab/gate-a-w4-candidates/CHANGED_FILES.md` (this file)
- `docs/ui-lab/gate-a-w4-candidates/visual_vs_current/A05_A08.md`
- `docs/ui-lab/gate-a-w4-candidates/visual_vs_current/A10.md`
- `docs/ui-lab/gate-a-w4-candidates/visual_vs_current/A11.md`

## New — shared W4 presentation/fixture code

- `src/app/dev/ui-lab/gate-a/shared/assistant-coach-hypothesis-card.tsx`
- `src/app/dev/ui-lab/gate-a/shared/w4-assistant-coach-fixture.ts`

## New — A05 Assistant Coach semantic grammar (4 scenarios)

- `src/app/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar/page.tsx`
- `.../disabled/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../enabled-with-pattern/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../enabled-without-pattern/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../unavailable/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`

## New — A08 Assistant Coach activation parity (3 scenarios)

- `src/app/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity/page.tsx`
- `.../shared/activation-harness.tsx`
- `.../off/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../on-strong-pattern/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../on-no-insight/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`

## New — A10 Assistant Coach structured action (3 scenarios)

- `src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/page.tsx`
- `.../shared/lineup-proposal-editor.tsx`
- `.../shared/__tests__/mock-viewport.ts`
- `.../review-alternative-success/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../stale-proposal-blocked/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../disabled-or-failed/{fixtures.ts,view-model.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`

## New — A11 Qualitative evidence + mutation (3 scenarios)

- `src/app/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation/page.tsx`
- `.../shared/qualitative-evidence-review.tsx`
- `.../shared/profile-change-review-card.tsx`
- `.../coach-text-and-parsed-evidence/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../profile-change-review-guarded/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`
- `.../profile-change-review-rejected/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}`

## Totals

13 scenario leaf directories, 4 index pages, 6 shared presentation/fixture modules, 2 modified
files, 10 documentation files. 26 test files (13 `fixtures.test.ts` + 13 `page.test.tsx`), 69 new
test cases, all passing — see the finished-report for exact command output.
