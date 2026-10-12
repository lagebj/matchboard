# Gate A W5 — Changed Files and Commands

Base: `main` at `515533c284a2a6fd3de88af513b1188ed249d458` (PR #780, verified via `git fetch origin
main` + `git log origin/main -1` before branching). Branch: `design/gate-a-w5-golden-consistency-
convergence`, cut directly from that commit (confirmed no other coding-agent PR was open at branch
time — only Dependabot PRs #712/713/717/719/743/770/773/781/782).

## File-by-file

| File | Change | Why |
|---|---|---|
| `docs/ui-lab/gate-a-w2-candidates/capture-attestation.json` | Replaced (202 lines changed) | W5-F03 — stale attestation didn't match its own approved hashes; replaced with the CI-verified round that the approval was actually recorded against. See `CONFLICT_AND_BLOCKER_REGISTER.md`, `VISUAL_COVERAGE_AND_CAPTURE.md` |
| `scripts/audit-gate-a-golden-authority.mjs` | New (182 lines) | W5-F04 — corrected, repo-native port of the handoff bundle's read-only audit script |
| `src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/shared/lineup-proposal-editor.tsx` | `LineupProposalInspector` gains an optional `className` prop | W5-F02 — supports the breakpoint fix below |
| `src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/{review-alternative-success,stale-proposal-blocked,disabled-or-failed}/page.tsx` | Container/column classes changed from `medium:flex-row`/`medium:items-start` to `expanded:flex-row`/`expanded:items-start`/`expanded:w-[480px] expanded:shrink-0`; inspector now receives `className="expanded:flex-1"` | W5-F02 — matches A01's already-approved fix for the identical 600-840px squeeze. Layout-only; no fixture/data/test-assertion file touched; no `fixtureVersion` bump |
| `src/app/dev/ui-lab/gate-a/page.tsx` | Header text and JSDoc corrected (stale "W0/W1" wording, dangling `CANDIDATE_REVIEW.md` reference) | W5-F05 — explicitly pre-authorized dev-only text correction |
| `docs/ui-lab/gate-a-w5-convergence/*.md`, `authority_inventory.csv` | New (11 markdown docs + 1 CSV) | This PR's required deliverable set |

No file under `src/app/(app)/**`, `src/domain/**`, `prisma/**`, `src/lib/auth/**`, or any CI/
deployment config was touched. No production route, policy, or database file changed. `git diff
--stat 515533c284a..HEAD -- src/app/dev/ui-lab prisma src/app/\(app\) src/domain` confirms zero
hits outside `src/app/dev/ui-lab/gate-a/**`.

## Commands run and results (this session, in order)

```
$ git fetch origin main && git log origin/main -1
515533c284a2a6fd3de88af513b1188ed249d458 ... PR #780 merge — confirmed matches start prompt

$ gh pr list --state open
only Dependabot PRs — clear to branch

$ python3 .../scripts/audit_gate_a.py .   (handoff bundle's original script, before the fix)
exit 1 — 25 false-positive INCOMPLETE_APPROVAL errors (W5-F04)

$ npx vitest run src/app/dev/ui-lab/gate-a
42 files, 231 tests, all passing (both before and after this PR's changes)

$ npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a
40 files, 227 tests, all passing (both before and after)

$ npx tsc --noEmit -p tsconfig.json
exit 0, clean (both before and after)

$ npm run terminology:check
✓ No terminology violations found

$ npm run policy:verify
PASSED (arm64 wasm-rebuild DRIFT is the known, expected sandbox-architecture advisory — see
project memory; canonical x64 verification happens in real CI)

$ npm run docs:check
1 pre-existing, unrelated issue (docs/development/gate-a-w1-review, an empty *local filesystem*
directory not tracked by git — confirmed via `git ls-files`; not introduced by this branch)

$ npm run deadcode:check / npm run legacy-visual:check
✓ clean

$ node scripts/audit-gate-a-golden-authority.mjs   (corrected script)
0 issues, 25 approved, 13 candidate — after the W2 attestation fix (was 92 HASH_MISMATCH_WITH_
ATTESTATION errors before)

$ npx eslint src/app/dev/ui-lab/gate-a scripts/audit-gate-a-golden-authority.mjs
exit 0, clean
```

`npm run build` / full `npm run validate` were **not** run locally — this is a pre-existing sandbox
OOM limitation unrelated to this branch (confirmed against clean `main` in a prior session, per
project memory; passes in real CI). CI will run both on this PR.

## Artifact downloads performed (read-only, for byte verification — see `VISUAL_COVERAGE_AND_
CAPTURE.md`)

- `ui-lab-review-38260044660-1` (run `38260044660`, W4 PR's final pre-merge CI run) — 698 files,
  zip digest independently matched the GitHub API's reported digest
- `ui-lab-review-38258456189-1` (run `38258456189`, the run W4's committed attestation cites) —
  698 files, digest matched
- `ui-lab-review-38040296558-1` (run `38040296558`, the run W2's approval cites) — 164 files,
  digest matched; all 92 A04 files' SHA-256 recomputed and matched `candidate_manifest.json`
  exactly

None of these artifacts were modified, re-uploaded, or used to create any public surface (no GitHub
Release was created or attempted).

## Test plan for a reviewer

1. `npx tsc --noEmit -p tsconfig.json`, `npx eslint src/app/dev/ui-lab/gate-a`, both Gate A vitest
   suites — all should be clean/passing, unchanged from `main` except for the A10 files touched.
2. `node scripts/audit-gate-a-golden-authority.mjs` — should report 0 issues.
3. Push triggers `ui-lab-visual-review.yml`; compare the resulting A10 captures at 768px against
   A01's existing approved captures at the same width to visually confirm the breakpoint fix.
4. Diff `docs/ui-lab/gate-a-w2-candidates/capture-attestation.json` against CI artifact
   `ui-lab-review-38040296558-1` (still valid through 2026-10-17) to independently re-verify the
   W5-F03 fix.
