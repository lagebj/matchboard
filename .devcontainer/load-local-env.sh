#!/usr/bin/env bash

# This is sourced into ~/.bashrc, so it runs once per shell start and *exports* .env's contents
# (set -a) into that shell's environment, not just into one process. If you edit .env after a
# shell is already running, that shell keeps the old exported values -- `dotenv/config` (used by
# vitest.config.ts and most scripts) never overrides a variable already present in process.env,
# by design, so an already-running shell can silently keep using a stale value indefinitely. If a
# measurement or test run doesn't reflect a .env edit you just made, check `export -p | grep
# <VAR>` before assuming the app/test code is wrong -- then `unset <VAR>; source
# .devcontainer/load-local-env.sh` to force a clean reload. See
# docs/development/test-architecture.md's "A stale shell-exported TEST_DATABASE_URL can silently
# defeat all of the above" section for a real, costly example of this exact gotcha.

# Codespaces injects its secrets into the environment itself.
# Never load a repository .env over Codespaces secrets.
if [[ "${CODESPACES:-false}" == "true" ]]; then
  return 0 2>/dev/null || exit 0
fi

if [[ -n "${MATCHBOARD_WORKSPACE:-}" ]]; then
  workspace="$MATCHBOARD_WORKSPACE"
else
  workspace="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "$workspace" || ! -f "$workspace/.env" ]]; then
  return 0 2>/dev/null || exit 0
fi

set -a
# shellcheck disable=SC1090
source "$workspace/.env"
set +a
