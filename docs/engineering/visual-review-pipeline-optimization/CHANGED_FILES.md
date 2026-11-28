# Changed Files

| File | Purpose |
|---|---|
| `docs/adr/0161-on-demand-ui-lab-capture-and-deployment-evidence.md` | New ADR — the authoritative decision record for this change |
| `.github/workflows/ui-lab-visual-review.yml` | Split into `acceptance` (automatic, Playwright only) and `capture` (`workflow_dispatch` only, mode/scenarios/confirm_full inputs) |
| `scripts/ui-lab-visual-review.mjs` | Minimal wiring to the new selection module; every scenario/interaction/viewport definition unchanged |
| `scripts/ui-lab-visual-review/select-scenarios.mjs` | New — pure, unit-tested scenario-selection and validation logic |
| `scripts/ui-lab-visual-review/__tests__/select-scenarios.test.ts` | New — 14 unit tests for the above |
| `scripts/visual-authority/evidence-model.mjs` | New — pure, unit-tested evidence classification (`CAPTURE_REVIEW`/`DEPLOYMENT_REVIEW`/`NO_EVIDENCE_RECORDED`) and deployment-comment matching, including a bot-identity check on the matched comment (not body text alone) |
| `scripts/visual-authority/__tests__/evidence-model.test.ts` | New — 11 unit tests for the above, including rejection of a forged/wrong-author/wrong-type deploy comment |
| `scripts/visual-authority/archive-evidence.mjs` | Extended to derive and archive `DEPLOYMENT_REVIEW`/`NO_EVIDENCE_RECORDED` evidence when no capture run exists; `CAPTURE_REVIEW` path behavior unchanged |
| `.github/workflows/visual-authority-gate.yml` | One line: pass `PR_NUMBER` (already computed) to the `archive-evidence` job's env, for the new comment lookup |
| `docs/development/coding-agent-working-session.md` | Updated Visual Authority Gate process steps 3-4 to describe on-demand capture |
| `docs/engineering/visual-review-pipeline-optimization/*.md` | This document set |

## Not changed

- `test-acceptance.yml`, `ci-checks.yml`, `security.yml`, `test-db-migrate.yml` — untouched.
- `scripts/visual-authority/{classify,fingerprint,resolve-approval,evaluate-gate,
  check-actor-permission,visual-authority-config,revision,parse-comment,run-gate,run-deploy-request,
  deploy-pr-revision.sh,lease-cli,test-slot-lease,status-report,promote-to-golden,
  scoped-export-content,required-checks,evidence-tag}.mjs/.sh — approval/deployment decision logic
  untouched.
- Any live GitHub ruleset or required-check configuration.
- Any `docs/ui-lab/**` candidate manifest, capture attestation, or historical wave documentation.
