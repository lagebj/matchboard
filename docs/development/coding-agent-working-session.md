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

## Before implementation

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