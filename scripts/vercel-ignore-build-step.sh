#!/usr/bin/env bash
# Vercel "Ignored Build Step" (wired via vercel.json's ignoreCommand). Applies to both linked
# projects (matchboard, matchboard-test), since both read the same repo-root vercel.json.
#
# Exit 0 = skip this deployment. Exit non-zero = build normally. Skips only when every file
# changed since the last deployed commit is docs/tracking-only (root markdown, docs/**,
# .matchboard-work/**) — none of those can affect the running app. See
# docs/adr/0075-per-pr-feature-acceptance-pipeline.md's History: a docs-only wording commit on
# PR #313 (2026-08-20) exhausted this project's Vercel deploy quota for no functional reason.
set -euo pipefail

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

while IFS= read -r file; do
  case "$file" in
    docs/*|.matchboard-work/*|*.md) ;;
    *)
      echo "Non-doc file changed ($file) — building."
      exit 1
      ;;
  esac
done <<< "$CHANGED_FILES"

echo "Only docs/tracking files changed since ${VERCEL_GIT_PREVIOUS_SHA} — skipping build."
exit 0
