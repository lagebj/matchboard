#!/usr/bin/env bash
# Vercel "Ignored Build Step" (wired via vercel.json's ignoreCommand). Applies to both linked
# projects (matchboard, matchboard-test), since both read the same repo-root vercel.json.
#
# Exit 0 = skip this deployment. Exit non-zero = build normally. Skips only when every file
# changed since the last deployed commit is classified skip-eligible by
# scripts/is-build-skip-eligible.sh (the shared predicate also used by test-acceptance.yml's own
# Neon/Test-slot skip check — see that script's own doc comment for the full path list and why
# it exists as one file rather than two independently-maintained copies). See
# docs/adr/0075-per-pr-feature-acceptance-pipeline.md's History: a docs-only wording commit on
# PR #313 (2026-08-20) exhausted this project's Vercel deploy quota for no functional reason.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  echo "No previous deployed SHA available (first deploy for this branch/project) — building."
  exit 1
fi

# A rebased/force-pushed branch can point VERCEL_GIT_PREVIOUS_SHA at a commit that no longer
# exists in this history (confirmed live, 2026-08-24: "fatal: bad object" broke every deploy on
# a branch after a routine rebase-onto-main + force-push). git diff has no graceful failure mode
# for a missing object, so check reachability first and fail safe (build) rather than error out.
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  echo "Previous deployed SHA ${VERCEL_GIT_PREVIOUS_SHA} not found in this history (rebase/force-push?) — building to be safe."
  exit 1
fi

CHANGED_FILES="$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD)"

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files reported — building to be safe."
  exit 1
fi

VERDICT="$(echo "$CHANGED_FILES" | "$SCRIPT_DIR/is-build-skip-eligible.sh" app-deploy)"

if [ "$VERDICT" = "skip" ]; then
  echo "Every changed file since ${VERCEL_GIT_PREVIOUS_SHA} is build-skip-eligible (docs/tracking/agent-tooling only) — skipping build."
  exit 0
fi

echo "At least one changed file since ${VERCEL_GIT_PREVIOUS_SHA} may affect the running app — building."
exit 1
