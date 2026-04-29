# Matchboard

Matchboard is a local-first web app for youth football match selection, player rotation, and squad history tracking.

The app helps coaches plan weekly match rounds across multiple teams, manage player movement via configured rotation paths, protect fairness over time, and explain why selections were made.

It is not a multi-user system, not an auth product, and not a general club-management platform.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind CSS
- Prisma
- SQLite

**Note:** This version of Next.js has breaking changes from what you may know. Read the relevant guide in `node_modules/next/dist/docs/` before making framework-level changes.

## Local development setup

### 1. Install prerequisites

- Git
- Node.js 22 LTS recommended (minimum 20.9.0 for Next.js 16)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd matchboard
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Default `.env`:

```dotenv
DATABASE_URL="file:./matchboard.local.db"
```

The app reads `.env` from the repo root. With this default, the SQLite file lives at `prisma/matchboard.local.db`. Do not commit `.env` or any local database file.

### 4. Set up the database

```bash
npm run db:generate    # Generate Prisma client into src/generated/prisma
npm run db:migrate      # Apply schema migrations
```

For active schema development:

```bash
npm run db:migrate:dev  # Create and apply a new migration
```

### 5. Optional: seed fake demo data

```bash
npm run db:seed:demo
```

Demo seed creates fake players, teams, rotation paths, and match rounds. Never replace it with real player data.

### 6. Start the dev server

```bash
npm run dev
```

Runs on `http://localhost:3333`.

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on port 3333 |
| `npm run build` | Production build |
| `npm run lint` | Lint source files |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:migrate:dev` | Create and apply a new migration |
| `npm run db:seed:demo` | Seed fake demo data |

## Source of truth

- **`features/matchboard.feature`** — behavioral source of truth for all selection logic, rules, and domain behavior
- **`AGENTS.md`** — coding agent instructions and style guide

If code and the Gherkin feature file disagree, the feature file wins.

## Architecture

### Selection engine pipeline

The round-level selection engine runs in this order:

1. Per-match core selection (`deferRotation` mode, fills only `minCorePlayers`)
2. Round-level support resolution (`resolveRoundSupport`)
3. Cross-match conflict resolution (`resolveRoundConflicts`)
4. Core-match-drop routing — development and backfill (`routeCoreMatchDrops`)
5. Post-routing backfill (`resolveBackfillAfterSupport`)
6. Self-backfill — re-include excluded own-core players for teams below target

Key rules enforced by the engine:

- Donor teams must not fall below `minCorePlayers` during support resolution
- Rotation paths are directional and configurable — movement cannot happen without an explicit path
- Support priority is resolved ascending (lower number = higher priority)
- Each player can only appear once per match round
- Finalized selections are immutable — manual overrides require an audit reason

### Key source directories

| Path | Purpose |
|------|---------|
| `src/lib/selection/` | Selection engine, round-level orchestrator, support, routing, backfill |
| `src/lib/rules/` | Rule configuration loading and validation |
| `src/lib/` | DB client, shared utilities, player metrics, date helpers |
| `src/app/` | Next.js App Router pages, layouts, server actions, API routes |
| `src/components/` | Shared React components |
| `features/` | Gherkin feature file |

### Data model highlights

- **Team**: configurable squad limits (`targetSquadSize`, `minAcceptedSquadSize`, `maxSquadSize`), support settings, development slots, support priority
- **RotationPath**: directed edges between teams with role (SUPPORT, BACKFILL, DEVELOPMENT), cooldown, and count targets
- **Selection**: per-player per-match record with role (CORE, SUPPORT, BACKFILL, DEVELOPMENT, etc.), status (DRAFT/FINALIZED), and structured explanation JSON
- **MatchRound**: weekly planning unit — selections are generated and validated per round, not per match in isolation

## Sensitive data policy

This repo is intended to stay safe for a public remote:

- Never commit real player names or private roster data
- Never commit local SQLite database files (`.db`, `.sqlite`, journal files)
- Never commit `.env` or machine-specific secrets
- Keep imported or exported real data in ignored local directories only
- Demo and example data committed to the repo must be fake

## Coding style

- Prefer small files and clear names over short names
- Return explanation objects from selection logic — the app must never behave like a black box
- Validate inputs at boundaries (server actions, API routes)
- Keep UI, rules config, and selection engine separate
- Prefer explicit domain code over generic abstractions
- Keep the UI calm and operational — tables are supporting elements, not primary workflows
- No auth, no multi-user features, no batch scheduling

## Branch and PR workflow

Agents should not work directly on `main` unless explicitly instructed.

### Branching

- Start from the latest `main`
- Create one feature branch per task or fix
- Keep branches narrowly scoped
- Prefer names like `feature/player-detail-navigation`, `fix/finalize-selection-history`, `chore/readme-cleanup`

### Commit style

Use Conventional Commits:

```
feat: add next-player navigation on player detail page
fix: preserve finalized selection history on recalculation
docs: rewrite local setup and agent workflow guide
refactor: move selection filtering into domain helpers
test: cover support-team eligibility rules
chore: tighten gitignore for local sqlite and env files
```

Keep each commit focused on one logical change. Do not mix unrelated cleanup with behavior changes.

### Pull requests

Each PR should:

- Stay focused on one change set
- Explain the problem and chosen implementation
- Call out any schema, migration, or rule changes
- Mention any behavior changes against `features/matchboard.feature`
- List verification performed (lint, typecheck, manual checks)
- Note anything not verified