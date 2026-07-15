# 0027 — Opponent Canonical Lifecycle

Date: 2026-07-15

## Status

Accepted

Supersedes: 0013 (opponent entity creation timing and fixture-creation coupling; encounter observations and Fair Play unchanged and now governed by this ADR and 0026)

## Context

ADR 0013 introduced the `OpponentTeam` model as a reusable private match-planning entity and required every `Match` and `EventMatch` to reference one persisted `OpponentTeam` via `opponentTeamId`. The previous implementation created canonical `OpponentTeam` entities during fixture creation.

This created several problems:

1. **Forced premature entity creation.** Coaches had to create or select an opponent record before scheduling a fixture, even for one-off opponents they may never encounter again.
2. **Provisional opponents from future fixtures.** Creating opponent entities at fixture time meant unplayed future fixtures generated opponent records that might never correspond to a real encounter.
3. **Orphan opponents.** When fixtures were cancelled or never played, the previously created opponent entities remained without any completed encounter, cluttering the registry and providing no historical value.
4. **Silent name changes.** If the canonical opponent was renamed, fixture display names could change silently, losing the historical record of what the opponent was called at the time of the fixture.

The AGENTS.md requirement states that every match must reference one persisted opponent team while preserving `Match.opponent` as a historical match-time display-name snapshot, and that opponent observation data must not automatically alter selection-engine outcomes. The lifecycle mismatch between "opponent as scheduling convenience" and "opponent as encountered identity" needs to be resolved.

## Decision

### A. Fixture creation stores a name snapshot, not an entity

- `Match.opponent` is a required display-name snapshot that preserves the opponent name at fixture creation time.
- `EventMatch.opponentName` serves the same role for event matches.
- Fixture creation (adding a match or event match) stores the opponent name snapshot without requiring or creating an `OpponentTeam` entity.
- Coaches may optionally select an existing opponent during fixture creation, linking the fixture to the canonical entity via `opponentTeamId`.

### B. `opponentTeamId` becomes optional on Match

- `Match.opponentTeamId` changes from required to nullable (optional).
- `EventMatch.opponentTeamId` remains nullable as already designed.
- A match or event match without `opponentTeamId` has no canonical opponent — only the name snapshot.
- Entering unmatched free text for an opponent name stores the snapshot without creating an entity.

### C. Canonical opponents are created on report completion

- The canonical `OpponentTeam` entity is created or reused only when a post-match report reaches completed status (REPORTED or LOCKED).
- This applies to both league matches and event matches.
- Draft reports do not create opponents.
- Opening the report workspace does not create opponents.
- Reopening a completed report does not delete the opponent.
- Correcting and recompleting a report relinks safely (the existing opponent entity is reused, not duplicated).
- Selecting an existing opponent during fixture creation links to the existing entity immediately via `opponentTeamId`; no new entity is created.

### D. Name snapshot vs canonical identity

- `Match.opponent` and `EventMatch.opponentName` are required display-name snapshots that preserve the name at fixture creation time.
- `opponentTeamId` is the canonical relation to the reusable opponent entity.
- Historical fixture names must not change silently when the canonical opponent is renamed. The snapshot always takes precedence for display on the fixture.
- The canonical opponent's current `displayName` is used for encounter observations, future fixture search/select, and opponent history.
- Only completed encounters create canonical opponents. An opponent without completed encounters may exist if it was pre-created, but it carries no historical guidance until a report is completed.

### E. Normalisation rules

Opponent name matching for entity creation or reuse uses exact normalised matching only:

- Trim leading and trailing whitespace.
- Collapse repeated internal whitespace to a single space.
- Compare case-insensitively (normalise to lowercase for comparison).
- No fuzzy matching, edit distance, substring guesses, or AI-based merging.
- If the normalised name matches an existing `OpponentTeam.normalizedName`, the existing entity is reused.
- If no match is found, a new `OpponentTeam` is created with the normalised name and the original display name.

This prevents both accidental duplication from trivial spelling differences and incorrect merging of genuinely different opponents.

## Consequences

- Coaches are not forced to create opponent records before scheduling. A free-text name is sufficient for fixture creation.
- Opponent entities represent encountered teams, not scheduled names. Only completed reports produce canonical opponents.
- Unmatched free-text opponents have no historical guidance (sporting level, encounter observations, Fair Play history) until their first completed report creates a canonical entity.
- Existing provisional `OpponentTeam` records without completed encounters are reconciled during migration: orphaned records are retained but marked as having no encounter history; coaches may merge or delete them manually.
- The fixture snapshot model matches the requirement in AGENTS.md: `Match.opponent` preserves the historical display name, `opponentTeamId` provides the canonical link when available.
- ADR 0013's encounter observation and Fair Play provisions remain unchanged and are governed by this ADR and ADR 0026.
- The `OpponentTeam.normalizedName` unique constraint remains and is used for deduplication at entity creation time.