#!/usr/bin/env bash
# Single source of truth for "can this set of changed files possibly affect the deployed
# Matchboard app (or the data a Test-slot deploy would exercise)?" — shared by two independent
# callers that each obtain their own file list a different way:
#
#   - scripts/vercel-ignore-build-step.sh (Vercel's ignoreCommand, both `matchboard` and
#     `matchboard-test` projects) — sources its list via `git diff --name-only` in Vercel's own
#     build environment.
#   - .github/workflows/test-acceptance.yml's "Check whether this push only touched
#     docs/tracking files" step — sources its list via the GitHub compare API, because a GitHub
#     Actions checkout doesn't have every commit's parent readily diffable the same way.
#
# Before this script existed, each caller had its own independently-maintained copy of this
# path list — confirmed drifted in practice: `vercel-ignore-build-step.sh` already knew
# `security/**` was skip-eligible (ADR-0150's credential-broker subsystem is deployed
# independently, never part of the Next.js bundle) but test-acceptance.yml's copy was never
# updated to match, so a security-subsystem-only PR still paid for a full Neon branch + Test-slot
# Vercel deploy that only the OTHER half of this same protection already correctly skipped. One
# script, read by both, makes that class of drift structurally impossible going forward.
#
# Contract: reads a newline-separated list of changed file paths on stdin (repo-relative, no
# leading `./`), prints exactly one of `skip` or `build` on stdout, always exits 0 — callers
# interpret the printed word into their own exit-code/output-variable convention rather than
# relying on this script's exit status, so the same classifier serves two different call
# conventions cleanly.
#
# The rule (per user direction, 2026-09-24): only trigger a build/deploy when application code
# was actually touched. Implemented as a maintained "known non-app path" skip-list rather than a
# literal allow-list of app paths, so the FAIL-OPEN direction is "build" — an unrecognized path
# (a new top-level directory nobody has classified yet) always builds. ADR-0075's own History is
# a repeated lesson in why: every real incident in this pipeline's history was a check silently
# skipping something it shouldn't have, never the reverse. `.github/**` (this repo's own
# CI/deploy workflow definitions) is deliberately NOT skip-eligible — a workflow change can be
# buggy and deserves real verification through the exact infrastructure it configures, the same
# "the introducing PR is its own first live test" principle ADR-0075's "Rollout safety" section
# already establishes.
#
# Skip-eligible (none of these can affect the deployed app or Test-slot data):
#   docs/**              — documentation
#   .matchboard-work/**  — programme-local tracking, never repo behavior
#   **/*.md              — markdown anywhere (root README, module docs, etc.)
#   security/**           — the Scaleway credential-broker subsystem (ADR-0150): independently
#                            deployed OpenTofu/Go, never part of the Next.js app bundle
#   models/**            — swamp model definitions (agent tooling config)
#   extensions/**        — swamp extension lockfile (agent tooling config)
#   .claude/**           — Claude Code skills/settings (agent tooling config)
#   .devcontainer/**     — devcontainer config; never shipped, never affects the running app
set -euo pipefail

FILES="$(cat)"

if [ -z "$FILES" ]; then
  echo "build"
  exit 0
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|.matchboard-work/*|*.md|security/*|models/*|extensions/*|.claude/*|.devcontainer/*) ;;
    *)
      echo "build"
      exit 0
      ;;
  esac
done <<< "$FILES"

echo "skip"
