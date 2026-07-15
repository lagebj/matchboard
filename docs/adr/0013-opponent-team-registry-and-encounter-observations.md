# 0013 — Opponent Team Registry and Encounter Observations

Date: 2026-07-14

## Status

Accepted — partially superseded by ADR 0026 (opponent sporting-level assessment and planning guidance; encounter observations and Fair Play unchanged)

## Context

Matches previously stored opponent names as free-text strings (`Match.opponent`). This made it impossible to track opponent history, reuse opponent identity across matches, or record structured encounter observations without duplicating data.

Event matches also needed opponent identity (home/away, opponent team link) for cup, tournament, and friendly-day contexts.

## Decision

Introduce an `OpponentTeam` model as a reusable private match-planning entity:

- Every `Match` and `EventMatch` references one persisted `OpponentTeam` via `opponentTeamId` (nullable, optional for backward compatibility)
- `Match.opponent` is preserved as a historical display-name snapshot
- `OpponentTeam` stores `displayName` (user-facing name) and `normalizedName` (unique, for deduplication)
- `OpponentEncounterObservation` records structured per-encounter observations (sporting fit, match environment, fair play concerns)
- Match-environment observations are separate from sporting-fit feedback
- Privacy boundaries: no opponent player names, coach names, parent/spectator names, referee names, shirt numbers linked to incidents, contact info, or physical descriptions
- Free-text opponent summaries are short (max 500 chars), factual, coach-facing, and must reject obvious email/phone/URL patterns
- Serious Fair Play concerns are recorded but handled through club processes outside Matchboard
- Opponent observation data must not appear in parent-facing exports or external AI payloads
- Opponent observations must not automatically alter selection-engine outcomes

## Consequences

- Opponent identity is now reusable across matches and events
- Encounter observations are structured and queryable
- Privacy guardrails are enforced at the model level
- Match creation and event match creation forms now include opponent search/select
- Historical match data retains free-text opponent names; new matches link to OpponentTeam
- Backfill script provided for existing match opponent strings