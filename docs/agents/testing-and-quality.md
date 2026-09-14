# Testing and quality

This module captures the verification bar before a change is considered complete.

## Required validation

Use the repository's real validation commands before completion. The canonical local quality gate is `npm run validate`; for focused checks, project documentation also names the typical lint, typecheck, test, build, and policy verification commands.

When the change affects behavior, UI, schema, or docs, validate the affected paths and ensure supporting docs are current before the branch is considered ready.

## Documentation synchronization

A change is incomplete while documentation, examples, feature files, or agent instructions still describe superseded behavior. Check the relevant docs together before finalizing:

- `features/matchboard.feature`
- `AGENTS.md`
- `docs/`
- affected README and domain guides

## Cleanup and repository hygiene

Before completion,

- remove stale artifacts touched by the change
- check for dead imports, dead routes, and contradictory docs
- confirm there are no generated junk files or untracked artifacts that should not be kept
- ensure no secrets or sensitive values are committed

## Relevant references

- `docs/development/coding-agent-working-session.md`
- `README.md`
- `features/matchboard.feature`
- `SECURITY.md`
- `scripts/run-validate.mjs` and package scripts in `package.json`
