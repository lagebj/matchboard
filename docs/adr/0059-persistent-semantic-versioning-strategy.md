# 0059 — Persistent Semantic Versioning Strategy

## Status

Accepted

## Date

2025-08-10

## Context

Matchboard is in active pre-1.0 development. The repository had a conventional-commit-driven versioning system (`scripts/version-sync.mjs`) that automatically calculated version bumps from Git commit history. This approach had several problems:

1. **Rarely exercised**: The auto-bump system was not part of the normal development workflow and the version remained at 0.2.0 indefinitely.
2. **Commit-count inference**: The system derived version bumps from conventional commit types between the merge base and HEAD, which violates the principle that version numbers describe the resulting product change, not the process that produced it.
3. **No persistent policy**: There was no documented versioning policy for coding agents to follow. Future agents could reasonably interpret versioning as optional cleanup.
4. **No CI validation**: Version verification was available locally (`npm run version:verify`) but was not run in CI.
5. **Hard-coded version module**: `src/lib/version/index.ts` contained a hard-coded version string that was not guaranteed to stay in sync with `package.json`.

## Decision

Replace the commit-based auto-bumping system with a persistent manual versioning strategy documented in `docs/VERSIONING.md`.

Key elements:

1. **Canonical source**: `package.json` → `version`. One source of truth. `src/lib/version/index.ts` is derived at build time via `npm run prebuild` (which runs `sync-version-module`).

2. **Manual bump commands**: `npm run version:patch` and `npm run version:minor` update `package.json`, sync the version module, and update `package-lock.json`. They do not create commits, tags, or releases.

3. **Pre-1.0 guard**: While `version.config.json` has `majorLock: 0`, the version must not reach `1.0.0` without explicit product owner authorisation. Breaking pre-1.0 changes increment MINOR.

4. **CI validation**: `npm run version:verify` runs in CI, validating SemVer format, pre-1.0 guard, and `package.json`/module consistency.

5. **Agent-mandatory policy**: `AGENTS.md` requires a version-impact assessment and appropriate version bump for every substantive change.

6. **Coding-agent completion workflow**: Agents must classify changes, apply one version bump, validate, and report previous/new versions.

## Consequences

- Version numbers describe product change, not commit history.
- Every substantive change set includes exactly one deliberate version increment.
- Pre-1.0 breaking changes become `0.(x+1).0`, never `1.0.0` without authorisation.
- The old `scripts/version-sync.mjs` (commit-based auto-bumping) is removed. The new `scripts/version-bump.mjs` (manual bumping) replaces it.
- `npm run version:sync` now only runs `sync-version-module` (build-time sync), not auto-bumping.
- `npm run version:dry-run` (which showed what commit-based bumping would produce) is removed since bumping is now a deliberate agent decision.
- CI catches version format violations and sync drift.