# Matchboard Agent Instructions

Matchboard is a local-first web app for youth football match-round selection, controlled player movement, and squad history tracking.

Selections are generated per match round. Fairness is evaluated across the season/planning period.

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

## Selection architecture

Keep selection logic out of React components.

Selection logic belongs in `src/lib/selection/*`.

Rule loading and validation belong in `src/lib/rules/*`.

Keep these concerns separate:
- round orchestration
- round eligibility
- support selection
- backfill selection
- development selection
- core selection
- season fairness
- conflict validation
- warning generation
- explanation generation
- finalization/snapshotting

Do not grow a monolithic `generate-selection.ts`.

The orchestrator should be thin.

Rules must be testable without React.

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
- season/planning-period fairness
- unavailable rounds excluded from fairness debt
- explanation output for important decisions

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
