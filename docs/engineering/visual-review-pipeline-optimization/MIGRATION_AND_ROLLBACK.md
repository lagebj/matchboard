# Migration and Rollback

## Part 1: rolling back this PR's own changes

Every change in this PR is additive or structurally reversible:

- `ui-lab-visual-review.yml`: reverting to the prior single-job form restores automatic capture.
  No required check depends on either job's name (verified in `WORKFLOW_TRIGGER_MATRIX.md`), so
  this revert carries no ruleset migration risk in either direction.
- `scripts/ui-lab-visual-review.mjs`: the selection module is additive (see
  `CAPTURE_SELECTION_CONTRACT.md`) — invoking the script with no arguments, as every pre-existing
  caller does, is byte-for-byte the same capture-everything behavior as before this PR.
- `archive-evidence.mjs`: the new `DEPLOYMENT_REVIEW`/`NO_EVIDENCE_RECORDED` paths only run when
  `findLatestSuccessfulCaptureRun()` already returns nothing — exactly the condition that
  previously logged "archival deferred" and returned. Reverting this file restores that log line;
  no approval record is affected either way (archival has never gated approval, before or after
  this PR).
- `docs/adr/0161-...md`, the new `docs/engineering/visual-review-pipeline-optimization/` set, and
  the `coding-agent-working-session.md` edit are documentation — reverting them has no runtime
  effect.

A straight `git revert` of this PR's merge commit is safe and sufficient if a rollback is ever
needed; no data migration, ruleset change, or manual cleanup step is required in either direction.

## Part 2: governance-consolidation dependency trace (analysis only — not executed)

The owner's amendment asked whether `visual-review-deploy.yml`, `/visual-review deploy`/`release`,
`visual-authority-gate.yml`, scenario fingerprinting, and screenshot-dependent approval archival can
be retired in favor of the `acceptance`-label pipeline. This section traces the real dependencies;
it recommends a direction but **performs no removal**.

### Dependency graph (as verified in this repository, 2026-11-28)

```
ruleset 21317362 (required_status_checks)
  └─ "Visual Authority Gate"  ←── produced only by visual-authority-gate.yml's `gate` job
        └─ reads: scripts/visual-authority/{classify,fingerprint,resolve-approval,
                   evaluate-gate,check-actor-permission,visual-authority-config,revision,
                   parse-comment}.mjs
        └─ writes: Checks API conclusion against the PR's head SHA (no other storage)

visual-authority-gate.yml `archive-evidence` job (needs: gate, only if APPROVED)
  └─ reads: ui-lab-visual-review.yml's most recent successful run for this SHA (optional,
             ADR-0161 made this routinely absent), OR the PR's own deployment comment
             (ADR-0161 addition)
  └─ writes: GitHub Releases (evidence only, never gates merge)

visual-review-deploy.yml (issue_comment: /visual-review deploy|release)
  └─ shares: `test-slot` concurrency group, TEST_SLOT_LEASE repo variable, and the `test`
             Vercel Custom Environment WITH test-acceptance.yml and test-db-migrate.yml
  └─ depends on: required-checks.mjs excluding "Visual Authority Gate" itself from its own
             green-check gate (the 2026-10-21 circularity fix) — this exclusion only makes
             sense because Visual Authority Gate exists as a separate required check; removing
             the gate would make this exclusion logic dead code, not a problem, but it IS a
             real coupling to trace.

test-acceptance.yml (acceptance label / PR close)
  └─ shares: the SAME `test-slot` concurrency group and `test` Custom Environment
  └─ provisions: an isolated Neon branch, a Cloudflare Worker deploy — resources
             visual-review-deploy.yml deliberately does NOT provision
```

### What is, and is not, actually redundant

- **Test-slot lease ownership**: both `visual-review-deploy.yml` and `test-acceptance.yml` already
  coordinate correctly today via the shared `test-slot` concurrency group — this is not a
  duplicated mechanism, it's one shared lock two different deploy paths both respect. Removing
  `visual-review-deploy.yml` would not simplify this; the lock already works.
- **Cost profile is NOT identical**: `visual-review-deploy.yml` provisions zero Neon/Cloudflare
  resources (Vercel API `gitSource` deploy only); `test-acceptance.yml` provisions a full isolated
  Neon branch and a Worker deploy. A PR that only needs a human to look at a UI Lab candidate's
  rendered output — not full functional/Worker/database behavior — genuinely costs less through
  the lightweight path. Collapsing to one path means either (a) every UI-Lab-only review now pays
  for a Neon branch + Worker deploy it doesn't need, or (b) `test-acceptance.yml` would need a new
  "lightweight" mode built into it, which is new work, not pure removal.
- **Approval semantics are NOT equivalent**: `test-acceptance.yml`'s label mechanism records
  "the owner applied/re-applied a label for this exact commit" — it has no scenario-scoped
  fingerprinting, no `/visual-approve <sha>` ledger entry, no distinction between "approved" and
  "deployed for inspection." `Visual Authority Gate` exists specifically to make approval an
  explicit, durable, auditable act independent of deployment success. Retiring it without
  replacement would remove that distinction, not just a redundant deployment mechanism.

### Recommendation (not executed in this PR)

Do not retire `visual-authority-gate.yml`'s approval/fingerprinting core — it is not redundant with
anything the `acceptance` label provides. **Retiring `visual-review-deploy.yml`'s lightweight deploy
path specifically** (keeping the Visual Authority Gate, but routing all human visual review through
the `acceptance` label instead of `/visual-review deploy`) is the narrower, more defensible
consolidation: it removes one of the two deployment mechanisms while keeping the one approval
mechanism intact. Before doing even that:

1. Confirm with the owner that losing the zero-Neon-resource lightweight path's cost advantage for
   UI-Lab-only PRs is acceptable.
2. Update `evaluate-gate.mjs`'s and `run-deploy-request.mjs`'s `excludeContexts` coupling (the
   2026-10-21 circularity fix) — if `visual-review-deploy.yml` is removed, this exclusion becomes
   dead code in `required-checks.mjs`; verify nothing else depends on it before deleting.
2. Update `coding-agent-working-session.md`'s step 5 (currently documents `/visual-review deploy`)
   to point at the `acceptance` label exclusively.
3. **Do not** perform step 4 below (ruleset/required-check removal) — `Visual Authority Gate`
   should remain required regardless of which deployment path feeds it, since it is the approval
   record, not the deployment mechanism.
4. If `visual-review-deploy.yml` is removed: delete the workflow file and
   `scripts/visual-authority/{deploy-pr-revision.sh,run-deploy-request.mjs}` only after confirming
   via a fresh `gh api repos/lagebj/matchboard/rulesets/21317362` read that nothing in the live
   ruleset references it by name (nothing currently does — verified in this PR — but re-verify
   immediately before any future removal, since ruleset contents can change between now and then,
   per ADR-0159's own Stage B precedent of re-reading immediately before acting).

This recommendation is deliberately conservative: it is a plan for a future PR, authorized by the
owner, not an action this PR takes.
