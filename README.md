# Matchboard

Matchboard is a private coach-facing youth football operations cockpit for match-round squad planning, controlled player movement, coaching intent, matchday responsibility, plan integrity signals/explainability, finalized history, and post-match reflection across a planning period.

It is deployed as a hosted web app on Vercel with Neon PostgreSQL backend persistence. It is not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

Selections are generated per match round. Fairness is evaluated across the season/planning period.

The app plans squads for already-created matches. It does not auto-create fixtures, schedule a season, or manage a club.

## Coach workflow

The primary workflow is:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Define intent** — Set match purpose, team risk, desired football behavior, support need, development focus.
3. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round uses round-level orchestration (not match-by-match). No round is finalized.
4. **Review** — Inspect draft selections, plan integrity signals, fairness impact, explanations, and coaching intent alignment. Resolve blockers. Manually adjust draft squads if needed.
5. **Adjust** — Manual changes are allowed. Manual changes must show impact. Manual changes must preserve auditability.
6. **Finalize** — Lock one round at a time, or lock individual matches within a round. Finalized rounds and matches become history and cannot be silently mutated.
7. **Reflect** — Record team-level reflection. Record player-level feedback only where useful. Use observable behavior.
8. **Learn** — Use history, readiness, feedback, and fairness to inform later planning. Do not mutate finalized historical plans.

The central operating flow is: `Assistant → Fixtures → Round Board → Match reporting → Season/History review`.

The canonical primary navigation is: Assistant, Fixtures, Teams, Players.

- Assistant (`/assistant`) shows the next action based on workflow state. Derives work items from live database state, not from persisted issue rows.
- Fixtures (`/fixtures`) provides the planning-period and round hierarchy.
- Round Board is the primary squad decision surface.
- Teams provides team registry and team detail workspaces.
- Players (`/players`) provides three modes: Season overview, Current round attention, and Manage base groups.
- Season, History and Rules are secondary analysis/configuration destinations.

## Players area

The Players page is the coach-facing overview for participation statistics, current planning attention, and base-group administration.

### Three modes

- **Season overview** (default): actual participation and recorded match statistics for a selected planning period. Source of truth is reported or locked post-match data. Draft selections and finalised unreported assignments do not count as played.
- **Current round attention**: canonical live plan-integrity state for a selected round. Uses `computeRoundPlanIntegrity` only. Does not derive attention from goals, assists, or historical movement.
- **Manage base groups**: stable core-team assignment and player registry administration. Separate from weekly match selection and seasonal review.

### Season overview metrics

Played, Goals, Assists, Core, Support, Development, Matchday additions, Planned absent. All scoped to the selected planning period. Goals and assists are factual statistics only — they do not affect selection generation or fairness.

### Current round attention states

Covered, Decision required (available eligible without planned match opportunity), Blocked (selected unavailable, invalid plan), Not available, Unconfirmed. Derived from canonical live plan integrity only.

### Product boundaries

- No overall fairness score, player ranking, or hidden automatic player judgement.
- No stat-driven squad selection.
- Matchday additions are factual context, not warnings.
- Actual additional appearances are factual load context, not current attention states.
- Base-group management is separate from match planning and seasonal review.
- Coach-facing only. Not included in parent-facing exports.

The interface prioritises actionable football decisions over configuration exposure.

## Core rules

- **RotationPath is the single source of truth for non-core player movement.** A player may only be selected outside their core team when an active directed RotationPath exists from core team to target team for the exact role being assigned, unless manually overridden with a reason. Each path authorizes exactly one role: SUPPORT, DEVELOPMENT, or BACKFILL. A SUPPORT path does not permit DEVELOPMENT or BACKFILL movement. Paths are directional. No path means no automatic non-core selection. Fairness scoring cannot make an invalid path valid. The legacy `TeamSupportSource` and `TeamDevelopmentSource` tables must not drive selection eligibility — they are scheduled for removal.
- **Team support is priority 1.** Required support must be fulfilled before development movement, fairness optimization, cosmetic balancing, or generic rotation. If required support cannot be fulfilled, a Blocked or Decision required condition is generated — the team is never silently weakened. Support priority uses ascending sort order: lower number = higher priority (priority 1 is resolved before priority 2).
 - **Squad repair follows support movement.** When a player fills a squad gap caused by support/development movement, the generation engine assigns `role = SUPPORT` with a squad repair explanation code. `BACKFILL` remains in the Prisma enum for backward compatibility of historical data and manual overrides. The user-facing term is "squad repair", not "backfill". Squad repair priority: (1) own core team player moved as support if matches are on different dates, (2) players from teams connected by an active DEVELOPMENT or SUPPORT rotation path to the receiving team where `nonRotatable = false`, (3) any other player from another team with an active SUPPORT or BACKFILL rotation path where `nonRotatable = false`. Non-rotatable players are never used as generic squad repair.
  - **Movement ledger is mandatory.** Every non-core player movement must create a MovementLedger entry. Support, development, and squad repair from another team all create ledger entries. The movement ledger is the authoritative record of player movement. The export must never show empty movements when non-core selections exist.
- **Same-round player uniqueness is the default.** A player must not be planned for two matches in the same round/week. The generation engine does NOT produce controlled double-load. Existing historical data with `controlledDoubleLoad = true` must still be readable. Actual double-load from post-match reports is tracked through effective participation/history and must not mutate finalized planned selections. Additional actual appearances from post-match reports are recorded separately as unplanned participation and do not mutate finalized planned selections.
- **Target squad size is a planning target, not a hard cap.** A team may be selected above target up to `maxSquadSize`. Below `targetSquadSize` but above `minAcceptedSquadSize` generates a Planning note. Below `minAcceptedSquadSize` is a hard floor requiring manual override.
- **The match round is the operational planning unit.** The season/planning period is the fairness and load-balancing context.
- **Plan integrity signals are persisted to the database** and read back by the UI and finalization logic. Current active integrity is computed from the current editable draft — signals belonging to earlier drafts no longer appear after their cause is resolved. Resolving a condition removes it from current work. Blocked conditions prevent normal finalization (require conscious override with reason). Decision required conditions allow finalization with a recorded reason. Planning notes are informational only and do not block finalization or create active work items. Fixtures displays structured Blocked and Decision required summaries only — never generic issue totals. Round Board shows Plan integrity, Planning notes and Why this selection — never actionable warnings or generic warning counts. Selection rationale is explanation only and is never counted as unresolved work. Planned selections and actual participation remain separate.
- **Draft selections are editable and not final history.** The coach can manually add, remove, change role, or replace players in draft match squads. Manual edits use the same domain validation as automatic generation. UI-only validation is not enough.
- **Finalized rounds become hard history.** Finalized selections cannot be edited without an audit trail.
- **Manual override requires reason.** When a manual edit bypasses a hard rule, the reason must include a structured category (squad_too_small, support_missing, development_opportunity, no_planned_match_opportunity, double_load_needed [legacy only], availability_changed, coach_judgement, match_already_played, data_correction, other) and free-text detail. Generic "Manual override" alone is not sufficient. The reason must be persisted with the selection and appear in the finalization summary.

It is not a generic club-management platform, not a parent communication platform, and not a public player evaluation system.

## Coaching intent

Matchboard supports a coaching loop: intent → selection → responsibility → execution → reflection → learning.

Coaching intent can be attached to planning periods, match rounds, matches, teams, and selections. Intent categories include team_first, reset_after_error, support_teammates, positional_discipline, play_through_team, defensive_recovery, confidence_rebuild, challenge_exposure, stabilize_weaker_team, and protect_match_function.

Intent informs explanations and plan integrity signals but does not silently override hard eligibility rules. Intent can be edited by the coach before finalization. Intent remains coach-facing unless explicitly exported through neutral parent-safe language. Finalized history preserves intent snapshots from finalization time.

## Matchday responsibilities

A selected player may receive a matchday responsibility, separate from the selection role. Responsibilities are coach-facing execution concepts: stabilizer, connector, recovery_leader, width_holder, challenge_player, confidence_rebuild_player.

Responsibilities must be coach-facing by default, preserved in finalized history, never change player eligibility, explained using observable football language, separate from player identity or permanent labels, and may change from match to match.

## Player readiness signals

Readiness is soft coaching context, not a hard ranking system. Initial readiness signals: effort trend, attendance reliability, learning behavior, team-first behavior, reset-after-error reliability, coach trust.

Low readiness cannot automatically exclude an eligible player. Strong readiness cannot automatically override hard eligibility rules. Readiness must be coach-editable, time-bound, based on observable behavior, and excluded from parent-facing exports. Readiness must not create automatic punishment, permanent labels, or parent-visible judgement.

## Post-match reflection

Matchboard supports lightweight post-match feedback based on observable behavior. Feedback categories: effort, team help, reset after mistake, positional discipline, teammate involvement.

Feedback is coach-facing by default, describes behavior not character, is optional and lightweight, and must not shame players or become automatic punishment. Disallowed feedback language includes: lazy, selfish, bad attitude, weak player, not good enough, useless, problem player. Allowed language uses observable behavior: helped teammate after ball loss, recovered position quickly, stayed available for pass.

Feedback can inform future plan integrity signals, readiness signals, and planning suggestions. Feedback must not mutate finalized planned selections. Actual participation belongs to post-match reality/history and must stay separate from planned selection.

## Opponent encounter history

Matchboard supports reusable opponent-team registration and match-linked encounter history. After a match, coaches can record private observations about the match environment (opponent players, coaching staff, spectator/sideline context) and sporting fit through existing match-fit feedback.

The feature is coach-facing. It records encounters rather than rating opponents. It does not store opponent individual identities. It does not automatically alter squad selection. It is not a public rating, blacklist, or formal incident-reporting system.

Opponent observations are separate from sporting-match-fit feedback. The existing `Match.matchFit` field is reused as the sporting-fit context for encounters. No duplicate sporting-fit model exists.

Post-match observations use neutral, observable language: "Fair Play concern", "Observed concern", "Serious concern observed". They never use labeling language like "Bad team", "Unsafe team", or "Risk team".

Match-environment observations, concern categories, factual summaries, and follow-up status are excluded from parent-facing exports and external AI payloads. Opponent-team display names may appear as normal fixture information in parent-facing contexts.

The selection engine is unchanged: opponent identity, match-fit history, and environment observations do not alter eligibility, support priority, development movement, squad repair, fairness, readiness, plan integrity signals, blockers, or finalisation.

## Coach-facing vs parent-facing exports

Internal planning reasons, readiness notes, support burden, confidence rebuild, effort concerns, and execution feedback must not leak into parent-facing exports.

Coach export includes: roles, movement direction, explanations, override reasons, readiness notes, and feedback. Parent export uses neutral language: rotation, suitable challenge, team balance, availability, match experience, development opportunity, squad adjustment. Parent export must never include: low readiness, weak player, support burden, confidence rebuild, effort concern, coach trust, needs_attention, internal ranking, punishment, selection debt, culture debt, or hidden judgement.

Player names and personal data must not be sent to external AI services. Use stable player IDs and sanitize payloads. Hosted architecture does not make coach-facing data public.

## Explanation model

Every non-obvious selection should be explainable through: selection role, movement path or manual override, coaching intent, matchday responsibility, relevant plan integrity signals (blocked conditions, decisions required, planning notes), fairness impact, load impact, support impact, risk created or mitigated, distinction between hard rule and scoring preference, and distinction between planned selection and actual participation.

## Manual draft change impact analysis

Manual changes are allowed, but the app must explain impact. Manual changes should support real matchday reality: late absence, emergency support, sickness, injury, availability change, coach judgement, squad size repair, real-world backfill, and actual participation differing from planned selection.

Adding a player manually recalculates plan integrity signals, round status, match status, explanations, fairness impact, and movement ledger. Emergency backfill close to matchday is recorded as actual participation, not retroactively pretending the generation engine planned it. Actual double-load caused by real-world backfill is tracked through effective participation/history and must not mutate finalized planned selections. Manual removal preserves audit history. Manual changes require coach-facing explanation if they violate normal rules or create notable fairness/load/support impact.

## Privacy and external AI handling

Matchboard is a private coaching app. Coach-facing data — readiness signals, execution feedback, internal explanations, coaching intent, matchday responsibilities, support burden — must remain coach-facing by default.

Player names and personal data must not be sent to external AI services. External payloads must use stable player IDs and sanitize personally identifiable information. Hosted deployment on Vercel with Neon PostgreSQL does not weaken privacy boundaries. Coach-facing data remains private by default.

## Guardrails against misuse

Matchboard must not become: a punishment engine, a hidden player ranking ladder, a moral scoring system, a parent-visible judgement tool, a tool for hard early sorting, a fake equality generator, a generic scheduling system, a generic club-management system, or a public player evaluation system.

Low readiness cannot automatically exclude a player. Feedback cannot be shown in parent export. Movement remains temporary and explainable. Stable belonging remains protected. Coach judgement remains explicit when overriding rules. Hosted deployment does not weaken privacy boundaries. Player development context does not become public labels. Stronger players can be used for support without permanently redefining their identity. Weaker but hungry players can receive challenge where behavior and context support it. Social participation is respected, but it must not silently define the football ceiling for the whole group.

## Round status model

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with Blocked conditions |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

BLOCKED and READY are derived status values — they are not stored in the database. BLOCKED = draft + Blocked condition. READY = draft + no Blocked or Decision required conditions.

## How populate all works

Populate all generates draft selections for all non-finalized rounds in the active planning period in one action. It groups matches by round and generates per round using round-level orchestration. It processes rounds in chronological order. Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same run. Populate all does not finalize any round. On partial failure, successful round generations are kept and failures are reported.

## How round review works

After populate all, each round has draft selections, plan integrity signals, and explanations. The coach reviews plan integrity signals by round, fixes issues per match, and may manually adjust draft squads before finalization. Rounds with Blocked conditions require conscious override to finalize. Rounds with Decision required conditions can be finalized with a recorded reason.

## How manual draft editing works

Draft match squads can be manually edited before finalization. The coach can add players, remove players, change player roles, or replace players. Manual edits use the same domain validation as automatic generation — UI-only validation is not enough. Every non-core movement must have a valid RotationPath or an explicit manual override reason. Same-round conflicts, availability, squad size, and non-rotatable rules are all validated. Manual edits recalculate match status, round status, plan integrity signals, explanations, and fairness impact. Finalized selections cannot be edited by normal draft actions.

## How clear draft actions work

Draft selections can be cleared at three levels:
- **Clear all** — removes all non-finalized draft data (selections, plan integrity signals, explanations, movement ledger, provisional context) across all rounds in the planning period
- **Clear round** — removes draft data for one selected round only
- **Clear match** — removes draft data for one selected match only

Clear actions preserve finalized selections, finalized history, teams, players, matches, rounds, rules, and availability. After clearing, affected rounds return to not-populated state and round status is recalculated. Clear all requires explicit confirmation before executing.

## How finalization works

Finalizing a round locks all selections as immutable history. The app checks for Blocked conditions before allowing finalization. Finalized selections cannot be edited without an explicit reopen or audit entry. Finalized rounds contribute to season/planning-period fairness calculations.

## How un-finalization works

Finalized matches and rounds can be un-finalized to revert selections back to DRAFT for recalculation. Un-finalization reverts Selection.status from FINALIZED to DRAFT, clears ruleConfigVersion and overrideReason, reverts MovementLedger.isDraft from false to true, and re-derives round status from plan integrity signals. Per-match un-finalization keeps the round as FINALIZED if other matches are still finalized. When all matches in a round are un-finalized, the round status reverts based on its plan integrity signals. Un-finalization requires confirmation and is not silent.

## How season overview works

The season overview (`/season`) is the fairness control surface for the planning period. It helps the coach understand whether player load, support burden, development exposure, drops, and movement are fair across the season.

**Primary view: Player × round matrix.** Each row is a player, each column is a round. Cells show the role (Core, Support, Development, Squad repair) and team for that round. Summary columns show rounds played, core matches, support count, development count, additional actual appearances, drops, and plan integrity signal count.

**Finalized only vs. Include drafts.** The coach can toggle between finalized-only history and finalized-plus-draft planning. Draft selections are always visually distinct from finalized history — they are never mixed without clear labeling. Unavailable rounds do not count as fairness debt. Additional actual appearances from post-match reports are tracked separately from planned selections.

**Movement path summary.** A secondary view shows team-to-team movement totals: source team, target team, role, count, unique players, last used, and plan integrity signals. Each path row is drillable.

**Player drill-down.** Clicking a player shows their movement timeline across rounds: round, date, team, role, draft/finalized state, and explanation. The timeline is scoped to the selected planning period.

**Plan integrity signals.** The overview generates signals such as high support burden, low development exposure, repeated additional actual appearances, consecutive movement, and disproportionate team support. Each signal includes category (Blocked/Decision required/Planning note), affected player/team/path, reason, drill-down link, and whether it is based on finalized-only or draft-included data.

**Season export.** The coach can export finalized match data and season statistics from the season overview page. Available formats: CSV, JSON, TXT, Markdown. Available visibility modes: coach (includes roles, plan integrity signals, movement paths, explanations, override reasons) and parent (hides internal planning tags and judgement, uses neutral language such as rotation, suitable challenge, team balance, availability, or development opportunity). Coach export includes selection details per match, movement rows with from/to team and role, and per-player statistics (rounds played, core matches, support matches, development matches, squad repair, additional actual appearances). Parent export includes per-selection rows with round, date, team, home/away, opponent, and player position, movement direction without team names or role labels, and per-player statistics with rounds played.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL (local via Docker Compose or Neon)
- Auth.js (Google OAuth, email allowlist)

## Access model

Matchboard is a **private coaching app**. Access is restricted to authenticated coaches on an email allowlist. Internal planning notes, readiness signals, feedback, and selection reasoning remain private coach-facing data by default.

- Users must authenticate (Google OAuth) before accessing any app data
- Access is controlled by `ALLOWED_COACH_EMAILS` — a comma-separated list of coach email addresses
- No public signup exists or should be added unless explicitly requested
- Authenticated users not on the allowlist see an access-denied page
- All server actions and API routes enforce authorization server-side
- UI-only protection is insufficient — every mutation and data read requires a verified coach session
- Database access is server-side only — no direct client database access
- Readiness signals, coaching intent, matchday responsibilities, execution feedback, and internal explanations must not appear in parent-facing exports
- Player names and personal data must not be sent to external AI services

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

### 3. Start local Postgres

```bash
npm run docker:up
```

This starts a local Postgres container via Docker Compose on `localhost:5432`.

### 4. Configure environment

```bash
cp .env.example .env
```

Default `.env` points at local Docker Compose Postgres:

```dotenv
DATABASE_URL="postgresql://matchboard:matchboard@localhost:5432/matchboard?schema=public"
DIRECT_URL="postgresql://matchboard:matchboard@localhost:5432/matchboard?schema=public"
TEST_DATABASE_URL="postgresql://matchboard:matchboard@localhost:5432/matchboard_test?schema=public"
```

For production, switch to Neon Postgres pooled/direct URLs (see `.env.example`).

Do not commit `.env` or any database credentials.

### 5. Set up authentication

1. Generate an auth secret:
   ```bash
   npx auth secret
   ```
   Copy the output to `AUTH_SECRET` in your `.env`.

2. Create Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a new project (or use an existing one)
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3333`
   - Authorized redirect URIs: `http://localhost:3333/api/auth/callback/google`
   - Copy the **Client ID** to `AUTH_GOOGLE_ID` and **Client Secret** to `AUTH_GOOGLE_SECRET` in `.env`

3. Add your email to the allowlist:
   ```dotenv
   ALLOWED_COACH_EMAILS="you@example.com"
   ```

4. Set the auth base URL:
   ```dotenv
   AUTH_URL="http://localhost:3333"
   ```

### 6. Set up the database

```bash
npm run db:generate    # Generate Prisma client into src/generated/prisma
npm run db:migrate      # Apply schema migrations
```

For active schema development:

```bash
npm run db:migrate:dev  # Create and apply a new migration
```

### 7. Optional: seed fake demo data

```bash
npm run db:seed:demo
```

Demo seed creates fake players, teams, rotation paths, and match rounds. Never replace it with real player data.

### 8. Start the dev server

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
| `npm run db:export` | Export all app state to JSON |
| `npm run db:import` | Import app state from JSON export |
| `npm run docker:up` | Start local Postgres via Docker Compose |
| `npm run docker:down` | Stop local Postgres |
| `npm run docker:reset` | Reset local Postgres (destroys data) |

## Source of truth

- **`features/matchboard.feature`** — behavioral source of truth for all selection logic, rules, and domain behavior
- **`AGENTS.md`** — coding agent instructions, workflow, style guide, and architecture constraints

If code and the Gherkin feature file disagree, the feature file wins.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Setup registries

Teams, Players, and Matches are setup registries — dense, table-first data views for efficient entry. Each registry has a dedicated create route, prominent Create actions, and actionable empty states. Create buttons must never be dead links.

- **Teams** (`/teams`): dense table with core player count, squad limits, support priority. Create at `/teams/new`.
- **Players** (`/players`): dense table with name, core team, position, availability. Create at `/players/new`. Requires at least one team.
- **Fixtures** (`/fixtures`): match registry with round hierarchy, status, and actions. Match creation at `/matches/new`. Requires at least one team.

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
- What plan integrity signals exist for this team
- What the team's movement and fairness situation looks like

Team detail sections:
- **Team header** — name, squad limits (target, minimum, maximum), minimum core, support priority
- **Team summary strip** — current round status, core count, sent as support count, received support/squad repair/development counts, plan integrity signal count
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
6. Post-pipeline validation and plan integrity signal persistence

Key rules enforced by the engine:

- **RotationPath is the single source of truth** — non-core movement requires a valid directed path for the exact role; legacy relationship tables must not drive eligibility
- **Paths are role-specific** — a SUPPORT path only authorizes SUPPORT movement, not DEVELOPMENT or BACKFILL (and likewise for each role)
- **Team support is priority 1** — required support must be fulfilled before development, fairness, or cosmetic balancing
- **Support priority is ascending** — lower number = higher priority (1 resolved before 2)
- **Squad repair follows strict priority order** — (1) own-core player on different date, (2) players from teams with active DEVELOPMENT or SUPPORT rotation path to receiving team where nonRotatable=false, (3) players with active SUPPORT or BACKFILL rotation path where nonRotatable=false
- **Non-rotatable players are never used as generic squad repair**
- **Invalid path eligibility is a hard eligibility problem** — not a ranking problem. Fairness scoring cannot make an invalid path valid.
- **Same-round player uniqueness is the default** — a player must not be planned for two matches in the same round. Controlled double-load has been removed from generation. Actual double-load from post-match reports is tracked through effective participation.
- **Target squad size is a planning target, not a hard cap** — teams may exceed target up to maxSquadSize. Below target but above minAcceptedSquadSize generates a Planning note only.
- Plan integrity signals are generated and persisted when support or squad repair cannot be fulfilled — the team is never silently weakened
- Donor teams must not fall below `minCorePlayers` during support resolution
- Rotation paths are directional — movement cannot happen without an explicit path in the correct direction
- Each player can only appear once per match round unless actual participation differs from planned selection
- Draft selections are editable — manual edits use same domain validation as automatic generation
- Finalized selections are immutable — manual overrides require an audit reason
- Manual override requires reason and must appear in finalization summary
- Below target but above minimum generates a Planning note, not a Blocked condition
- Plan integrity signals are generated and persisted — the team is never silently weakened

### Populate all workflow

Populate all generates drafts for all non-finalized rounds in the active planning period:

- Calls `generateMatchRound` for each round in chronological order
- Uses round-level orchestration (not match-by-match)
- Does not finalize any round
- Skips already-finalized rounds
- Persists plan integrity signals per round after generation
- Draft selections from earlier rounds may be used as provisional planning context for later rounds
- On partial failure, successful round generations are kept and failures are reported

### Key source directories

| Path | Purpose |
|------|---------|
| `src/lib/selection/` | Selection engine, round-level orchestrator, support, routing, squad repair |
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

- **Team**: configurable squad limits (`targetSquadSize`, `minAcceptedSquadSize`, `maxSquadSize`), support settings, development slots, support priority rank (1 is highest)
- **RotationPath**: directed edges between teams with role (SUPPORT, BACKFILL, DEVELOPMENT), cooldown, and count targets
- **Selection**: per-player per-match record with role (CORE, SUPPORT, DEVELOPMENT, SQUAD_REPAIR), status (DRAFT/FINALIZED), overrideReasonCategory (enum), overrideReasonDetail (free text), and structured explanation JSON. BACKFILL remains in the Prisma enum for backward compatibility of historical data and manual overrides. New generation produces SUPPORT with squad repair explanation codes for squad repair, not BACKFILL. DOUBLE_LOAD is not a valid role value for new generation. The `controlledDoubleLoad` field is legacy — no new `true` values are written by the generation engine. Actual double-load from post-match reports is tracked through effective participation, not via `controlledDoubleLoad`. Additional actual appearances from post-match reports are recorded separately as unplanned participation and do not mutate finalized planned selections.
- **MovementLedger**: mandatory record for every non-core player movement. Created during draft generation, flipped from isDraft=true to isDraft=false during finalization. Support, development, and squad repair from another team all create ledger entries. The movement ledger is the authoritative record of player movement — the export must never show empty movements when non-core selections exist.
- **MatchRound**: weekly planning unit — selections are generated and validated per round, not per match in isolation
- **Warning**: per-round signals with severity (HARD_BLOCK, REQUIRES_OVERRIDE, WARNING, SCORING_PREFERENCE), persisted to database. Current active integrity is derived from the current editable draft — recalculation yielding zero signals clears stale rows. The UI displays these as Blocked, Decision required, or Planning note based on the visible signal model. SCORING_PREFERENCE is explanation only and is never persisted as an active issue. Planning notes never create active work items or finalisation requirements.

## Sensitive data policy

This repo is intended to stay safe for a public remote:

- Never commit real player names or private roster data
- Never commit database credentials or Neon connection strings
- Never commit AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, or any auth credentials
- Never prefix secrets with NEXT_PUBLIC_ (they would be exposed to the browser)
- Never commit `.env` or machine-specific secrets
- Keep imported or exported real data in ignored local directories only
- Demo and example data committed to the repo must be fake
- Seed data uses fictional player names (P1, P2, etc.) and team names (Team A, Team B, Team C)

## Vercel deployment

Matchboard is deployed to **Vercel** with **Neon PostgreSQL** as the production database. It is a hosted private web app with PostgreSQL backend persistence. SQLite is not used for production persistence — only PostgreSQL is supported.

Do not deploy without auth enabled. All server actions and API routes must enforce `requireCoachAccess()`.

### 1. Prerequisites

- A [Neon](https://neon.tech) Postgres database (created and migrated)
- A [Vercel](https://vercel.com) account
- A Google Cloud project with OAuth credentials
- Node.js 22 LTS recommended

### 2. Required environment variables

Set these in the Vercel project dashboard under Settings → Environment Variables. **Do not commit these values to the repository.**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon **pooled** connection string (hostname includes `-pooler`). Used by the runtime app for queries. |
| `DIRECT_URL` | Neon **direct** connection string (no `-pooler`). Used by Prisma CLI for migrations. |
| `AUTH_SECRET` | Generated with `npx auth secret`. Server-side only. |
| `AUTH_GOOGLE_ID` | Google OAuth client ID from Google Cloud Console. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret from Google Cloud Console. |
| `AUTH_URL` | Your deployed URL (e.g. `https://matchboard.vercel.app`). Auth.js uses this for callbacks. |
| `ALLOWED_COACH_EMAILS` | Comma-separated list of coach email addresses. Only these users can access the app. |

**Never prefix secrets with `NEXT_PUBLIC_`** — they would be exposed to the browser.

### 3. Neon database notes

- The runtime app uses `DATABASE_URL` (pooled connection) for queries via `@prisma/adapter-neon` or `@prisma/adapter-pg`.
- Prisma CLI (migrations, generate) uses `DIRECT_URL` (direct connection) configured in `prisma.config.ts`.
- The Prisma schema (`prisma/schema.prisma`) declares `provider = "postgresql"` with no inline `url` — the URL is provided via `prisma.config.ts` and environment variables.
- `src/lib/db.ts` auto-detects Neon vs. local Postgres from the connection string and uses the appropriate adapter.

### 4. Prisma migration notes

- **Production migrations must be run deliberately from a local machine** targeting the Neon database using `DIRECT_URL`. Do not run migrations as part of the Vercel build process.
- Before first deployment, run: `npx prisma migrate deploy` with `DIRECT_URL` pointing to your Neon database.
- The `postinstall` script runs `prisma generate` (not migrations).
- Never use `prisma migrate dev` against production.
- If production schema already matches the latest migration, no action is needed.

### 5. Google OAuth redirect URL

In Google Cloud Console → APIs & Services → Credentials, configure:

**Authorized JavaScript origins:**
- `http://localhost:3333` (local development)
- `https://your-domain.vercel.app` (production)

**Authorized redirect URIs:**
- `http://localhost:3333/api/auth/callback/google` (local development)
- `https://your-domain.vercel.app/api/auth/callback/google` (production)

If using Vercel preview deployments, add the preview URL as well.

After changing the production URL, update `AUTH_URL` in Vercel environment variables and redeploy.

### 6. Vercel project setup

1. Push the repository to GitHub.
2. In Vercel dashboard: **New Project** → import the GitHub repository.
3. Framework preset: **Next.js** (should be auto-detected).
4. Build command: `next build` (Vercel default).
5. Install command: `npm install` (Vercel default).
6. Output directory: default (`.next`).
7. Node.js version: 22.x (set in Project Settings → Node.js Version).
8. Add all seven environment variables from section 2.
9. Deploy.

**Do not commit `.vercel/`** — it is in `.gitignore`.

### 7. Post-deploy verification checklist

After deployment, verify:

- [ ] Production URL loads and shows the sign-in page
- [ ] Sign-in page is themed (dark background) and does not show sidebar/topbar
- [ ] Unauthorized users (not on allowlist) are denied access
- [ ] An allowlisted coach can sign in via Google
- [ ] Protected pages render after authentication
- [ ] Neon database connection works (create a team to test)
- [ ] `/api/health` returns `{ ok: true }` with no business data
- [ ] No secrets visible in browser source or Vercel logs
- [ ] No protected data accessible without authentication

### 8. Rollback and disable access

If a deployment has issues:

- **Rollback:** In Vercel dashboard → Deployments → find the last known-good deployment → **Promote to Production**.
- **Disable access:** Set `ALLOWED_COACH_EMAILS` to an empty string or remove it — all app access will be denied.

### Security notes

- Rate limiting is in-memory only. It resets on server restart and does not work across multiple Vercel instances. For production, consider a Redis-backed rate limiter.
- The `/api/health` endpoint is public and returns `{ ok: true }` only — no business data is exposed.
- All other API routes and server actions enforce `requireCoachAccess()`.
- Never expose `DATABASE_URL`, `AUTH_SECRET`, or other secrets as `NEXT_PUBLIC_*` variables.
- `.env` is for local development only and must never be committed.
- `.vercel/` is local build metadata and must never be committed.

## Coding style

- Prefer small files and clear names over short names
- Return explanation objects from selection logic — the app must never behave like a black box
- Validate inputs at boundaries (server actions, API routes)
- Keep UI, rules config, and selection engine separate
- Prefer explicit domain code over generic abstractions
- Keep the UI calm and operational — tables are supporting elements, not primary workflows
- Auth is required: every server action and route must enforce `requireCoachAccess()`

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
chore: update deployment config
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