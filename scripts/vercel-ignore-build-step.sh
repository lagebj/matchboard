#!/usr/bin/env bash
# Vercel "Ignored Build Step" (wired via vercel.json's ignoreCommand). Applies to the single
# `matchboard` project, which now also hosts the `test` Custom Environment (ADR-0153 superseded
# the old two-linked-projects architecture this file's previous header described).
#
# Exit 0 = skip this deployment. Exit non-zero = build normally. Only a Git-triggered deployment
# (a real push) ever reaches this script — ignoreCommand does not gate explicit `vercel deploy`/
# REST-API-triggered deployments (confirmed against Vercel's docs), which is exactly what lets
# the Test-acceptance pipeline's own explicit `vercel deploy --target=test` calls
# (scripts/test-acceptance/deploy.sh, and the post-merge test-db-migrate.yml baseline job) keep
# working unconditionally below.
#
# First check: skip outright unless this is a push to `main`. A normal push to any other branch
# (feature/*, fix/*, chore/*, Dependabot branches, arbitrary PR branches) must never trigger an
# automatic Vercel build — the coding-agent development loop should cost zero remote
# infrastructure (ADR-0153). This is the one and only place that rule is enforced; it is not
# equivalent to the docs-only skip-eligibility check below, which only applies once a push to
# `main` has already passed this gate.
#
# Second check (main only): skip only when every file changed since the last deployed commit is
# classified skip-eligible by scripts/is-build-skip-eligible.sh (the shared predicate also used
# by test-acceptance.yml's own Neon/Test-slot skip check — see that script's own doc comment for
# the full path list and why it exists as one file rather than two independently-maintained
# copies). See docs/adr/0075-per-pr-feature-acceptance-pipeline.md's History: a docs-only wording
# commit on PR #313 (2026-08-20) exhausted this project's Vercel deploy quota for no functional
# reason.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

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
