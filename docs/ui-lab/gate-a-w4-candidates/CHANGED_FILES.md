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

## Totals (initial delivery, commit `db37d1c84`)

13 scenario leaf directories, 4 index pages, 6 shared presentation/fixture modules, 2 modified
files, 10 documentation files. 26 test files (13 `fixtures.test.ts` + 13 `page.test.tsx`), 69 new
test cases, all passing.

## Remediation delta (independent technical review, findings R1–R5)

### New — A10 proposal contract (R2)

- `src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/shared/lineup-proposal-contract.ts`
  — strict typed proposal, `validateLineupProposal`, `resolveProposalEvidence`
- `.../shared/lineup-proposal-fixture.ts` — shared validation-context fixture (roster/slot/evidence
  catalog) every A10 scenario's `fixtures.ts` now builds against
- `.../shared/__tests__/lineup-proposal-contract.test.ts` — 17 unit tests, one per rejection code
  plus the stale/applicable/evidence-resolution cases

### Modified — A10 (R2, R3, R4)

- `.../shared/lineup-proposal-editor.tsx` — proposal type now `LineupSlotAssignmentProposal`;
  evidence rendered via a real per-source `EvidenceSourceList` inspector, not a bare count;
  `deriveOperationControlPolicy` centralizes select/apply/discard availability (fixes R3's
  Discard-during-`PENDING` bug); `appliedAlready` derived from the authoritative pitch projection
  (fixes R4's re-applicable-after-reopen bug), replacing the plain `proposal ?` render branch with
  blocked/applied/interactive branches
- `review-alternative-success/{fixtures.ts,view-model.ts,page.tsx,__tests__/*}` — proposal now
  contract-typed and validated at module load (`fixtureVersion` 1→2, hash recomputed); tests add
  evidence-inspector, PENDING-discard, and already-applied-on-reopen coverage
- `stale-proposal-blocked/{fixtures.ts,view-model.ts,page.tsx,__tests__/*}` — same contract typing;
  `blockedReason` now derived from `validateLineupProposal`'s own `STALE` result (`fixtureVersion`
  1→2, hash recomputed); tests updated for the no-selectable-row-when-blocked behavior
- `disabled-or-failed/page.tsx` — passes the new required `candidateDisplayName`/
  `candidateShirtNumber`/`evidence` props (no fixture content change, no version bump)

### Modified — A11 (R1, R5)

- `coach-text-and-parsed-evidence/fixtures.ts` — removed the unsupported `period: "SECOND_HALF"`
  attribution on Tobias's composure observation (`fixtureVersion` 1→2, hash recomputed)
- `.../__tests__/fixtures.test.ts` — replaced the nonempty-only assertion with claim-by-claim
  semantic assertions tied to the exact source note
- `shared/profile-change-review-card.tsx` — new `useProfileChangeReview` hook modelling a real
  authoritative `declaredPrimary` projection; `ProfileChangeReviewCard` now takes
  `authoritativePrimary` as a prop and reads it for both the diff and the outcome message, instead
  of a canned success string
- `shared/__tests__/profile-change-review-card.test.tsx` — new, 7 unit tests covering before/after
  state for Accept/Reject/Defer, idempotent repeat-Accept, and React Strict Mode
- `profile-change-review-guarded/page.tsx`, `profile-change-review-rejected/page.tsx` — wired to
  `useProfileChangeReview`; `__tests__/page.test.tsx` for both add before/after authoritative-state
  assertions (no fixture content change, no version bump — only the component API changed)

### Modified — documentation

- `CONTRACT_RECONCILIATION.md` — unchanged (scenario allocation preserved, no update needed)
- `CURRENT_STATE_AUDIT.md`, `A05_A08_A10_A11_REVIEW.md`, `BLOCKERS.md`, `ACTION_OWNERSHIP.md`,
  `CHANGED_FILES.md` (this file), `candidate_manifest.json`, `visual_vs_current/A10.md`,
  `visual_vs_current/A11.md` — updated to describe the remediated contract/validation/evidence/
  authoritative-state behaviour and the new fixture versions/hashes

## Totals (after remediation)

3 new files (A10 contract + fixture context + its unit test), 1 new test file (A11 hook unit
test), 12 modified source/test files, 8 modified documentation files. 3 fixture versions bumped
(A10 review-alternative-success, A10 stale-proposal-blocked, A11 coach-text-and-parsed-evidence),
each with an independently recomputed `fixtureSha256`. See the finished report for exact test
counts and command output.
