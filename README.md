# Matchboard

Matchboard is a local-first web app for youth football match selection, player rotation, and finalized squad history.

The app is intentionally narrow:

- maintain a team registry
- maintain a player registry
- create one match at a time
- generate or manually adjust a squad
- finalize the selection so it becomes history for future decisions
- explain why players were selected or excluded

It is not a multi-user system, not an auth product, and not a general club-management platform.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite

## Local development setup

These steps assume you are starting with only an IDE installed.

### 1. Install prerequisites

Install these tools on your machine:

1. Git
2. Node.js 22 LTS recommended

`next@16` requires Node.js `20.9.0` or newer. Installing Node.js also gives you `npm`.

### 2. Clone and open the repo

```bash
git clone <your-repo-url>
cd matchboard
```

Open the folder in your IDE after cloning.

### 3. Install dependencies

```bash
npm install
```

### 4. Create the local environment file

Copy `.env.example` to `.env` in the repo root.

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Default `.env`:

```dotenv
DATABASE_URL="file:./matchboard.local.db"
```

Important detail:

- the app reads `.env` from the repo root
- Prisma also reads the same root `.env`
- with the default `DATABASE_URL`, the actual SQLite file ends up at `prisma/matchboard.local.db`

Do not commit `.env` or any local database file.

### 5. Generate the Prisma client

```bash
npm run db:generate
```

This creates the generated client in `src/generated/prisma`, which is intentionally ignored by git.

### 6. Create or update the local database schema

For a fresh local setup:

```bash
npm run db:migrate
```

If you are actively changing the Prisma schema during development, use:

```bash
npm run db:migrate:dev
```

### 7. Optional: seed fake demo data

```bash
npm run db:seed:demo
```

The demo seed is for fake local testing data only. Do not replace it with real player data.

### 8. Start the app

```bash
npm run dev
```

The dev server runs on `http://localhost:3333`.

## Common commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:migrate:dev
npm run db:seed:demo
```

## Local config files

### `.env`

Used for local environment variables. Right now the only required value is:

```dotenv
DATABASE_URL="file:./matchboard.local.db"
```

### `.env.example`

Safe checked-in template for developers. Copy this to `.env` when setting up the repo.

### SQLite database files

These are local-only and should stay untracked:

- `prisma/matchboard.local.db`
- `*.db`, `*.sqlite`, and related journal files

### Generated Prisma client

`src/generated/prisma` is generated from the Prisma schema and should not be committed.

## Sensitive data policy

This repo is intended to stay safe for a public remote:

- never commit real player names or private roster exports
- never commit local SQLite database files
- never commit `.env` or machine-specific secrets
- keep any imported or exported real data in ignored local directories only

If you need sample data in the repo, use fake data only.

## Behavioral source of truth

When changing app behavior, check these first:

- `features/matchboard.feature`
- `docs/domain.md`
- `AGENTS.md`

If code and the Gherkin feature file disagree, the feature file wins.

## Suggested coding agent configuration

If you use a coding agent on this repo, give it a repo-specific operating contract instead of relying on generic framework assumptions.

### What the agent should read first

Before changing code, the agent should read:

1. `AGENTS.md`
2. `features/matchboard.feature`
3. `docs/domain.md`

The agent should treat `features/matchboard.feature` as the behavioral source of truth.

### Suggested repo instructions for the agent

Use guidance equivalent to this:

- Matchboard is a local-first web app for youth football match selection, player rotation, and squad history tracking.
- Respect product boundaries: local-first only, no auth, no multi-user features, no batch scheduling, one match at a time.
- Follow `features/matchboard.feature` first. Do not invent selection rules that are not expressed there unless explicitly asked.
- Read `docs/domain.md` before changing schema, domain logic, explanations, or naming.
- If `docs/domain.md` and `features/matchboard.feature` conflict, the feature file wins.
- Keep selection logic out of React components.
- Put selection logic in `src/lib/selection/*`.
- Put rule loading and validation in `src/lib/rules/*`.
- Keep UI, rules config, and selection engine separate.
- Prefer explicit domain code over generic abstractions.
- Never commit real player names, private roster data, `.env`, or local SQLite files.
- Example and demo data committed to the repo must be fake.
- Build only what is needed for player registry, match creation, single-match selection generation, finalized selection history, and human-readable explanations.
- Prefer small files and clear names.
- Validate inputs at boundaries.
- Keep the UI calm and operational.

### Next.js-specific instruction

This repo uses Next.js 16. Agents should not assume older Next.js conventions are still valid.

Before making framework-level changes, the agent should read the relevant guide in:

```text
node_modules/next/dist/docs/
```

That matters especially for routing, config, runtime behavior, and deprecations.

## Branch and PR workflow

Agents should not work directly on `main` unless explicitly instructed.

### Branching

- Start from the latest `main`.
- Create one feature branch per task or fix.
- Keep branches narrowly scoped.
- Prefer branch names like:

```text
feature/player-detail-navigation
feature/match-selection-explanations
fix/finalize-selection-history
chore/readme-cleanup
docs/local-setup-and-agent-rules
```

### Commit style

Use Conventional Commits.

Recommended formats:

```text
feat: add next-player navigation on player detail page
fix: preserve finalized selection history on recalculation
docs: rewrite local setup and agent workflow guide
refactor: move selection filtering into domain helpers
test: cover support-team eligibility rules
chore: tighten gitignore for local sqlite and env files
```

Useful commit types for this repo:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`

Additional commit guidance:

- Keep each commit focused on one logical change.
- Do not mix unrelated cleanup with behavior changes.
- If schema or behavior changes, include the related docs or feature updates in the same branch.
- Do not commit generated local data, private imports, or machine-specific config.

### Pull requests

Agents should open a PR from the feature branch into `main`.

Each PR should:

- stay focused on one change set
- explain the problem and the chosen implementation
- call out any schema, migration, or rule changes
- mention any behavior changes against `features/matchboard.feature`
- list verification performed, such as `npm run build` and relevant manual checks
- note anything not verified

Recommended PR title style:

```text
feat: add saved selection explanations to history flow
fix: block team deletion when support relationships exist
docs: add local setup and coding agent workflow
```

Recommended PR body sections:

- Summary
- Source-of-truth impact
- Testing
- Risks or follow-ups

### Agent operating habits

For this repo, agents should also follow these working habits:

- inspect existing code before editing
- avoid broad rewrites when a small targeted change is enough
- preserve user changes already present in the worktree
- update docs when setup, workflow, or developer expectations change
- run relevant validation before finishing
- surface blockers clearly instead of guessing past missing domain rules
