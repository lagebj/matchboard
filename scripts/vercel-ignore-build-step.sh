#!/usr/bin/env bash
# Vercel "Ignored Build Step" (wired via vercel.json's ignoreCommand). Applies to the single
# `matchboard` project, which now also hosts the `test` Custom Environment (ADR-0153 superseded
# the old two-linked-projects architecture this file's previous header described).
#
# Exit 0 = skip this deployment. Exit non-zero = build normally.
#
# CORRECTION (found live, 2026-10-20, ADR-0159's first real `/visual-review deploy` attempts on
# PR #790): this build step runs for EVERY deployment that reaches Vercel's build pipeline,
# including a `gitSource`-based REST API deployment targeting a named Custom Environment — not
# only ordinary git-push-triggered ones. The previous comment here ("ignoreCommand does not gate
# explicit ... REST-API-triggered deployments, confirmed against Vercel's docs") was wrong: two
# separate real `deploy-pr-revision.sh` attempts (dpl_5u7G2HBY5XWveRMLKTdBjg2rYDKB,
# dpl_F71c14Hyvi6PbSreDNLW4Jph91hM) were silently CANCELED by this exact "not main" check below,
# because `VERCEL_GIT_COMMIT_REF` reflects the real git branch of the deployed commit (per
# Vercel's system-environment-variables docs), which for a PR revision is never `main` even though
# `gitSource.ref` was a bare commit SHA.
#
# First check: always build when this deployment targets the `test` Custom Environment
# (`VERCEL_TARGET_ENV == "test"`), regardless of branch. The ONLY way a deployment reaches this
# project's `test` Custom Environment is an explicit, already-governed action — either the
# post-merge `main` baseline redeploy (test-db-migrate.yml) or a comment-gated, permission- and
# required-checks-checked `/visual-review deploy` request (visual-review-deploy.yml) — never an
# automatic branch push, since ordinary PR/feature/fix branch pushes deploy to the standard
# `preview` environment, not `test`. The skip-eligibility heuristic below exists purely to avoid
# needless *automatic* `main` rebuilds; it has no bearing on these already-deliberate requests, so
# it's bypassed entirely here rather than risked against a `test`-target PR revision.
#
# Second check: skip outright unless this is a push to `main`. A normal push to any other branch
# (feature/*, fix/*, chore/*, Dependabot branches, arbitrary PR branches) must never trigger an
# automatic Vercel build — the coding-agent development loop should cost zero remote
# infrastructure (ADR-0153). This is the one and only place that rule is enforced; it is not
# equivalent to the docs-only skip-eligibility check below, which only applies once a push to
# `main` has already passed this gate.
#
# Third check (main only): skip only when every file changed since the last deployed commit is
# classified skip-eligible by scripts/is-build-skip-eligible.sh (the shared predicate also used
# by test-acceptance.yml's own Neon/Test-slot skip check — see that script's own doc comment for
# the full path list and why it exists as one file rather than two independently-maintained
# copies). See docs/adr/0075-per-pr-feature-acceptance-pipeline.md's History: a docs-only wording
# commit on PR #313 (2026-08-20) exhausted this project's Vercel deploy quota for no functional
# reason.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if [ "${VERCEL_TARGET_ENV:-}" = "test" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
  echo "Deploying a non-main ref into the 'test' Custom Environment (ADR-0159 lightweight visual-review deploy, or an equivalent already-governed request) — building unconditionally."
  exit 1
fi

if [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
  echo "Branch '${VERCEL_GIT_COMMIT_REF:-<unknown>}' is not main — skipping automatic build (ADR-0153: only main auto-deploys)."
  exit 0
fi

BASE_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$BASE_SHA" ]; then
  # No previous DEPLOYMENT exists for this branch yet — Vercel only ever populates
  # VERCEL_GIT_PREVIOUS_SHA once a branch has been deployed before. Confirmed live, 2026-09-24:
  # a brand-new PR branch's very first push always built regardless of content (PR #673, a
  # docs-only commit that scripts/is-build-skip-eligible.sh itself classifies as skip-eligible),
  # because this branch fell straight into an unconditional "building" default before the
  # classifier ever ran.
  #
  # An earlier version of this fallback computed `git merge-base FETCH_HEAD HEAD` — wrong, and
  # confirmed failing live again on 2026-09-24 (PR #680: "could not establish a merge-base with
  # main — building to be safe", on a docs-only change). Root cause: Vercel's own initial clone
  # of a branch is shallow (depth=1) — HEAD has no parent commits reachable at all in local
  # history, so `merge-base` can never find a common ancestor with anything, no matter what's
  # fetched for main, even when the true fork point IS exactly main's current tip (confirmed by
  # reproducing the exact same shallow clone locally). `git diff` between two arbitrary commits
  # needs no shared ancestry, though — only that both commit objects exist locally, which the
  # depth=1 fetch below already guarantees. Diff straight against origin/main's fetched tip
  # instead of trying to compute a merge-base at all.
  if git fetch --quiet --depth=1 origin main 2>/dev/null && BASE_SHA="$(git rev-parse FETCH_HEAD 2>/dev/null)" && [ -n "$BASE_SHA" ]; then
    echo "No previous deployed SHA for this branch — diffing against origin/main's tip (${BASE_SHA}) instead."
  else
    echo "No previous deployed SHA available, and could not fetch origin/main — building to be safe."
    exit 1
  fi
else
  # A rebased/force-pushed branch can point VERCEL_GIT_PREVIOUS_SHA at a commit that no longer
  # exists in this history (confirmed live, 2026-08-24: "fatal: bad object" broke every deploy on
  # a branch after a routine rebase-onto-main + force-push). git diff has no graceful failure mode
  # for a missing object, so check reachability first and fail safe (build) rather than error out.
  if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
    echo "Previous deployed SHA ${BASE_SHA} not found in this history (rebase/force-push?) — building to be safe."
    exit 1
  fi
fi

CHANGED_FILES="$(git diff --name-only "$BASE_SHA" HEAD)"

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files reported — building to be safe."
  exit 1
fi

VERDICT="$(echo "$CHANGED_FILES" | "$SCRIPT_DIR/is-build-skip-eligible.sh" app-deploy)"

if [ "$VERDICT" = "skip" ]; then
  echo "Every changed file since ${BASE_SHA} is build-skip-eligible (docs/tracking/agent-tooling only) — skipping build."
  exit 0
fi

echo "At least one changed file since ${BASE_SHA} may affect the running app — building."
exit 1
