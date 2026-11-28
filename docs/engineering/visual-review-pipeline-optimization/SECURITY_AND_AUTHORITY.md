# Security and Authority Analysis

## What this PR touches

- `.github/workflows/ui-lab-visual-review.yml` — trigger/job restructuring only. No new secrets,
  no new permissions scope (`permissions: contents: read`, unchanged), no checkout of untrusted
  content (this workflow never checked out PR-controlled content in a privileged context anyway —
  it's not comment-triggered, has no `secrets.VERCEL_TOKEN`/`NEON_API_KEY` in scope at all).
- `scripts/ui-lab-visual-review.mjs` + new `scripts/ui-lab-visual-review/select-scenarios.mjs` —
  pure argument parsing/validation added ahead of the existing capture loop; no new file I/O,
  network calls, or credential handling.
- `scripts/visual-authority/archive-evidence.mjs` + new `scripts/visual-authority/evidence-model.mjs`
  — adds one new read (the PR's own `issue_comment`s, via the same `GH_TOKEN` this job already
  holds) and one new, narrowly-scoped env var (`PR_NUMBER`, already computed by `resolve-pr` and
  passed to the `gate` job — this just also passes it to `archive-evidence`). No new write scope:
  this job already had `contents: write` (the only job in `visual-authority-gate.yml` with it) and
  this PR does not widen what it's used for — still only `gh release create`/`gh release view`.

## What this PR does not touch, and why that matters

- `check-actor-permission.mjs`, `visual-authority-config.mjs`, `resolve-approval.mjs`,
  `evaluate-gate.mjs`, `fingerprint.mjs`, `classify.mjs`, `parse-comment.mjs`, `revision.mjs` —
  every file that decides *whether* a PR is approved. This PR changes only what gets archived
  *after* an approval already exists, never the approval decision itself.
- `visual-review-deploy.yml`'s deployment security model (fork rejection, `excludeContexts`,
  Vercel REST API `gitSource` deploy with no untrusted checkout, Test-slot lease) — unchanged.
- The `Visual Authority Gate` required-check status on ruleset `21317362` — unchanged, not
  modified, no `gh api --method PUT` performed against any live ruleset in this PR.

## New data read: PR comment bodies, for a narrow purpose

`archive-evidence.mjs` now reads the PR's `issue_comment`s only to look for an exact-format
`Deployed PR #<n> (\`<sha>\`) to the Test slot:` string — a comment `visual-review-deploy.yml`
itself already posts, from a privileged workflow, using the same `GH_TOKEN` archive-evidence
already holds. This is not new privileged access: `run-gate.mjs` (the `gate` job, same workflow)
already reads this exact PR's full comment thread for approval resolution. `archive-evidence.mjs`
only runs after `gate` already reported `APPROVED` for this PR, so it is reading the comment thread
of a PR whose approval has already been independently verified.

## No new secrets or session data are ever archived

`classifyEvidence`/`findDeploymentCommentForRevision` (both pure, unit-tested, no network access)
and the `DEPLOYMENT_REVIEW` release path only ever write: the scenario ID, the approved revision
SHA, and prose referencing the deployment comment/Test URL — all of which are already public on the
PR. No Vercel token, Neon credential, cookie, environment variable, or browser storage is read or
written anywhere in this change.

## Authorization boundaries respected

- No `gh api --method PUT` against `repos/lagebj/matchboard/rulesets/*` was run.
- No `/visual-approve`/`/visual-reject` comment was posted by this agent session, consistent with
  ADR-0159's "Self-approval / credential-indistinguishability limitation" — this PR does not
  exercise the approval flow at all, only the capture/archival plumbing around it.
- `MIGRATION_AND_ROLLBACK.md`'s consolidation analysis is a recommendation document only; it
  performs no removal of `visual-review-deploy.yml`, `visual-authority-gate.yml`, or any live
  required check.
