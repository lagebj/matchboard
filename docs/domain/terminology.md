# Canonical UK Football Terminology

This document is the single source of truth for visible product language in Matchboard.

All user-facing UI, validation messages, empty states, exports, README, AGENTS.md, feature files, domain documentation, and opponent-planning explanations must use these canonical terms.

## Canonical terms

| Canonical visible term | Avoid in visible product language | Notes |
|---|---|---|
| Football | Soccer | Always |
| Match | Game (when referring to a football contest) | "Game" is acceptable in general English |
| Fixture | Scheduled game | A fixture is a scheduled match |
| Squad | Roster (when referring to selected players) | "Roster" is not a football term in UK English |
| Team | Roster (when referring to selected players) | A team is a persistent competition entity |
| Squad selection | Team generation | Matchboard selects squads, not teams |
| Starting line-up | Starting lineup, starting XI | UK hyphenation; use full phrase for clarity |
| Line-up | Lineup | UK hyphenation |
| Substitute | Bench player | Standard UK football term |
| Formation | Tactic layout | Formation describes positional structure |
| Pitch | Field (when referring to the playing surface) | "Field" is acceptable in code identifiers |
| Shirt number | Jersey number | UK football convention |
| Kick-off | Start time (when referring to a fixture) | Kick-off refers to the scheduled start of a match |
| League season | Phase, planning period | The bounded spring/autumn operational window |
| Season | Year period, phase | The broad football-year context |
| Autumn | Fall | UK English |
| Match round | Planning period | The operational planning unit |
| Squad repair | Backfill (in visible current behaviour) | Internal enum BACKFILL remains for compatibility |
| Not selected this round | Benched | Neutral coaching language |
| Development opportunity | Lesser-player opportunity | Not a label of player quality |
| Established player | Better player | Not a permanent category |
| Suitable challenge | Easy or weak match as a player judgement | Opponent-level planning context |
| Finalised | Finalized (in visible UK English) | UK spelling in user-facing text |
| Finalisation | Finalization (in visible UK English) | UK spelling in user-facing text |
| Sporting level | Opponent rating, opponent strength, opponent quality score | Observed football level of the opposition |
| Sporting fit | Match fit | How suitable the challenge was for our squad |
| Match environment | Threat assessment | Observable conditions, not a judgement |
| Fair Play concern | Fair Play concern, observed concern | Not "bad behaviour" or "red flag" |
| Post-match observation | Post-match observation | Not "opponent evaluation" |
| Previous encounters | Encounter history | Not "risk history" |

## Domain boundaries

- A **team** is a persistent competition entity (e.g. the Under-12 Blues).
- A **squad** is a group selected or available for a team, event or match.
- A **line-up** assigns selected players to match positions.
- A **fixture** is a scheduled match.
- A **match** is the played or playable football contest.
- A **formation** describes positional structure (e.g. 2-3-1 for 7-a-side).
- **Tactics** are broader than formation: they include coaching intent, responsibilities and style.
- An **opponent sporting-level estimate** is private planning evidence, not a permanent public judgement.

## Internal identifiers

The following internal identifiers remain unchanged for database and code compatibility:

- `FINALIZED` enum value (maps to visible "Finalised")
- `BACKFILL` enum value (maps to visible "Squad repair")
- `DRAFT`, `REPORTED`, `LOCKED` enum values
- `Match` model name (code identifier)
- `MatchRound` model name (code identifier)
- `LeagueSeason` model name (maps to visible "League season")
- Field names in code and database that use generic terms (e.g. `field` in a form context, `game` unrelated to football)

These internal identifiers are translated at the product boundary (UI labels, validation messages, exports, documentation). Code and database names do not need to change if the migration cost outweighs the value.

## Exclusions

Do not blindly replace generic programming words (field, game, finalize) where they are unrelated to football-facing language. For example:

- A "field" in a form is not the playing surface.
- A "game" in game theory or game format context is not a match.
- "finalize" as a database transaction concept is not a visible product term.

Use judgement: if the word appears in a user-facing string, apply the canonical term. If it is purely internal, leave it.

## Opponent-planning language

Opponent sporting-level assessment must use:

- **Sporting level** for the observed football quality of the opposition
- **Sporting fit** for how suitable the challenge was for our squad (existing model)
- **Match environment** for observable conditions (existing model, separate from level)
- **Fair Play concern** for conduct observations (existing model, separate from level)

Never use: opponent rating, opponent quality score, opponent strength, easy match, weak opponent, strong opponent.

## Enforcement

A terminology check scans defined user-facing and canonical-documentation areas for clearly banned vocabulary. It supports explicit exclusions for legacy identifiers and historical ADR text. See `scripts/check-terminology.mjs`.