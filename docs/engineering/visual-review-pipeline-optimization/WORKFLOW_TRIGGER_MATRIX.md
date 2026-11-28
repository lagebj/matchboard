# Workflow Trigger Matrix

## `ui-lab-visual-review.yml`

| Event | Before | After |
|---|---|---|
| Push to PR touching a UI-Lab path (first time) | `capture` job runs: full capture (~1,700 screenshots, ~20m35s) + all 4 Playwright suites, one job | `acceptance` job runs: 4 Playwright suites only (~5m30s). `capture` job does **not** run. |
| Push to PR touching a UI-Lab path (subsequent commits, still matching the filter) | Same full job re-runs again | Same: `acceptance` re-runs (cheap); `capture` does not run |
| Documentation-only commit inside an otherwise UI-Lab-relevant PR, not itself touching a filtered path | Does not trigger (path filter already excluded it) | Unchanged — does not trigger |
| Manual `workflow_dispatch`, `mode: targeted`, valid `scenarios` | N/A (dispatch existed but script had no selection capability — would have captured everything regardless of intent) | `capture` runs, capturing only the requested scenarios; `acceptance` also runs (Playwright suites) |
| Manual `workflow_dispatch`, `mode: full`, `confirm_full: FULL CAPTURE` | N/A | `capture` runs the full registry (same cost as the old automatic run); `acceptance` also runs |
| Manual `workflow_dispatch`, `mode: targeted`, empty `scenarios` | N/A | Job fails at the "Validate capture mode inputs" step before Chromium installs — never runs zero-and-reports-success |
| Manual `workflow_dispatch`, `mode: full`, missing/wrong `confirm_full` | N/A | Job fails at the same validation step |

## `visual-authority-gate.yml`, `visual-review-deploy.yml`, `test-acceptance.yml`

Unchanged — every existing trigger (PR lifecycle events, `issue_comment`, the `acceptance` label,
PR close) is untouched by this PR. `visual-authority-gate.yml`'s `archive-evidence` job gains one
new env var (`PR_NUMBER`, already available from its own `resolve-pr` job output) to support the
deployment-review evidence lookup in `VISUAL_EVIDENCE_MODEL.md` — its trigger is unchanged.

## Required-check continuity

`gh api repos/lagebj/matchboard/rulesets/21317362 --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context'`
lists: `TypeScript Check`, `Lint`, `Tests`, `Tests (Workers)`, `Forbidden SQL Methods`,
`Supply Chain Integrity`, `Version Verify`, `Migration from Zero`, `Build`, `Semgrep SAST`,
`OSV Dependency Scan`, `Gitleaks Secret Detection`, `Visual Authority Gate`.

None of `ui-lab-visual-review.yml`'s job names appear in this list. This PR does not add, rename, or
remove any required check, and does not touch the live ruleset.
