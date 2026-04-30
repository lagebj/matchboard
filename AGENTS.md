# Matchboard Agent Instructions

Matchboard is a local-first web app for youth football match-round selection, controlled player movement, and squad history tracking.

## Workflow

The primary coach workflow is:

1. **Setup** — Create matches for a round (or use existing rounds). Mark player availability.
2. **Populate all** — Generate draft selections for all rounds in the active planning period. Each round is generated via round-level orchestration (not match-by-match). No round is finalized by populate all.
3. **Review** — Inspect draft selections, warnings, and fairness impact per round. Resolve blockers. Manually adjust if needed.
4. **Finalize** — Lock a round. Finalized rounds become history and cannot be silently mutated.

The Today page must always show the next action based on this workflow state.

## Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind
- Prisma
- SQLite

## Behavioral source of truth

`features/matchboard.feature` is the single behavioral source of truth for domain behavior, selection rules, and expected outcomes.

If code, UI, schema, tests, README, and `features/matchboard.feature` disagree, fix the mismatch.

`docs/domain.md` has been deleted. Do not reference it.

When workflow or UX semantics change, update `features/matchboard.feature`, `AGENTS.md`, and `README.md` before implementing. Do not implement product-shape changes before aligning supporting docs.

## Product boundary

Matchboard plans squads for already-created matches.

It does not:
- create fixtures
- schedule a season
- manage a club
- support auth
- support multi-user workflows
- store real player data in the repo

## Core operating model

Selections are generated per match round.

A match round is the operational planning unit.

The season or planning period is the fairness and load-balancing context.

A round may contain one or more matches.

A player should normally only be selected once per round unless an explicit rule allows otherwise.

Populate all generates drafts for all rounds in a planning period in one action. It does not finalize. Each round is generated via round-level orchestration to preserve cross-match conflict resolution.

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

## Rule precedence

Team support is priority 1.

If a team needs required support, that support must be attempted before:
- optional development movement
- fairness optimization
- cosmetic balancing
- generic rotation

If required support cannot be fulfilled, generate a warning. Do not silently weaken the team.

Fairness must not override required support. Fairness is a scoring preference, not a hard rule.

## Backfill rules

When a player is moved from their core team as support, their own team may need backfill.

Backfill priority order:

1. Own core team player moved as support, if matches are on different dates and the player can play both
2. Players from development teams
3. Any other player from another team where `nonRotatable = false`

Rules:
- Non-rotatable players must never be used as generic backfill
- Backfill must respect same-round conflict rules unless explicitly allowed
- If no valid backfill exists, generate a warning instead of silently weakening the team

## Warnings

Warnings are generated during round generation and must be persisted to the database.

Each warning has a severity level:
- **HARD_BLOCK** — prevents finalization
- **REQUIRES_OVERRIDE** — allows finalization with manual override reason
- **WARNING** — informational, does not block finalization
- **SCORING_PREFERENCE** — explains a ranking decision

The UI reads warnings from the database, not from in-memory generation results. If warnings are not persisted, the UI cannot show blockers and finalization cannot check for hard blocks.

## Selection architecture

Keep selection logic out of React components.

Selection logic belongs in `src/lib/selection/*`.

Rule loading and validation belong in `src/lib/rules/*`.

Keep these concerns separate:
- round orchestration (`generate-round.ts`)
- per-match generation (`generate-selection.ts`)
- round eligibility
- support selection
- backfill selection
- development selection
- core selection
- season fairness
- conflict validation
- warning generation and persistence
- explanation generation
- finalization/snapshotting

Do not grow a monolithic `generate-selection.ts`.

The orchestrator should be thin.

Rules must be testable without React.

## Populate all

Populate all is a convenience workflow that generates drafts for all non-finalized rounds in the active planning period.

- It calls `generateMatchRound` for each round in chronological order
- It uses round-level orchestration (not match-by-match)
- It does not finalize any round
- It skips already-finalized rounds
- It persists warnings per round after generation
- Draft selections from earlier rounds may be used as provisional planning context for later rounds in the same run
- On partial failure, successful round generations are kept and failures are reported

## UI architecture

### Canonical routes (6 only)

| Route | Purpose |
|-------|---------|
| `/` | Today — review active round, blockers, next action |
| `/rounds` | Rounds — generate, review, finalize per match round |
| `/players` | Players — availability, load, movement history |
| `/teams` | Teams — lightweight directory linking to team detail pages |
| `/rules` | Rules — selection rules, support priority, backfill behavior |
| `/history` | History — finalized rounds, movement, fairness over time |

Detail routes (no top-level nav):
- `/rounds/[matchRoundId]` — round workbench
- `/players/[playerId]` — player profile
- `/teams/[teamId]` — team detail workspace

### Teams page and team detail

The `/teams` page is a lightweight directory. It links each team to its detail page.
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

- **Sidebar**: 6 items (Today, Rounds, Players, Teams, Rules, History)
- **Top context bar**: season, planning period, active round status, primary action
- **Mobile nav**: 5 items (Today, Rounds, Players, Teams, History)

### Prohibited copy

Never use: command center, decision inbox, decision debt, structured review room, workspace, optimization output, entity, resource.

Use instead: Round Board, Needs Action, Round Checks, Squad planning, Generated squads, Player, Team.

### Domain language for movement and roles

Use neutral coaching language for all movement and selection descriptions:

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

## Data safety

Never commit real player names, private roster data, or local SQLite data.

Demo data must be fake.

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
| `src/lib/selection/resolve-round-support.ts` | Cross-match support resolution |
| `src/lib/selection/resolve-round-conflicts.ts` | Same-round player conflicts |
| `src/lib/selection/route-core-match-drops.ts` | Core match drop routing |
| `src/lib/selection/resolve-backfill-after-support.ts` | Post-support backfill |
| `src/lib/selection/save-generated-draft.ts` | Persist draft selections |
| `src/lib/selection/finalize-match-round.ts` | Finalize a round |
| `src/lib/selection/get-planning-period-fairness.ts` | Fairness calculation (FINALIZED only) |
| `src/lib/selection/refresh-draft-selection.ts` | Regenerate draft for a round |

## Stale references removed

- `docs/domain.md` — deleted, do not reference
- `docs/spec-ux-overhaul.md` — superseded by `docs/specs/ux-overhaul.md`