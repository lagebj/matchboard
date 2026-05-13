# Matchboard Agent Instructions

Matchboard is a local-first web app for youth football match-round selection, controlled player movement, and squad history tracking.

`features/matchboard.feature` is the single behavioral source of truth for domain behavior, selection rules, and expected outcomes.

If code, UI, schema, tests, README, and `features/matchboard.feature` disagree, fix the mismatch.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Required skills

When working on Matchboard, always apply these skills in order:

1. **`git-branch-commit-pr`** — for all coding-agent work: branch creation, commits, and PRs
2. **`app-product-engineering`** (global) — for any user-facing app work: UX, interaction, accessibility, workflow, forms, dashboards, navigation, responsive behavior, design systems
3. **`matchboard-product-engineering`** (local, `.agent-skills/matchboard-product-engineering/SKILL.md`) — for Matchboard-specific domain rules: selection engine boundaries, explainability, decision audit, player ID privacy, child-safety language, readiness states, workflow stages

The global `app-product-engineering` skill contains generic UX and app engineering rules. The local `matchboard-product-engineering` skill contains only Matchboard domain rules. Do not duplicate the global skill inside this repo.

## Workflow

Matchboard is set up by adding teams, players, and matches. The coach can then populate all draft squads. Populate all groups matches by round and generates draft selections per round. The coach reviews warnings by round, fixes issues per match, may manually adjust draft squads, and finalizes one round at a time. Season/planning-period history is used to keep load, support, drops, development exposure, and fairness balanced over time.

The primary coach workflow is:

1. **Setup** — Add teams, add players, add matches. Mark player availability.
2. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round is generated via round-level orchestration (not match-by-match). No round is finalized by populate all.
3. **Review** — Inspect draft selections, warnings, and fairness impact per round. Resolve blockers. Manually adjust draft squads if needed.
4. **Finalize** — Lock one round at a time, or lock individual matches within a round. Finalized rounds and matches become history and cannot be silently mutated.

The Today page must always show the next action based on this workflow state.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind
- Prisma
- PostgreSQL (local Docker Compose or Neon)
- Auth.js (Google OAuth, email allowlist)

## Product boundary

Matchboard plans squads for already-created matches.

It does not:
- create fixtures
- schedule a season
- manage a club
- support public signup or multi-tenant auth
- store real player data in the repo

Note: Matchboard does have a match creation form for recording match details (opponent, date, home/away, type, format). This is match data entry, not fixture creation or season scheduling.

## Core operating model

Selections are generated per match round.

A match round is the operational planning unit.

The season or planning period is the fairness and load-balancing context.

A round may contain one or more matches.

Same-round player uniqueness is the default rule. A player can only be selected once per round unless controlled double-load explicitly allows it.

The round-level pipeline runs in strict phase order:
1. Per-match core selection
2. Round-level required support resolution
3. Cross-match conflict resolution
4. Development routing
5. Squad repair (repairing teams weakened by support movement)
6. Controlled double-load evaluation
7. Post-pipeline validation and warning persistence

No phase may be skipped. Each phase must complete before the next begins.

Populate all generates drafts for all rounds in a planning period in one action. It does not finalize. Each round is generated via round-level orchestration to preserve cross-match conflict resolution.

Populate all must not generate each match independently. Populate all must group matches by round and run round generation per round.

## Coaching/domain model

Stable base groups protect belonging.

Movement between groups is normal, controlled, and temporary.

Movement is based on:
- team need
- effort
- attendance
- learning behavior
- game impact
- appropriate challenge
- fairness across the season/planning period

Movement is not a punishment or permanent label.

Do not design artificial equal-strength balancing. The app should create useful squad selections, not flatten all groups into generic equality.

### Consecutive support rotation

The selection engine penalizes players who have been sent as support for consecutive rounds. This is a scoring preference, not a hard rule.

- Players with consecutive finalized SUPPORT rounds receive a priority score penalty of -6 per consecutive round beyond the first (e.g., 2 consecutive = -6, 3 consecutive = -12)
- The penalty only applies to SUPPORT candidates, not DEVELOPMENT or other categories
- Players with 1 or 0 consecutive support rounds receive no penalty
- The penalty does not prevent selection when no better candidate exists — it is a ranking preference, not a hard block
- Both the per-match generation engine and the round-level support resolver use this penalty to rotate support assignments across available players from the source team

## Rule precedence

Team support is priority 1.

If a team needs required support, that support must be attempted before:
- optional development movement
- fairness optimization
- cosmetic balancing
- generic rotation

If required support cannot be fulfilled, generate a warning. Do not silently weaken the team.

Fairness must not override required support. Fairness is a scoring preference, not a hard rule.

## RotationPath authority

RotationPath is the single source of truth for automatic non-core player movement. A player may only be selected outside their core team when an active directed RotationPath exists from the player's core team to the target team for the exact role being assigned, unless a manual override with reason is used.

Rules:
- Each RotationPath authorizes exactly one role: SUPPORT, DEVELOPMENT, or BACKFILL
- A SUPPORT path permits only SUPPORT movement — not DEVELOPMENT or BACKFILL
- A DEVELOPMENT path permits only DEVELOPMENT movement — not SUPPORT or BACKFILL
- A BACKFILL path permits only BACKFILL movement — not SUPPORT or DEVELOPMENT
- Paths are directional: from_team → to_team. The reverse direction requires a separate path
- No configured path means no non-core automatic selection
- Fairness scoring cannot make an invalid path valid
- nonRotatable blocks all automatic non-core movement regardless of path existence
- Manual override may bypass path checks but must record reason
- No fallback can bypass path validation
- Invalid path eligibility is a hard eligibility problem, not a ranking problem

### Legacy relationship tables

The `TeamSupportSource` and `TeamDevelopmentSource` tables must not drive selection eligibility or movement decisions. They exist for backward-compatible UI configuration display only and are scheduled for removal. The selection engine must use RotationPath exclusively.

### Support priority convention

Support priority is a **rank**, not a weight. Lower number = higher priority. Priority 1 is resolved before priority 2. The `supportPriority` field on the Team model uses ascending sort order (`ORDER BY supportPriority ASC`). The UI label must say "support priority rank: 1 is highest". Do not use ambiguous labels like "support priority" without the rank clarification.

## Backfill rules

"Squad repair" is the user-facing term. BACKFILL is the internal code role and rotation path role.

When a player fills a gap in a squad weakened by support/development movement, that selection must use `role = BACKFILL`, not `role = CORE` with a prose explanation. The explanation field supplements the role; it does not replace it.

If a player is re-included in their own team after being temporarily dropped, that is also BACKFILL (not CORE), because the player is filling a squad gap created by outbound movement.

Existing data where squad repair is stored as `role = CORE` with explanation containing "squad repair" must be migrated to `role = BACKFILL`.

When a player is moved from their core team as support, their own team may need squad repair.

Squad repair priority order:

1. Own core team player moved as support, if matches are on different dates and the player can play both
2. Players from teams connected by an active DEVELOPMENT rotation path to the receiving team, where `nonRotatable = false`. The DEVELOPMENT path gates the team-to-team direction. The assigned role is BACKFILL.
3. Any player from another team with an active BACKFILL rotation path to the receiving team, where `nonRotatable = false`

Rules:
- Non-rotatable players must never be used as generic squad repair
- Squad repair must respect same-round conflict rules unless controlled double-load explicitly allows
- If no valid squad repair exists, generate a warning instead of silently weakening the team

## Controlled double-load rules

Same-round player uniqueness is the default. A player appears once per match. Controlled double-load is an explicit exception where a player appears in a second match in the same round.

### Controlled double-load is a modifier, not a standalone role

A double-loaded player has **one Selection row per match** with the base role they serve in that match. The `controlledDoubleLoad` boolean flag marks that this is a second same-round assignment.

Correct model:
- `role = SUPPORT`, `controlledDoubleLoad = true` — player supports team Rød as their second match this round
- `role = DEVELOPMENT`, `controlledDoubleLoad = true` — player does development in team Blå as their second match this round
- `role = CORE`, `controlledDoubleLoad = true` — player plays for their own team again in a second match this round (same team, different date)

Incorrect model (deprecated, must be migrated):
- `role = CONTROLLED_DOUBLE_LOAD` as a standalone role (old data)
- Two rows for the same player in the same match (one as DOUBLE_LOAD, one as SUPPORT/DEVELOPMENT/CORE)

A player must never have two Selection rows in the same match. If a player double-loads across two matches in a round, they have two rows total (one per match), each with their base role, and the second row has `controlledDoubleLoad = true`.

### Controlled double-load requirements

A controlled double-load requires all of the following:
- Matches on different dates
- Minimum rest spacing between matches (configurable per rotation path)
- Controlled double-load explicitly enabled for the rotation path or team configuration
- Player has not exceeded the maximum double-load count in the planning period
- Fairness debt is tracked for the double-loaded player
- Players are rotated across eligible double-load candidates over time

Controlled double-load cannot bypass rotation path validation.
Controlled double-load cannot move non-rotatable players outside their core team.
Controlled double-load is evaluated after all other movement phases complete.

### Migration for existing data

Existing Selection rows with `role = DOUBLE_LOAD` must be migrated:
1. For each DOUBLE_LOAD row, find the player's other Selection in the same round (same matchRoundId, different matchId)
2. Set `controlledDoubleLoad = true` on the other Selection row
3. Determine the base role from the rotation path context (SUPPORT, DEVELOPMENT, CORE, or BACKFILL)
4. Update `role` to the base role value
5. Delete the standalone DOUBLE_LOAD row after merging data

## Target / min / max squad size

- Target squad size is a planning target, not a hard cap. A team may be selected above target up to maximum squad size.
- Minimum accepted squad size is a hard floor. Below minimum requires manual override.
- Maximum squad size is a hard ceiling. Above maximum requires manual override.
- Below target but above minimum generates a WARNING, not a HARD_BLOCK.

## Warnings

Warnings are generated during round generation and must be persisted to the database.

Each warning has a severity level:
- **HARD_BLOCK** — requires override reason to finalize (the coach decides, not the system)
- **REQUIRES_OVERRIDE** — requires override reason to finalize
- **WARNING** — informational, does not block finalization
- **SCORING_PREFERENCE** — explains a ranking decision

The UI reads warnings from the database, not from in-memory generation results. If warnings are not persisted, the UI cannot show blockers and finalization cannot check for hard blocks.

The coach can always finalize by providing an override reason. No warning severity can absolutely prevent finalization. HARD_BLOCK and REQUIRES_OVERRIDE both require an override reason; they differ in presentation severity, not in whether they can be overridden.

## Draft clearing

Generated draft selections can be cleared at three levels:
- **Clear all** — remove all non-finalized draft selections, draft warnings, draft explanations, provisional planning context, and draft generation metadata across all rounds
- **Clear round** — remove all non-finalized draft data for one selected round
- **Clear match** — remove all non-finalized draft data for one selected match

Hard rules:
- Never delete finalized selections
- Never delete finalized history
- Never delete teams, players, matches, rounds, rules, or availability
- Clearing draft data must be explicit and require confirmation
- After clearing, affected rounds/matches must return to not-populated state
- After clearing, affected round status and warnings must be recalculated
- After clearing all, no stale draft context may affect later generation

## Manual draft squad editing

Draft match squads can be manually edited before finalization.

**Manual override principle: selection rules are for the automatic engine only.** A coach can manually override any domain rule (same-round conflict, rotation path, availability, non-rotatable, squad size) by providing an override reason. The only absolute hard blocks for manual edits are data integrity: finalized round/match, non-existent player/match/selection.

Manual editing applies to draft/non-finalized selections only. Finalized selections cannot be edited by normal draft actions.

Manual editing must:
- validate that the match exists and the round is not finalized
- validate that the player exists and is active in the registry
- check domain rules and require an override reason when bypassing any of them
- recalculate match status, round status, warnings, explanations, and fairness impact
- store the override reason with the selection
- show the override badge on the player selection

Domain rules that require override reason for manual edits (not hard blocks):
- rotation path eligibility for non-core movement
- same-round conflict (player selected for another match)
- duplicate selection in the same match
- player availability
- squad size limits
- non-rotatable player movement outside core team

The only hard blocks for manual edits:
- round is FINALIZED
- match/selection/player does not exist
- player has been removed from the active registry

Manual override requires reason. Manual override must be persisted with the selection. Manual override must appear in finalization summary.

### Manual override reason categories

Override reasons must use structured categories, not generic free text. "Manual override" alone is not sufficient for analysis.

Structured categories:
- squad_too_small
- support_missing
- development_opportunity
- double_load_needed
- availability_changed
- coach_judgement
- match_already_played
- data_correction
- other

Override reasons are stored as two fields:
- `overrideReasonCategory` — the structured category (enum)
- `overrideReasonDetail` — free-text detail explaining the specific context

Free-text detail is required for:
- override of a hard rule (same-round conflict, rotation path, non-rotatable)
- unavailable player selection
- invalid path usage
- double-load exception
- finalized history edit

## Movement ledger

Every non-core movement must create a MovementLedger entry. The movement ledger is the authoritative record of player movement, not the Selection table alone.

Movement ledger entries are created during:
- round draft generation (each non-core selection where `player.coreTeamId !== match.teamId`)
- controlled double-load assignments (even when `sourceTeam == targetTeam`, to track fairness debt)

Movement ledger entries are NOT created for:
- CORE selections where `player.coreTeamId === match.teamId` and no movement occurred

Rules:
- `movements: []` in export is invalid when non-core selections exist
- Support always creates a movement ledger entry
- Development always creates a movement ledger entry
- Squad repair /_BACKFILL from another team creates a movement ledger entry
- Controlled double-load creates a movement ledger entry even if `sourceTeam == targetTeam`
- Manual override does not remove the need for movement ledger entries
- Finalization flips `isDraft` from `true` to `false`; it does not create new entries
- Un-finalization flips `isDraft` back from `false` to `true`

Existing data that has non-core selections but empty MovementLedger must be backfilled via a normalization/migration function.

## Draft regeneration

Generated draft selections can be regenerated at three levels:
- **Regenerate match** — rerun automatic selection for one match, preserving any manual edits
- **Regenerate round** — rerun round-level orchestration for one round, preserving any manual edits
- **Regenerate all drafts** — regenerate all DRAFT rounds in the planning period, preserving manual edits in each

Regeneration rules:
- Regeneration preserves manual edits: selections marked as manually added or manually removed are kept, and only automatic selections are recalculated
- If a match/round has only manual edits, regeneration is effectively a no-op (the manual selections are preserved as-is)
- To fully regenerate a match/round that has manual edits, clear the draft first, then regenerate
- Regeneration never touches FINALIZED selections
- Regeneration rebuilds warnings after recalculation
- Regeneration buttons must be clearly visible: on match columns in the round board (RefreshCw icon), via the round board action bar ("Regenerate"), and on rounds list and today page ("Regenerate all drafts")

## Per-match and round finalization

Finalization can happen at two levels:

1. **Per-match**: The coach can finalize individual matches within a round. This locks only the selections for that specific match. Other matches in the round remain in DRAFT state.

2. **Round-level**: The coach can finalize an entire round at once. This locks all selections in all matches in the round.

Per-match finalization rules:
- Per-match finalization locks all DRAFT selections for the target match as FINALIZED
- Per-match finalization checks HARD_BLOCK and REQUIRES_OVERRIDE warnings scoped to the target match only (not the entire round); both require override reason, neither absolutely prevents finalization
- When all matches in a round have been finalized (no remaining DRAFT selections), the round's status must automatically transition to FINALIZED
- A match in a FINALIZED round cannot be finalized again
- Per-match finalization uses the same rule config version stamping as round-level finalization

Round-level finalization finalizes all remaining DRAFT selections in the round atomically.

### Un-finalization

Finalized matches and rounds can be un-finalized to revert selections back to DRAFT for recalculation.

Un-finalization can happen at two levels:

1. **Per-match**: The coach can un-finalize individual matches. Selections revert from FINALIZED to DRAFT, movement ledger entries revert to draft, and ruleConfigVersion/overrideReason are cleared.

2. **Round-level**: The coach can un-finalize an entire round. All selections in the round revert to DRAFT.

Un-finalization rules:
- Reverts Selection.status from FINALIZED back to DRAFT
- Clears ruleConfigVersion and overrideReason on affected selections
- Reverts MovementLedger.isDraft from false back to true
- Re-derives round status from warnings (DRAFT/BLOCKED/READY)
- When un-finalizing a single match in a FINALIZED round, if other finalized selections remain, the round stays FINALIZED; only when all selections are back to DRAFT does the round status revert
- Only FINALIZED rounds/matches can be un-finalized
- Un-finalize requires confirmation (not silent)
- Finalized data used for fairness calculations is affected: un-finalized selections no longer count as history

The match detail page shows per-match finalization controls and also provides a link to finalizing the entire round from the round workbench.

The round board uses a column-based layout: one "Available players" column on the left showing all unassigned players, and one column per match showing assigned players grouped by role. Players are moved between columns via drag-and-drop (desktop and touch).

When a player is dropped onto a match column, the role is determined automatically:
- If the player's core team matches the match team → CORE
- If a rotation path exists from the player's core team to the match team → SUPPORT (preferred) or DEVELOPMENT based on the path role
- If no rotation path exists → CORE (requires override reason)

BACKFILL is not a user-facing role choice. It is used internally by the selection engine for squad repair. Existing BACKFILL selections are displayed under "Squad repair" in the round board, but coaches cannot select BACKFILL as a role — the system assigns it automatically.

Warnings are shown with reduced verbosity: actionable warnings (HARD_BLOCK, REQUIRES_OVERRIDE) appear as a count summary at the top of the round board and as per-player warning icons on player chips. Informational warnings (WARNING, SCORING_PREFERENCE) are hidden behind a toggle. The main goal is to surface actionable issues, not to list every observation.

## Selection architecture

Keep selection logic out of React components.

Selection logic belongs in `src/lib/selection/*`.

Rule loading and validation belong in `src/lib/rules/*`.

Keep these concerns separate:
- round orchestration (`generate-round.ts`)
- per-match generation (`generate-selection.ts`)
- rotation path policy (`rotation-path-policy.ts`)
- invariant validation (`validate-generated-round-invariants.ts`)
- round eligibility
- support selection
- squad repair selection
- development selection
- controlled double-load evaluation
- core selection
- season fairness
- conflict validation
- warning generation and persistence
- explanation generation
- manual edit validation
- draft clearing
- draft regeneration
- finalization/snapshotting

Do not grow a monolithic `generate-selection.ts`.

The orchestrator should be thin.

Rules must be testable without React.

## Populate all

Populate all is a convenience workflow that generates drafts for all non-finalized rounds in the active planning period.

- It calls `generateMatchRound` for each round in chronological order
- It groups matches by round and generates per round (not match-by-match)
- It uses round-level orchestration (not match-by-match)
- It does not finalize any round
- It skips already-finalized rounds
- It persists warnings per round after generation
- Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same run
- On partial failure, successful round generations are kept and failures are reported

## UI architecture

### Canonical routes

Primary navigation (4 items):
- `/assistant` — assistant manager, next action, setup progress, blockers
- `/fixtures` — period → round → match hierarchy with actions
- `/teams` — team registry linking to team detail pages
- `/players` — player assignment board and registry

Other canonical routes:
| Route | Purpose |
|-------|---------|
| `/rounds` | Rounds — generate, review, finalize per match round |
| `/season` | Season — player-by-round matrix, movement paths, fairness overview |
| `/history` | Historical audit of finalized selections and movement |

Setup registry create routes (no top-level nav):
- `/teams/new` — create team form
- `/players/new` — create player form
- `/matches/new` — create match form

Detail routes (no top-level nav):
- `/rounds/[matchRoundId]` — round board
- `/players/[playerId]` — player profile
- `/teams/[teamId]` — team detail workspace
- `/teams/[teamId]/configuration` — team configuration and rules
- `/matches/[matchId]` — match detail

Secondary routes (no top-level nav):
- `/rules` — selection rules, support priority, rotation paths

Redirects:
- `/` → `/assistant`
- `/today` → `/assistant`
- `/matches` → `/fixtures`

### Setup registries are table-first

Teams, Players, and Matches are setup registries. They serve data-entry efficiency, not football operations workflow. Each registry page is a dense table with prominent Create actions and actionable empty states. Create buttons must never be dead links. Empty states must link directly to creation.

- Teams (`/teams`): dense table of teams with core player count, squad limits, support priority. Links to `/teams/new` for creation. Links to `/teams/[teamId]` for detail. Empty state: "No teams yet. Create a team." with direct link to `/teams/new`.
- Players (`/players`): dense table of players with name, core team, position, availability. Links to `/players/new` for creation. Links to `/players/[playerId]` for detail. When no teams exist: "Create a team first." with direct link to `/teams/new`. When teams exist but no players: "No players yet. Create a player." with direct link to `/players/new`.
- Matches (`/matches`): dense table of matches with date, team, opponent, home-or-away, type, format. Links to `/matches/new` for creation. Empty state: "No matches yet. Create a match." with direct link to `/matches/new`.

Create routes must work reliably. `/teams/new` must save all team fields (not just name and a few fields). `/players/new` must not silently disappear when teams exist. `/matches/new` must assign matches to match rounds based on date.

Round selection (`/rounds`) remains workflow-first. It uses cards, boards, panels, and role buckets — not tables as the primary interaction model.

### Teams page and team detail

The `/teams` page is a table-first registry. It links each team to its detail page.
It must not become a catch-all dashboard or show squad rosters inline.

`/teams/[teamId]` is the primary team workspace. It answers:
- Who belongs to this team
- Who is available
- Who is selected this round
- Who is moving out as support
- Who is moving in as support/backfill/development
- Whether the team is short
- What warnings exist for this team
- What the team's movement and fairness situation looks like

Team detail has these sections:
- Team header (name, squad limits, support priority)
- Team summary strip (current round status, core count, sent/received counts, warning count)
- Squad tab (core roster, planning status groups)
- Current Round tab (who is selected, sent, received, dropped — with selection reason)
- Movement tab (movement history across rounds)
- History tab (finalized rounds for this team)
- Rules/Links tab (rotation paths, config, link to Rules page)

### Navigation model

- **Sidebar**: 4 items (Assistant, Fixtures, Teams, Players)
- **Top context bar**: season, planning period, active round status, primary action
- **Mobile nav**: adapted from sidebar items

### Auth layout rules

- Auth routes (`/auth/signin`, `/auth/error`) must use a public auth layout, never the protected app layout
- Sign-in and access-denied pages must not show sidebar, top bar, coach data, team data, player data, match data, or round data
- Protected app shell (sidebar, top bar, user nav) only renders after authenticated allowlisted coach access
- Auth pages must use the Matchboard dark theme but without protected navigation
- Root layout must contain only HTML/body/font wrappers — no protected shell components
- Protected shell (sidebar, top bar, user nav) lives in `(app)/layout.tsx`, not in root layout

### Season overview

The `/season` route is the fairness control surface. It is not a decorative analytics page. It exists to help the coach trust or challenge the season pattern.

The season overview must provide:

1. **Player × round matrix** (primary view): rows = players, columns = rounds, cells = role + team for that round
2. **Movement path summary** (secondary view): team-to-team movement totals table
3. **Player drill-down**: movement timeline per player
4. **Path drill-down**: players moved, rounds, dates per team-to-team path
5. **Season fairness warnings**: generated from the overview data

Season overview rules:

- The matrix is primary. Graphs are secondary and must be backed by drill-down data.
- Draft and finalized data must never be mixed without visible labeling.
- Draft selections must never look like finalized history.
- Unavailable rounds must not count as fairness debt.
- Double-load must count as extra load.
- Support and development must be counted separately.
- Squad repair/backfill must be counted separately or clearly explained.
- Every metric must be drillable (clickable to see detail).

Toggle:

- **Finalized only**: excludes all draft selections. Only shows finalized history.
- **Include drafts**: includes draft selections visibly marked as draft.

Filters:

- all players, by core team, high load, low load, high support burden, low development exposure, double-load used, dropped recently, unavailable-heavy

Season page layout:

- Header: "Season" with subtitle "Track load, movement, and fairness across the planning period."
- Controls: planning period selector, finalized/draft toggle, filters
- Top summary strip: total rounds, finalized rounds, draft rounds, players with warnings, highest support burden, double-load count
- Main: player × round matrix
- Side or lower panel: selected player/path drill-down
- Secondary: movement path summary table

Matrix row summary columns: rounds played, total selections, core matches, support matches, development matches, squad repair/backfill matches, double-load rounds, drops/rests, unavailable rounds, last movement, fairness warning count.

Movement path table columns: source team, target team, role, count, unique players, last used, warnings.

Season-level fairness warnings:

- player has high support burden compared with team average
- player has low development exposure compared with eligible peers
- player has repeated double-load
- player dropped twice before playing again
- player moved too many consecutive rounds
- team supplies disproportionate support
- expected support path unused
- unavailable rounds excluded from fairness debt

Each warning must include: severity, affected player/team/path, reason, drill-down link, whether based on finalized-only or draft-included data.

Data/service layer must be outside React components:

- `getSeasonPlayerRoundMatrix()`
- `getPlayerLoadSummary()`
- `getMovementPathSummary()`
- `getPlayerMovementTimeline()`
- `getSeasonFairnessWarnings()`

These services must distinguish draft and finalized data, count double-load correctly, count support/development separately, exclude unavailable rounds from fairness debt, and avoid hardcoded demo assumptions.

### Season export

The season overview page provides an export function that downloads finalized match data and season statistics.

Available formats: CSV, JSON, TXT, Markdown.
Available visibility modes: coach (includes roles, warnings, movement paths, explanations, override reasons), parent (hides internal planning tags).

Coach export includes:
- Per-selection rows: round, date, team, home/away, opponent, player name, source team, role, position, override reason, explanation
- Movement rows: round, date, player name, from team, to team, role
- Player statistics: player, team, rounds played, core matches, support matches, development matches, squad repair, double-load rounds

Parent export includes:
- Per-selection rows: round, date, team, home/away, opponent, player name, position
- Movement direction (without team names or role labels)
- Player statistics: player, team, rounds played

API endpoint: `/api/season/export?planningPeriodId=<id>&format=<csv|json|txt|md>&visibility=<coach|parent>`

### Prohibited copy

Never use: command center, decision inbox, decision debt, structured review room, workspace, optimization output, entity, resource, assistant advice (as a page concept replacing the workflow).

Use instead: Round Board, Needs Action, Round Checks, Squad planning, Generated squads, Player, Team, Next action.

### Domain language for movement and roles

Use neutral coaching language for all movement and selection descriptions:

| Concept | Use | Never use |
|---------|-----|-----------|
| Player sent to another team for support | Sent as support | Demoted, benched, punished, failed |
| Player received from another team | Received support, received squad repair, received development | Promoted, upgraded, reward |
| Player not selected for a round | Dropped, not selected this round | Benched, failed, weak player |
| Player moved for development | Development movement, development rotation | Promoted, rewarded, upgraded |
| Player filling a gap | Squad repair, cover, repair after support | Replacement, substitute, backfill (in UI) |
| Team with fewer players than target | Short, below target | Weak team, B-team, reserve team |
| Team donating players | Donor team, support source | Stronger team, higher team |
| Team receiving players | Receiving team, support target | Weaker team, lower team |

Note: BACKFILL remains the internal code role and rotation path role. Use "squad repair" in all user-facing UI and documentation.

### Round status model (5 states)

| Status | Meaning |
|--------|---------|
| NOT_GENERATED | No selections yet |
| DRAFT | Selections generated, not finalized |
| BLOCKED | Draft with HARD_BLOCK warnings |
| READY | Draft with no blockers |
| FINALIZED | Locked history |

## Testing requirements

Any change to selection behavior must include tests.

Run tests with `npm test`.

Required test coverage should include:
- same-round player conflict prevention
- same-round conflict requires override reason for manual edits
- duplicate selection in match requires override reason for manual edits
- support before development
- support not overridden by fairness scoring
- backfill priority order (1 → 2 → 3)
- non-rotatable exclusion from generic backfill
- warning generation when support/backfill fails
- warning persistence after generation
- season/planning-period fairness
- unavailable rounds excluded from fairness debt
- explanation output for important decisions
- populate all generates all rounds without finalizing
- populate all skips finalized rounds
- populate all reports partial failures without rollback
- clear all removes only non-finalized draft data
- clear round removes only selected round draft data
- clear match removes only selected match draft data
- clear actions preserve finalized history and setup data
- manual add player with and without valid path
- manual same-round conflict override with reason
- manual duplicate selection override with reason
- manual remove player recalculates warnings
- manual role change validates role-specific path
- manual override requires reason
- finalized match cannot be edited by draft action
- regenerate match preserves manual edits
- regenerate round preserves manual edits
- regenerate all drafts skips finalized rounds
- regeneration never touches finalized selections
- invariant validation catches invalid non-core movement
- rotation path policy enforces exact role matching
- un-finalize round reverts selections and movement ledger to DRAFT
- un-finalize single match reverts selections and re-derives round status
- un-finalize preserves other finalized matches in the round
- consecutive support rotation penalizes repeated support assignments
- consecutive support penalty increases with more consecutive rounds
- consecutive support does not prevent selection when no other candidate exists

## Data safety

Never commit real player names, private roster data, or database credentials.

Never commit AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, or any auth credentials.

Never prefix secrets with NEXT_PUBLIC_ (they would be exposed to the browser).

Demo data must be fake.

## Auth rules

Matchboard is a private coaching app. Auth is mandatory, not optional.

- Users must authenticate (Google OAuth) before accessing any app data
- Access is controlled by an email allowlist (`ALLOWED_COACH_EMAILS`)
- No public signup exists or should be added unless explicitly requested
- Every server action that reads or writes protected data must call `requireCoachAccess()`
- Every API route that reads or writes protected data must call `requireCoachAccess()`
- Every route showing protected app data must require authenticated coach access
- UI-only protection is insufficient — hiding buttons is not authorization
- Direct server action calls must fail without authorization
- Direct API calls must fail without authorization
- `requireCoachAccess()` is the shared authorization helper that all protected actions must use
- Create, edit, delete, finalize, export, clear, manual-edit, and populate actions must all be protected
- Unauthenticated users redirect to sign-in
- Authenticated but non-allowlisted users see access denied
- Tests or verification must cover unauthorized access scenarios

## Deployment and security

Before deployment-related work:
- Run `npm run lint`, `npm run build`, `npm test`, `npm run typecheck`
- Verify no secrets are tracked: `git ls-files | xargs grep -l "postgresql://\|neon.tech\|client_secret\|PRIVATE KEY" 2>/dev/null` should return nothing relevant
- Inspect any active selection-engine branch (`fix/selection-engine-remaining-tasks`) for pending improvements

### Hosting

Matchboard is deployed to **Vercel** with **Neon Postgres**. SQLite is not used for production persistence.

- Runtime queries use `DATABASE_URL` (Neon pooled connection)
- Prisma CLI/migrations use `DIRECT_URL` (Neon direct connection)
- `prisma.config.ts` configures the datasource URL from `DIRECT_URL` for CLI operations
- `src/lib/db.ts` auto-detects Neon from the connection string and uses the appropriate adapter

### Production migrations

- **Never run `prisma migrate dev` against production.**
- Production migrations must be run deliberately from a local machine: `npx prisma migrate deploy` with `DIRECT_URL` targeting Neon.
- Migrations must not run as part of the Vercel build process.
- The `postinstall` script runs `prisma generate` only — not migrations.

### Hard rules

- Real secrets belong only in local `.env` and Vercel environment variables
- `.env` must never be committed
- `.env.example` may contain placeholders only
- `.vercel/` must never be committed
- Vercel environment variables must never be committed to the repository
- `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and similar secrets must never be exposed as `NEXT_PUBLIC_*`
- No real player data, exports, local database files, or credentials may be committed
- Deployment must not happen until lint/build/security checks pass
- All data-mutating server actions must call `requireCoachAccess()` or equivalent
- All data-reading server actions and API routes exposing app data must call `requireCoachAccess()` or equivalent
- The `/api/health` endpoint must not expose business data (player counts, etc.)
- Rate limiting is in-memory only — document this limitation for production
- All final changes must use the `git-branch-commit-pr` skill

## Implementation style

Prefer:
- explicit domain code
- small files
- clear names
- boring architecture
- tests over confidence
- explanation objects from selection logic

Avoid:
- generic scheduling engines
- hidden UI-only rule behavior
- clever abstractions
- silent fallbacks
- adding features before rule consistency is proven

## Key engine files

| File | Purpose |
|------|---------|
| `src/lib/selection/generate-round.ts` | Round-level orchestrator |
| `src/lib/selection/generate-selection.ts` | Per-match selection |
| `src/lib/selection/resolve-round-support.ts` | Cross-match support and squad repair resolution |
| `src/lib/selection/resolve-round-conflicts.ts` | Same-round player conflicts |
| `src/lib/selection/route-core-match-drops.ts` | Core match drop routing |
| `src/lib/selection/rotation-path-policy.ts` | Movement eligibility validation |
| `src/lib/selection/validate-generated-round-invariants.ts` | Post-generation invariant checks |
| `src/lib/selection/save-generated-draft.ts` | Persist draft selections and movement ledger entries |
| `src/lib/selection/evaluate-controlled-double-load.ts` | Controlled double-load evaluation (must set controlledDoubleLoad flag, not role) |
| `src/lib/selection/migrate-double-load-roles.ts` | Migration: merge standalone DOUBLE_LOAD rows into base role rows with controlledDoubleLoad=true |
| `src/lib/selection/migrate-squad-repair-roles.ts` | Migration: role=CORE with "squad repair" explanation → role=BACKFILL |
| `src/lib/selection/backfill-movement-ledger.ts` | Normalization: create MovementLedger entries for existing non-core selections without ledger entries |
| `src/lib/selection/finalize-match-round.ts` | Finalize a round |
| `src/lib/selection/finalize-single-match.ts` | Finalize a single match within a round |
| `src/lib/selection/unfinalize-match-round.ts` | Un-finalize a round (revert to DRAFT) |
| `src/lib/selection/unfinalize-single-match.ts` | Un-finalize a single match (revert to DRAFT) |
| `src/lib/selection/get-planning-period-fairness.ts` | Fairness calculation (FINALIZED only) |
| `src/lib/selection/get-consecutive-support-count.ts` | Consecutive support round tracking |
| `src/lib/selection/refresh-draft-selection.ts` | Regenerate draft for a match or round |
| `src/lib/selection/populate-all-drafts.ts` | Populate all convenience workflow |
| `src/lib/selection/persist-warnings.ts` | Persist warnings after generation |

## Stale references removed

- `docs/domain.md` — deleted, do not reference
- `docs/spec-ux-overhaul.md` — superseded by `docs/specs/ux-overhaul.md`

## Assistant Manager Workflow Rules

When implementing workflow, selection, squad review, player profile, team review, or match review changes:

- Update supporting docs before implementation.
- Do not duplicate selection-engine logic in UI components.
- Use player IDs in stored payloads and external/public payloads.
- Do not store player names inside assistant issues, explanations, recommendations, decision records, or cross-team impact payloads.
- Do not introduce ability scores, best-XI language, permanent weak/strong labels, or public player ranking.
- Overrides must require a reason.
- Selection-affecting actions must create an auditable DecisionRecord.
- Use the git-branch-commit-pr workflow.
- Do not commit internal work logs, scratch notes, or handover documents.