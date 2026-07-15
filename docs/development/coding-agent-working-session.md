# Coding Agent Working Session

## Purpose

This document defines the mandatory workflow for coding-agent work in Matchboard.

## Required skills

Every coding-agent session must use:

- **git-branch-commit-pr** — for branch creation, commits, and PRs

For product, workflow, UX, navigation, selection, fixtures, teams, players, matches, assistant, rules, explainability, and decision-audit changes, the domain rules in AGENTS.md are mandatory.

## Start of session

1. Checkout main.
2. Pull latest main.
3. Create a feature or chore branch.
4. Read AGENTS.md.
5. Read relevant docs.
6. Read active ADRs in `docs/adr/` that may govern the planned change.

## Before implementation

### ADR gate (mandatory)

Before any code change that is design-affecting or architecture-affecting (see AGENTS.md "Architecture-affecting includes" list), the agent must:

1. Classify the work: implementation-only, design-affecting, or architecture-affecting.
2. If design-affecting or architecture-affecting: check `docs/adr/` for existing active ADRs.
3. If no active ADR governs the change: create a new ADR before writing code.
4. If the change conflicts with an active ADR: create a superseding ADR before writing code.
5. Cite the ADR id in commit bodies and PR description.

Do not start implementation of architecture-affecting work without a governing ADR.

### Documentation-first

Update supporting documentation first when changing:

- behavior
- UX
- navigation
- routes
- domain contracts
- database schema
- selection rules
- assistant workflow
- fixtures
- teams
- players
- matches
- persistence
- tests

Do not implement product-shape changes before aligning supporting docs.

## During implementation

Follow these rules:

- Do not duplicate selection-engine logic in UI.
- Keep domain logic in domain/service layers.
- Use player IDs in workflow payloads.
- Persist backend changes for user-visible state changes.
- Record decisions/audit entries when the mechanism exists.
- Remove stale or unused artifacts related to the change.
- Keep mock data behind typed services or fixtures.
- Do not commit scratch notes or private planning files.

## Cleanup requirement

Every session must inspect the touched area for:

- unused components
- unused routes
- unused imports
- stale tests
- obsolete mocks
- dead redirects
- contradictory docs
- broken links
- stale files made irrelevant by the change

Remove or update them in the same branch.

## Validation

Run the project's real commands from package.json.

### Current validation commands

- `npm run lint` — ESLint across src, prisma config, next config, eslint config, seed
- `npm run typecheck` — TypeScript type checking (`tsc --noEmit`)
- `npm test` — Vitest node tests + component tests
- `npm run build` — Next.js production build
- `npx prisma generate` — Generate Prisma client from schema

If schema changed, also run:
- `npx prisma migrate dev` — Create and apply migration (development only)
- `npx prisma migrate deploy` — Apply migrations to production (with DIRECT_URL targeting Neon)

If a command fails, the PR must state:
- exact command
- exact failure
- whether it is caused by this branch or pre-existing

## Commit and PR

Use Conventional Commits.

Push branch.

Open PR.

PR must include:
- summary
- files/workflows changed
- safety constraints
- validation results
- known limitations if any

## Forbidden

Do not commit:
- scratch notes
- work logs
- handover documents
- private planning files
- debug output
- temporary dumps

Do not leave:
- dead navigation entries
- duplicate routes for the same concept
- fake editability
- UI-only persistence
- stale docs contradicting implementation

## Mandatory standing engineering policy

These rules apply to every change, even when not explicitly requested.

1. **Documentation alignment is mandatory.** Every product/code change must update relevant supporting documents when affected. A request does not need to mention documentation.
2. **Quality checks must pass.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must all pass before completion. Pre-existing failures must be fixed even if not introduced by the current change.
3. **Cleanup is mandatory.** Every change must include a small cleanup pass: remove dead code, unused imports, stale docs, obsolete references, unused assets.
4. **Repository hygiene is mandatory.** Before finalizing: check `git status --short`, `git ls-files --others --exclude-standard`, `git ls-files --ignored --exclude-standard`. Ensure no generated junk, stale assets, or untracked meaningful files.
5. **Report what changed and what was cleaned up.**
6. **Documentation validation must be run before PR.** A change is incomplete while any documentation, feature file, example, fixture, generated artifact, migration note, or agent instruction presents superseded behaviour as current. Check that docs in `docs/`, `AGENTS.md`, and `features/matchboard.feature` agree with the implementation. Resolve mismatches before pushing.
7. **A deployable policy change is incomplete until source, tests, Wasm, hashes, and metadata are aligned in one commit.** If Rego source, compiled Wasm, `policy-pack.json` version, or hash metadata are out of sync, the policy change must not be merged until all are aligned.
8. **Version sync must be run before PR.** If a PR touches schema, domain contracts, selection rules, or vocabulary, verify that AGENTS.md, the feature file, domain docs, ADRs, and terminology docs all reflect the current state. Mismatches must be resolved before pushing.
9. **Terminology check must be run before PR.** Verify that user-facing terminology in code, UI text, docs, and feature file agrees with `docs/domain/terminology.md` and the vocabulary tables in AGENTS.md. Prohibited terms must not appear in current code or docs.