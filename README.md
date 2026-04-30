# Matchboard

Matchboard is a local-first web app for youth football match-round selection, controlled player movement, and squad history tracking.

Selections are generated per match round. Fairness is evaluated across the season/planning period.

The app plans squads for already-created matches. It does not auto-create fixtures, schedule a season, or manage a club.

## Coach workflow

The primary workflow is four steps:

1. **Setup** — Create matches for a round (or use existing rounds). Mark player availability.
2. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round uses round-level orchestration (not match-by-match). No round is finalized.
3. **Review** — Inspect draft selections, warnings, and fairness impact per round. Resolve blockers. Manually adjust if needed.
4. **Finalize** — Lock a round. Finalized rounds become history and cannot be silently mutated.

The Today page always shows the next action based on workflow state.

## Core rules

- **Team support is priority 1.** Required support must be fulfilled before development movement, fairness optimization, cosmetic balancing, or generic rotation. If required support cannot be fulfilled, a warning is generated — the team is never silently weakened.
- **Backfill is a direct consequence of support.** When a player is moved from their core team as support, their team may need backfill. Backfill priority: (1) own core team player moved as support if matches on different dates, (2) development team players, (3) any other non-rotatable-false player from another team. Non-rotatable players are never used as generic backfill.
- **A player can normally only be selected once per match round** unless an explicit rule allows otherwise.
- **The match round is the operational planning unit.** The season/planning period is the fairness and load-balancing context.
- **Warnings are persisted to the database** and read back by the UI and finalization logic. HARD_BLOCK warnings prevent finalization. REQUIRES_OVERRIDE warnings allow finalization with a reason.

It is not a multi-user system, not an auth product, and not a general club-management platform.

## Round status model

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with HARD_BLOCK warnings |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

BLOCKED and READY are derived status values — they are not stored in the database. BLOCKED = draft + HARD_BLOCK warnings. READY = draft + no blockers.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind CSS
- Prisma
- SQLite

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

The app reads `.env` from the repo root. The local-first model means all data stays on the coach's machine. Do not commit `.env` or any local database file.

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
| `npm run test` | Run test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply schema migrations |
| `npm run db:migrate:dev` | Create and apply a new migration |
| `npm run db:seed:demo` | Seed fake demo data |

## Source of truth

- **`features/matchboard.feature`** — behavioral source of truth for all selection logic, rules, and domain behavior
- **`AGENTS.md`** — coding agent instructions, workflow, style guide, and architecture constraints

If code and the Gherkin feature file disagree, the feature file wins.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Teams UX model

### Teams page (`/teams`)

The Teams page is a lightweight directory. It shows each team with core player count, squad limits, support priority, active movement paths, and current planning period burden. Each team links to its detail page.

The all-teams page must not become a catch-all dashboard. It must not show squad rosters inline. Detailed team work happens on the team-specific detail page.

### Team detail (`/teams/[teamId]`)

The team detail page is the primary team workspace. It answers:
- Who belongs to this team
- Who is available
- Who is selected this round
- Who is moving out as support
- Who is moving in as support/backfill/development
- Whether the team is short
- What warnings exist for this team
- What the team's movement and fairness situation looks like

Team detail sections:
- **Team header** — name, squad limits (target, minimum, maximum), minimum core, support priority
- **Team summary strip** — current round status, core count, sent as support count, received support/backfill/development counts, warning count
- **Squad tab** — core roster grouped by planning status (core regulars, support candidates, development candidates, non-rotatable, reduced match load, availability problems)
- **Current Round tab** — who is selected, sent, received, dropped for the active round, with selection reason and movement language
- **Movement tab** — movement history across rounds (sent as support, received support, received backfill, received development)
- **History tab** — finalized rounds for this team with role breakdown
- **Rules/Links tab** — rotation paths involving this team, squad size config, support priority, link to Rules page

### Domain language for movement

Use neutral coaching language. Never use labels that imply permanent negative judgment.

| Concept | Use | Never use |
|---------|-----|-----------|
| Player sent to another team for support | Sent as support | Demoted, benched, punished, failed |
| Player received from another team | Received support, received backfill, received development | Promoted, upgraded, reward |
| Player not selected for a round | Dropped, not selected this round | Benched, failed, weak player |
| Player moved for development | Development movement, development rotation | Promoted, rewarded, upgraded |
| Player filling a gap | Backfill | Replacement, substitute |
| Team with fewer players than target | Short, below target | Weak team, B-team, reserve team |
| Team donating players | Donor team, support source | Stronger team, higher team |
| Team receiving players | Receiving team, support target | Weaker team, lower team |

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

- **Team support is priority 1** — required support must be fulfilled before development, fairness, or cosmetic balancing
- **Backfill follows strict priority order** — (1) own-core player on different date, (2) development source players, (3) other non-rotatable-false players
- **Non-rotatable players are never used as generic backfill**
- Warnings are generated and persisted when support or backfill cannot be fulfilled — the team is never silently weakened
- Donor teams must not fall below `minCorePlayers` during support resolution
- Rotation paths are directional and configurable — movement cannot happen without an explicit path
- Support priority is resolved ascending (lower number = higher priority)
- Each player can only appear once per match round
- Finalized selections are immutable — manual overrides require an audit reason

### Populate all workflow

Populate all generates drafts for all non-finalized rounds in the active planning period:

- Calls `generateMatchRound` for each round in chronological order
- Uses round-level orchestration (not match-by-match)
- Does not finalize any round
- Skips already-finalized rounds
- Persists warnings per round after generation
- Draft selections from earlier rounds may be used as provisional planning context for later rounds
- On partial failure, successful round generations are kept and failures are reported

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
- **Selection**: per-player per-match-round record with role (CORE, SUPPORT, BACKFILL, DEVELOPMENT, etc.), status (DRAFT/FINALIZED), and structured explanation JSON
- **MatchRound**: weekly planning unit — selections are generated and validated per round, not per match in isolation
- **Warning**: per-round warnings with severity (HARD_BLOCK, REQUIRES_OVERRIDE, WARNING, SCORING_PREFERENCE), persisted to database, read by finalization logic

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