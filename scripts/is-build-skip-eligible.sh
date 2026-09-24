#!/usr/bin/env bash
# Single source of truth for "can this set of changed files possibly affect the deployed
# Matchboard app (or the data a Test-slot/CI run would exercise)?" — shared by two independent
# callers that each obtain their own file list a different way, plus one caller that can't call
# this script at all and must instead be kept in sync with it by hand:
#
#   - scripts/vercel-ignore-build-step.sh (Vercel's ignoreCommand, both `matchboard` and
#     `matchboard-test` projects) — sources its list via `git diff --name-only` in Vercel's own
#     build environment.
#   - .github/workflows/test-acceptance.yml's "Check whether this push only touched
#     docs/tracking files" step — sources its list via the GitHub compare API, because a GitHub
#     Actions checkout doesn't have every commit's parent readily diffable the same way.
#   - .github/workflows/ci-checks.yml's `on:` block — GitHub Actions `paths-ignore` is static
#     YAML glob matching with no way to invoke an external script, so its list is a literal,
#     manually-synced copy of the `case` patterns below. Keep both edits together.
#
# Before this script existed, each script-based caller had its own independently-maintained copy
# of this path list — confirmed drifted in practice: `vercel-ignore-build-step.sh` already knew
# `security/**` was skip-eligible (ADR-0150's credential-broker subsystem is deployed
# independently, never part of the Next.js bundle) but test-acceptance.yml's copy was never
# updated to match, so a security-subsystem-only PR still paid for a full Neon branch + Test-slot
# Vercel deploy that only the OTHER half of this same protection already correctly skipped. One
# script, read by both, makes that class of drift structurally impossible for those two; the
# YAML-based third caller has no such guarantee and needs a human (or agent) to keep it matching
# on every edit here.
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
# skipping something it shouldn't have, never the reverse.
#
# Skip-eligible everywhere (none of these can affect the deployed app or Test-slot data):
#   docs/**              — documentation
#   .matchboard-work/**  — programme-local tracking, never repo behavior
#   **/*.md              — markdown anywhere (root README, module docs, etc.)
#   security/**           — the Scaleway credential-broker subsystem (ADR-0150): independently
#                            deployed OpenTofu/Go, never part of the Next.js app bundle
#   models/**            — swamp model definitions (agent tooling config)
#   extensions/**        — swamp extension lockfile (agent tooling config)
#   .claude/**           — Claude Code skills/settings (agent tooling config)
#   .devcontainer/**     — devcontainer config; never shipped, never affects the running app
#
# `.github/**` (this repo's own CI/deploy workflow definitions, issue/PR templates, etc.) is a
# split case, not a single yes/no — the two callers are asking genuinely different questions:
#   - "Can this affect the deployed Next.js app?" (vercel-ignore-build-step.sh, and
#     test-acceptance.yml's Test-slot `vercel deploy`) — no: GitHub Actions workflow YAML has no
#     relationship whatsoever to `next build`'s input or output. Skip-eligible here. Confirmed
#     live 2026-09-24: PR #671 (a `.github/workflows/ci-checks.yml`-only change at the time) still
#     triggered a full Vercel Preview build on both projects — pure waste, since nothing about
#     that change could possibly have altered the deployed app.
#   - "Should ci-checks.yml itself re-verify?" (ci-checks.yml's own static `paths-ignore`, which
#     cannot call this script — see above) — yes: a workflow change can be buggy and deserves
#     real verification through the exact infrastructure it configures, the same "the introducing
#     PR is its own first live test" principle ADR-0075's "Rollout safety" section already
#     establishes for this pipeline. ci-checks.yml's own path list is therefore intentionally
#     narrower than this script's `app-deploy` mode and does NOT include `.github/**`.
#
# Pass `app-deploy` as the one positional argument to answer the first question (adds `.github/**`
# to the skip-eligible set); omit it (or pass anything else) to answer the second (the default —
# matches ci-checks.yml's own list exactly, so the two never need to be reasoned about separately
# beyond this one flag).
#
# `scripts/**` also splits by mode, not a blanket "always build" — confirmed by direct inspection
# of package.json + next.config.ts (2026-09-24), not assumed: Vercel's build runs exactly two
# npm lifecycle steps against this repo, `postinstall` (`prisma generate` — reads
# prisma/schema.prisma, nothing under scripts/) and `build` (npm's own `prebuild` hook, `node
# scripts/sync-version-module.mjs`, then `next build`). `next.config.ts` imports `APP_VERSION`
# from `src/lib/version/index.ts` — the file that one script generates — so it is genuinely
# build-critical. No other file under `scripts/` is ever read by that pipeline. Every OTHER
# script (this one included) is CI-only, dev-only, or a one-off maintenance/migration tool —
# `ci-checks.yml`'s own jobs are what actually exercise most of them (e.g. `scripts/
# policy-verify.mjs` via the Policy Verify job, `scripts/check-prisma-query-fields.mjs` via
# Prisma Query Fields), which is exactly why the default (non-`app-deploy`) mode below stays
# conservative for the whole directory — unlike Vercel, ci-checks.yml's jobs collectively DO
# depend on most of `scripts/`, just not through `next build` specifically.
set -euo pipefail

MODE="${1:-strict}"
FILES="$(cat)"

if [ -z "$FILES" ]; then
  echo "build"
  exit 0
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|.matchboard-work/*|*.md|security/*|models/*|extensions/*|.claude/*|.devcontainer/*) ;;
    .github/*)
      if [ "$MODE" != "app-deploy" ]; then
        echo "build"
        exit 0
      fi
      ;;
    scripts/sync-version-module.mjs)
      # The one file under scripts/ that `next build` genuinely depends on (see above) — always
      # build, in both modes, regardless of everything else below.
      echo "build"
      exit 0
      ;;
    scripts/*)
      if [ "$MODE" != "app-deploy" ]; then
        echo "build"
        exit 0
      fi
      ;;
    *)
      echo "build"
      exit 0
      ;;
  esac
done <<< "$FILES"

echo "skip"
