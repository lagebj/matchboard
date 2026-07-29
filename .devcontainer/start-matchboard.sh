#!/usr/bin/env bash
set -Eeuo pipefail

cd "${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

if [[ -f pnpm-lock.yaml ]]; then
  exec pnpm run dev -- --hostname 0.0.0.0 --port 3000
fi

if [[ -f yarn.lock ]]; then
  exec yarn dev --hostname 0.0.0.0 --port 3000
fi

if [[ -f package-lock.json || -f package.json ]]; then
  exec npm run dev -- --hostname 0.0.0.0 --port 3000
fi

echo "No supported Node package manifest found." >&2
exit 1
