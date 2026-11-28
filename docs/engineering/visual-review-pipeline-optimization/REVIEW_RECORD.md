# Independent Review Record

A fresh, independent review agent (no access to this implementation session's context) reviewed
commit `1274e32b1` of this branch by reading every changed file in full, re-deriving claims against
the live GitHub ruleset and real Actions run history via `gh`, and independently re-running the new
unit tests and lint.

## Verification the reviewer performed directly (not taken on trust)

- Ran `npx vitest run scripts/ui-lab-visual-review/__tests__/select-scenarios.test.ts
  scripts/visual-authority/__tests__/evidence-model.test.ts` — 22 tests passed (at that commit;
  14 + 8).
- Ran `npx eslint` against all four touched/new script files — clean.
- Read the live ruleset (`gh api repos/lagebj/matchboard/rulesets/21317362` and `19904761`) and
  confirmed the required-check list independently, rather than trusting the PR's own claim.
- Confirmed via `git diff` that every approval/fingerprint/permission file in
  `scripts/visual-authority/` (18 files) and every other CI workflow (`test-acceptance.yml`,
  `ci-checks.yml`, `security.yml`, `test-db-migrate.yml`, `visual-review-deploy.yml`) has zero
  changes.
- Pulled the real Actions run history for this branch and found a live dispatched run
  (46126789665) that had already exercised the unknown-scenario-id rejection and the
  acceptance/capture job independence end-to-end — used that as primary evidence rather than
  re-deriving it from the diff alone.
- Independently counted registered scenarios (`grep -c "slug:"` → 109) to check the docs' claim.

## Findings and disposition

| # | Finding | Severity | Outcome |
|---|---|---|---|
| 1 | `findDeploymentCommentForRevision` matched purely on comment body text, with no check on who posted it — an unprivileged PR commenter could forge a "Deployed PR #<n>" comment and get a permanent `DEPLOYMENT_REVIEW` GitHub Release archived with a false provenance claim. `SECURITY_AND_AUTHORITY.md`/`VISUAL_EVIDENCE_MODEL.md` both asserted the match was inherently "from a privileged workflow" — a claim the code didn't actually enforce. | MAJOR | **Fixed.** `evidence-model.mjs` now requires `comment.user.login === "github-actions[bot]"` and `comment.user.type === "Bot"`, verified against a real "Deployed PR #..." comment on this repository (PR #805) before writing the check. Added 3 new unit tests: forged human commenter, right-login/wrong-type, and no `user` field at all — all rejected. Both docs rewritten to describe the actual enforced check instead of an unverified assumption. |
| 2 | `ADR-0161` and `CURRENT_STATE.md` cited a `PERFORMANCE_EVIDENCE.md` file that did not exist in the diff. | MINOR | **Fixed.** `PERFORMANCE_EVIDENCE.md` written with real measured numbers from dispatched runs on this branch (see that file). |
| 3 | `CAPTURE_SELECTION_CONTRACT.md` and `CHANGED_FILES.md` both claimed "15" unit tests for `select-scenarios.test.ts`; the real count (confirmed by the reviewer's own `vitest` run) was 14. | MINOR | **Fixed.** Both docs corrected to 14. `CHANGED_FILES.md`'s `evidence-model.test.ts` count also corrected to reflect the 3 tests added for finding #1 (8 → 11). |
| 4 | `MIGRATION_AND_ROLLBACK.md`'s "Recommendation" list numbered its steps `1, 2, 2, 3, 4` (duplicate "2."). | MINOR | **Fixed.** Renumbered `1, 2, 3, 4, 5`. |
| 5 (observation, not a finding against this PR) | The pre-existing `concurrency: group: ui-lab-review-${{ github.ref }}` / `cancel-in-progress: true` is shared by the new `acceptance` and `capture` jobs (as it was by the single job before). A manual `capture` dispatch could cancel an in-flight automatic `acceptance` run on the same branch, or vice versa. This is unchanged from before this PR, not a regression — noted because `acceptance` now carries real automatic regression coverage. | — | Documented in `WORKFLOW_TRIGGER_MATRIX.md` as a known, pre-existing, unfixed limitation. Not addressed in this PR — out of scope for a capture-cost optimization. |

## Questions the reviewer answered explicitly (all 14, from the original design brief's mandatory list)

All 14 were answered "yes" / "no risk found" / "accurate," with finding #1 above as the one
substantive exception (now fixed) — see the reviewer's full report (preserved in this session's
transcript) for the per-question verdicts: automatic bulk capture stops; targeted/full capture both
run correctly with real validation (verified against a live CI run, not just unit tests);
registration order and viewport/theme/interaction coverage are preserved; the Playwright suites are
provably independent of capture (verified live: `capture` failed while `acceptance` kept running in
the same dispatch); no required check is at risk of being left permanently pending (re-verified
against the live ruleset); `Visual Authority Gate`'s approval/fingerprint/permission logic is
untouched; archival never affects approval validity; no shell/Actions-expression injection exists in
the new YAML; historic evidence/releases are unaffected; the `MIGRATION_AND_ROLLBACK.md` dependency
claims check out against the live repository.

## Overall disposition

No BLOCKING findings, at review time or after remediation. One MAJOR finding, fixed with real code
changes (not just documentation softening) and new regression tests before this PR's final commit.
Three MINOR documentation-accuracy findings, fixed. This PR was not self-certified — every claim
above was independently re-derived by a reviewer with no access to this implementation's own
reasoning, against the live repository and real CI runs, not against this session's own assertions.
