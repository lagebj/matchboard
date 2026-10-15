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

## Independent technical review, round 1 — remediation (W5-R1 through W5-R4)

See `CONFLICT_AND_BLOCKER_REGISTER.md`'s "Independent technical review findings (round 1)" section
for the full per-finding writeup and `REVIEW_RECORD.md` for the review-status summary. File-by-file:

| File | Change | Why |
|---|---|---|
| `scripts/lib/gate-a-authority.mjs` | New — shared loader/audit/inventory module, factored out of the old single-file `audit-gate-a-golden-authority.mjs` so the new generator script reuses the exact same manifest-parsing logic | W5-R1, W5-R2 |
| `scripts/audit-gate-a-golden-authority.mjs` | Rewritten as a thin CLI over `scripts/lib/gate-a-authority.mjs`'s `auditGateA`; now accepts an optional `repoRoot` argv for testability; completion is a positive requirement over an explicit expected-scenario registry; `APPROVED_FILE_NOT_IN_ATT` and `UNRECOGNIZED_STATUS` promoted to errors; two new structural checks (`MISSING_REQUIRED_VIEWPORT`, `MISSING_THEME_PAIR`); output carries an explicit `scopeDisclaimer` | W5-R1 |
| `scripts/generate-gate-a-authority-inventory.mjs` | New — deterministic inventory generator, read-only by default, `--write` required to touch the repo; four separated provenance fields instead of one overloaded `revisionSha` | W5-R2 |
| `scripts/__tests__/audit-gate-a-golden-authority.test.ts` | New — 28 tests: the 15 required negative-test scenarios (plus 2 structural-check tests, 3 provenance-field tests, 4 CLI-behavior tests, 4 generator tests), using synthetic fixture directories built with `mkdtempSync`, following the repo's existing `scripts/__tests__/check-prisma-query-fields.test.ts` pattern (`scripts/**/*.test.ts` is already in `vitest.config.ts`'s `include`) | W5-R1 |
| `docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv` | Regenerated via `node scripts/generate-gate-a-authority-inventory.mjs --write` — 488 approved captures (was 494), new provenance columns | W5-R2 |
| `docs/ui-lab/gate-a-w5-convergence/AUTHORITY_INVENTORY.md` | Rewritten: corrected totals, new provenance-field table, new "Golden-authority completion semantics" section documenting the W5-R1 rewrite | W5-R1, W5-R2 |
| `docs/ui-lab/gate-a-w5-convergence/VISUAL_COVERAGE_AND_CAPTURE.md` | Fixed a separate arithmetic error in the closing "Total capture counts" section (694 → the correct 674 = 488 + 186) found while reconciling totals for W5-R2 | W5-R2 (adjacent fix, same root cause class) |
| `docs/ui-lab/gate-a-w5-convergence/CROSS_WAVE_CONSISTENCY.md` | Dangling `` `AUTOMATED_VALIDATION_AND_REGRESSION.md` `` reference replaced with `` `CHANGED_FILES.md` `` | W5-R4 |
| `docs/ui-lab/gate-a-w5-convergence/CONFLICT_AND_BLOCKER_REGISTER.md` | New "Independent technical review findings (round 1)" section (W5-R1 through W5-R4, all `RESOLVED`) | All four |
| `docs/ui-lab/gate-a-w5-convergence/REVIEW_RECORD.md` | New "Independent technical review — round 1" section summarizing the findings and fixes | All four |
| `src/app/dev/ui-lab/gate-a/page.tsx` | Visible subhead copy corrected from "not approved goldens" (false for 25/38 entries) to naming which families are approved vs. candidate | W5-R3 |

### Commands run and results (this remediation round)

```
$ git fetch origin design/gate-a-w5-golden-consistency-convergence
6a143d1c8157a52070b670c82d1a8638851544d6 — confirmed matches the review's last-reviewed head
exactly; nothing had changed on the branch since review, so none of the four findings were
already corrected by an intervening commit.

$ node scripts/audit-gate-a-golden-authority.mjs   (rewritten script, against this branch)
exit 0 — expectedScenarios: {totalManifestEntries: 38, totalLogicalScenarioIds: 39, approved: 25,
pending: 13, missing: []}; completionCriteria: {allExpectedScenariosPresent: true,
allApprovedGolden: false, zeroIntegrityErrors: true}; goldenAuthorityComplete: false; issues: []
(zero — the two new structural checks, MISSING_REQUIRED_VIEWPORT and MISSING_THEME_PAIR, were
validated against the real 25 approved entries BEFORE being enabled, specifically to avoid
repeating the W5-R1-class mistake of shipping a check with undiscovered false positives)

$ node scripts/generate-gate-a-authority-inventory.mjs | python3 -c "import csv,sys;
r=list(csv.DictReader(sys.stdin)); print(len(r), sum(int(x['approvedCaptureCount']) for x in r
if x['status']=='APPROVED_GOLDEN'))"
38 488

$ node scripts/generate-gate-a-authority-inventory.mjs > /tmp/inv1.csv &&
  node scripts/generate-gate-a-authority-inventory.mjs > /tmp/inv2.csv && diff /tmp/inv1.csv /tmp/inv2.csv
(no output — byte-identical across repeated runs)

$ node scripts/generate-gate-a-authority-inventory.mjs --write
Wrote 38 rows to docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv

$ npx vitest run scripts/__tests__/audit-gate-a-golden-authority.test.ts
28 tests, all passing (15 required negative-test scenarios + structural/provenance/CLI coverage)

$ npx vitest run src/app/dev/ui-lab/gate-a scripts/__tests__/audit-gate-a-golden-authority.test.ts
43 files, 259 tests, all passing

$ npm run typecheck   (tsc --noEmit, exact CI command)
exit 0, clean. CI's own "TypeScript Check" job caught a real error this local run initially
missed (a stale incremental .tsbuildinfo cache masked two TS2739 errors in the new test file —
EXPECTED_SCENARIOS/WAVES needed explicit `@type {Record<string, string[]>}` JSDoc annotations so
a synthetic test override covering fewer than all 4 waves type-checks against the shared module's
default-parameter inference). Fixed in scripts/lib/gate-a-authority.mjs, re-verified locally with
a cleared cache before re-pushing.

$ npx eslint scripts/__tests__/audit-gate-a-golden-authority.test.ts scripts/lib/gate-a-authority.mjs
  scripts/audit-gate-a-golden-authority.mjs scripts/generate-gate-a-authority-inventory.mjs
  scripts/ui-lab-visual-review.mjs
exit 0, clean (scoped to exactly this PR's own files — `scripts/` broadly has 68 pre-existing
lint errors in unrelated files this PR never touches, e.g. seed-test-dataset.ts; `scripts/` is not
part of `npm run lint`'s actual target list in package.json, so none of that is a regression or a
CI gate). All 25 `no-explicit-any` violations the stricter scoped lint found in this PR's own new
test file were fixed properly (explicit `Issue`/`Capture`/`Approval`/`ManifestEntry` types and
non-null assertions in place of `any` casts), not suppressed.

$ npm run terminology:check
✓ No terminology violations found

$ npm run policy:verify
PASSED (arm64 wasm-rebuild DRIFT is the known, expected sandbox-architecture advisory)

$ npm run docs:check
same single pre-existing, unrelated, untracked-local-directory notice as before — nothing new

$ grep -rn "AUTOMATED_VALIDATION_AND_REGRESSION" docs/ui-lab/gate-a-w5-convergence/*.md
(no output — both dangling references removed)

$ grep -n "not approved goldens" src/app/dev/ui-lab/gate-a/page.tsx
(no output — misleading copy removed)
```
