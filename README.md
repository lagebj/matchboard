# Matchboard

Matchboard is a local-first web app for youth football match-round selection, controlled player movement, and squad history tracking.

Selections are generated per match round. Fairness is evaluated across the season/planning period.

The app plans squads for already-created matches. It does not auto-create fixtures, schedule a season, or manage a club.

Matchboard is set up by adding teams, players, and matches. The coach can then populate all draft squads. Populate all groups matches by round and generates draft selections per round. The coach reviews warnings by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time. Season/planning-period history is used to keep load, support, drops, development exposure, and fairness balanced over time.

## Coach workflow

The primary workflow is:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round uses round-level orchestration (not match-by-match). No round is finalized.
3. **Review** — Inspect draft selections, warnings, and fairness impact per round. Resolve blockers. Manually adjust draft squads if needed.
4. **Finalize** — Lock one round at a time. Finalized rounds become history and cannot be silently mutated.

The Today page always shows the next action based on workflow state.

## Core rules

- **RotationPath is the single source of truth for non-core player movement.** A player may only be selected outside their core team when an active directed RotationPath exists from core team to target team for the exact role being assigned, unless manually overridden with a reason. Each path authorizes exactly one role: SUPPORT, DEVELOPMENT, or BACKFILL. A SUPPORT path does not permit DEVELOPMENT or BACKFILL movement. Paths are directional. No path means no automatic non-core selection. Fairness scoring cannot make an invalid path valid. The legacy `TeamSupportSource` and `TeamDevelopmentSource` tables must not drive selection eligibility — they are scheduled for removal.
- **Team support is priority 1.** Required support must be fulfilled before development movement, fairness optimization, cosmetic balancing, or generic rotation. If required support cannot be fulfilled, a warning is generated — the team is never silently weakened. Support priority uses ascending sort order: lower number = higher priority (priority 1 is resolved before priority 2).
- **Squad repair follows support movement.** When a player is moved from their core team as support, their team may need squad repair. Squad repair priority: (1) own core team player moved as support if matches on different dates, (2) players from teams connected by an active DEVELOPMENT rotation path to the receiving team where `nonRotatable = false` — the DEVELOPMENT path gates the team-to-team direction and the assigned role is BACKFILL, (3) any other player from another team with an active BACKFILL rotation path where `nonRotatable = false`. Non-rotatable players are never used as generic squad repair.
- **Same-round player uniqueness is the default.** A player can only be selected once per match round unless controlled double-load explicitly allows it. Controlled double-load requires: different match dates, minimum rest spacing, explicit permission, fairness debt tracking, and rotation across eligible players over time. Controlled double-load is evaluated after all other movement phases complete.
- **Target squad size is a planning target, not a hard cap.** A team may be selected above target up to `maxSquadSize`. Below `targetSquadSize` but above `minAcceptedSquadSize` generates a WARNING. Below `minAcceptedSquadSize` is a hard floor requiring manual override.
- **The match round is the operational planning unit.** The season/planning period is the fairness and load-balancing context.
- **Warnings are persisted to the database** and read back by the UI and finalization logic. HARD_BLOCK warnings prevent finalization. REQUIRES_OVERRIDE warnings allow finalization with a reason.
- **Draft selections are editable and not final history.** The coach can manually add, remove, change role, or replace players in draft match squads. Manual edits use the same domain validation as automatic generation. UI-only validation is not enough.
- **Finalized rounds become hard history.** Finalized selections cannot be edited without an audit trail.
- **Manual override requires reason.** When a manual edit bypasses a hard rule, the reason must be persisted with the selection and appear in the finalization summary.

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

## How populate all works

Populate all generates draft selections for all non-finalized rounds in the active planning period in one action. It groups matches by round and generates per round using round-level orchestration. It processes rounds in chronological order. Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same run. Populate all does not finalize any round. On partial failure, successful round generations are kept and failures are reported.

## How round review works

After populate all, each round has draft selections, warnings, and explanations. The coach reviews warnings by round, fixes issues per match, and may manually adjust draft squads before finalization. Rounds with HARD_BLOCK warnings cannot be finalized until the blocker is resolved. Rounds with REQUIRES_OVERRIDE warnings can be finalized with a manual override reason.

## How manual draft editing works

Draft match squads can be manually edited before finalization. The coach can add players, remove players, change player roles, or replace players. Manual edits use the same domain validation as automatic generation — UI-only validation is not enough. Every non-core movement must have a valid RotationPath or an explicit manual override reason. Same-round conflicts, availability, squad size, and non-rotatable rules are all validated. Manual edits recalculate match status, round status, warnings, explanations, and fairness impact. Finalized selections cannot be edited by normal draft actions.

## How clear draft actions work

Draft selections can be cleared at three levels:
- **Clear all** — removes all non-finalized draft data (selections, warnings, explanations, movement ledger, provisional context) across all rounds in the planning period
- **Clear round** — removes draft data for one selected round only
- **Clear match** — removes draft data for one selected match only

Clear actions preserve finalized selections, finalized history, teams, players, matches, rounds, rules, and availability. After clearing, affected rounds return to not-populated state and round status is recalculated. Clear all requires explicit confirmation before executing.

## How finalization works

Finalizing a round locks all selections as immutable history. The app checks for HARD_BLOCK warnings before allowing finalization. Finalized selections cannot be edited without an explicit reopen or audit entry. Finalized rounds contribute to season/planning-period fairness calculations.

## How un-finalization works

Finalized matches and rounds can be un-finalized to revert selections back to DRAFT for recalculation. Un-finalization reverts Selection.status from FINALIZED to DRAFT, clears ruleConfigVersion and overrideReason, reverts MovementLedger.isDraft from false to true, and re-derives round status from warnings. Per-match un-finalization keeps the round as FINALIZED if other matches are still finalized. When all matches in a round are un-finalized, the round status reverts based on its warnings. Un-finalization requires confirmation and is not silent.

## How season overview works

The season overview (`/season`) is the fairness control surface for the planning period. It helps the coach understand whether player load, support burden, development exposure, drops, and movement are fair across the season.

**Primary view: Player × round matrix.** Each row is a player, each column is a round. Cells show the role (Core, Support, Development, Squad repair, Double-load) and team for that round. Summary columns show rounds played, core matches, support count, development count, double-load rounds, drops, and fairness warnings.

**Finalized only vs. Include drafts.** The coach can toggle between finalized-only history and finalized-plus-draft planning. Draft selections are always visually distinct from finalized history — they are never mixed without clear labeling. Unavailable rounds do not count as fairness debt. Double-load players see multiple role badges stacked per round (e.g., Core + 2x), but "rounds played" counts unique rounds, not total selection records.

**Movement path summary.** A secondary view shows team-to-team movement totals: source team, target team, role, count, unique players, last used, and warnings. Each path row is drillable.

**Player drill-down.** Clicking a player shows their movement timeline across rounds: round, date, team, role, draft/finalized state, and explanation. The timeline is scoped to the selected planning period.

**Fairness warnings.** The overview generates warnings such as high support burden, low development exposure, repeated double-load, consecutive movement, and disproportionate team support. Each warning includes severity, affected player/team/path, reason, drill-down link, and whether it is based on finalized-only or draft-included data.

**Season export.** The coach can export finalized match data and season statistics from the season overview page. Available formats: CSV, JSON, TXT, Markdown. Available visibility modes: coach (includes roles, movement direction, explanations, override reasons) and parent (hides internal planning tags). The export includes selection details per match, movement rows with from/to team and role, and per-player statistics (rounds played, core matches, support matches, development matches, squad repair, double-load rounds).

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

### Setup registries are table-first

Teams, Players, and Matches are setup registries — dense, table-first data views for efficient entry. Each registry has a dedicated create route, prominent Create actions, and actionable empty states. Create buttons must never be dead links.

- **Teams** (`/teams`): dense table with core player count, squad limits, support priority. Create at `/teams/new`.
- **Players** (`/players`): dense table with name, core team, position, availability. Create at `/players/new`. Requires at least one team.
- **Matches** (`/matches`): dense table with date, team, opponent, home/away, type, format. Create at `/matches/new`. Requires at least one team.

Round selection (`/rounds`) remains workflow-first and uses cards, boards, and panels — not tables.

Empty states must be actionable:
- "No teams yet. Create a team." → direct link to `/teams/new`
- "Create a team first." (on Players when no teams) → direct link to `/teams/new`
- "No players yet. Create a player." → direct link to `/players/new`
- "No matches yet. Create a match." → direct link to `/matches/new`

### Teams page (`/teams`)

The Teams page is a lightweight directory. It shows each team with core player count, squad limits, support priority, active movement paths, and current planning period burden. Each team links to its detail page.

The all-teams page must not become a catch-all dashboard. It must not show squad rosters inline. Detailed team work happens on the team-specific detail page.

### Team detail (`/teams/[teamId]`)

The team detail page is the primary team workspace. It answers:
- Who belongs to this team
- Who is available
- Who is selected this round
- Who is moving out as support
- Who is moving in as support/squad repair/development
- Whether the team is short
- What warnings exist for this team
- What the team's movement and fairness situation looks like

Team detail sections:
- **Team header** — name, squad limits (target, minimum, maximum), minimum core, support priority
- **Team summary strip** — current round status, core count, sent as support count, received support/squad repair/development counts, warning count
- **Squad tab** — core roster grouped by planning status (core regulars, support candidates, development candidates, non-rotatable, reduced match load, availability problems)
- **Current Round tab** — who is selected, sent, received, dropped for the active round, with selection reason and movement language
- **Movement tab** — movement history across rounds (sent as support, received support, received squad repair, received development)
- **History tab** — finalized rounds for this team with role breakdown
- **Rules/Links tab** — rotation paths involving this team, squad size config, support priority, link to Rules page

### Domain language for movement

Use neutral coaching language. Never use labels that imply permanent negative judgment.

| Concept | Use | Never use |
|---------|-----|-----------|
| Player sent to another team for support | Sent as support | Demoted, benched, punished, failed |
| Player received from another team | Received support, received squad repair, received development | Promoted, upgraded, reward |
| Player not selected for a round | Dropped, not selected this round | Benched, failed, weak player |
| Player moved for development | Development movement, development rotation | Promoted, rewarded, upgraded |
| Player filling a gap | Squad repair, cover, repair after support | Replacement, substitute |
| Team with fewer players than target | Short, below target | Weak team, B-team, reserve team |
| Team donating players | Donor team, support source | Stronger team, higher team |
| Team receiving players | Receiving team, support target | Weaker team, lower team |

Note: BACKFILL remains the internal code role and rotation path role. Use "squad repair" in all user-facing UI and documentation.

## Architecture

### Selection engine pipeline

The round-level selection engine runs in this order:

1. Per-match core selection (`deferRotation` mode, fills only `minCorePlayers`)
2. Round-level required support resolution (`resolveRoundSupport`)
3. Cross-match conflict resolution (`resolveRoundConflicts`)
4. Development routing (`routeCoreMatchDrops`)
5. Squad repair — repairing teams weakened by support movement
6. Controlled double-load evaluation — explicit exception to same-round uniqueness
7. Post-pipeline validation and warning persistence

Key rules enforced by the engine:

- **RotationPath is the single source of truth** — non-core movement requires a valid directed path for the exact role; legacy relationship tables must not drive eligibility
- **Paths are role-specific** — a SUPPORT path only authorizes SUPPORT movement, not DEVELOPMENT or BACKFILL (and likewise for each role)
- **Team support is priority 1** — required support must be fulfilled before development, fairness, or cosmetic balancing
- **Support priority is ascending** — lower number = higher priority (1 resolved before 2)
- **Squad repair follows strict priority order** — (1) own-core player on different date, (2) players from teams with active DEVELOPMENT rotation path to receiving team where nonRotatable=false (DEVELOPMENT path gates direction, assigned role is BACKFILL), (3) players with active BACKFILL rotation path where nonRotatable=false
- **Non-rotatable players are never used as generic squad repair**
- **Invalid path eligibility is a hard eligibility problem** — not a ranking problem. Fairness scoring cannot make an invalid path valid.
- **Controlled double-load is an explicit exception** — not default behavior. Requires different dates, rest spacing, explicit permission, fairness debt tracking, and rotation across eligible players.
- **Target squad size is a planning target, not a hard cap** — teams may exceed target up to maxSquadSize. Below target but above minAcceptedSquadSize generates WARNING only.
- Warnings are generated and persisted when support or squad repair cannot be fulfilled — the team is never silently weakened
- Donor teams must not fall below `minCorePlayers` during support resolution
- Rotation paths are directional — movement cannot happen without an explicit path in the correct direction
- Each player can only appear once per match round unless controlled double-load applies
- Draft selections are editable — manual edits use same domain validation as automatic generation
- Finalized selections are immutable — manual overrides require an audit reason
- Manual override requires reason and must appear in finalization summary

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
| `src/lib/selection/` | Selection engine, round-level orchestrator, support, routing, squad repair, double-load |
| `src/lib/rules/` | Rule configuration loading and validation |
| `src/lib/` | DB client, shared utilities, player metrics, date helpers |
| `src/app/` | Next.js App Router pages, layouts, server actions, API routes |
| `src/components/` | Shared React components |
| `features/` | Gherkin feature file |

### RotationPath movement rules

RotationPath is the single source of truth for automatic non-core player movement. Movement rules:

- A player may only be selected outside their core team when an active directed RotationPath exists from core team to target team for the exact role being assigned, unless a manual override with reason is used
- Each RotationPath authorizes exactly one role: SUPPORT, DEVELOPMENT, or BACKFILL
- A SUPPORT path permits only SUPPORT movement — not DEVELOPMENT or BACKFILL
- A DEVELOPMENT path permits only DEVELOPMENT movement — not SUPPORT or BACKFILL
- A BACKFILL path permits only BACKFILL movement — not SUPPORT or DEVELOPMENT
- Paths are directional: from_team → to_team only. The reverse direction requires a separate path
- No configured path means no automatic non-core selection
- Fairness scoring cannot make an invalid path valid
- Non-rotatable players cannot be automatically selected for any non-core role
- Manual override may bypass path checks but must record reason
- The legacy TeamSupportSource and TeamDevelopmentSource relationship tables must not drive selection eligibility — they are scheduled for removal

### Data model highlights

- **Team**: configurable squad limits (`targetSquadSize`, `minAcceptedSquadSize`, `maxSquadSize`), support settings, development slots, support priority
- **RotationPath**: directed edges between teams with role (SUPPORT, BACKFILL, DEVELOPMENT), cooldown, and count targets
- **Selection**: per-player per-match-round record with role (CORE, SUPPORT, BACKFILL, DEVELOPMENT, DOUBLE_LOAD, etc.), status (DRAFT/FINALIZED), and structured explanation JSON
- **MatchRound**: weekly planning unit — selections are generated and validated per round, not per match in isolation
- **Warning**: per-round warnings with severity (HARD_BLOCK, REQUIRES_OVERRIDE, WARNING, SCORING_PREFERENCE), persisted to database, read by finalization logic

## Sensitive data policy

This repo is intended to stay safe for a public remote:

- Never commit real player names or private roster data
- Never commit local SQLite database files (`.db`, `.sqlite`, journal files)
- Never commit `.env` or machine-specific secrets
- Keep imported or exported real data in ignored local directories only
- Demo and example data committed to the repo must be fake
- Seed data uses fictional player names (P1, P2, etc.) and team names (Team A, Team B, Team C)

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