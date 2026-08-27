# ADR-0098: Quick Observation — Capture-First, Classify-Later

## Status

Accepted

## Context

Phase 8 of the Evidence-Driven Coaching Loop programme requires a low-friction way for a coach to jot something down in the moment — during or right after a match — without deciding up front which existing evidence/observation owner it belongs to (DECISIONS.md "Quick observations": "Capture first, classify later"). Matchboard already has several structured observation owners, each with real required fields that force classification at write time:

- `DevelopmentThreadObservation` — requires an existing `ACTIVE` `DevelopmentThread`.
- `TeamReflection` — one per match, several optional structured fields plus free `note`.
- `OpponentEncounterObservation` — one per match, several required environment/category fields plus a validated `factualSummary`.
- `PlayerDevelopmentObservation` (Match Evidence Engine) — requires `kind`/`direction`/`attributeKey`, i.e. a fully-classified assessment change.

None of these can be the capture-first inbox itself — writing to any of them already requires the classification decision this feature exists to defer.

## Decision

1. **`QuickObservation` is a new, minimal model**: `note` (required, ≤1000 chars), optional `matchId`, optional `playerIds` (JSON array, ≤20), `recordedBy`, `createdAt`. No AI classification — every transition is an explicit coach action.
2. **Status lifecycle**: `OPEN` → one of `CONVERTED` (with `convertedToType`/`convertedToId` recording which owner it became), `KEPT_AS_NOTE` (reviewed, no further action), or `DISCARDED`. All three are terminal — an already-resolved observation cannot be re-converted or re-discarded.
3. **Conversion targets, scoped to what's cheaply correct today**:
   - `DEVELOPMENT_THREAD` — appends the note as a `DevelopmentThreadObservation` on an existing thread (the caller supplies `threadId`; a quick observation never implicitly creates a thread, since a player may have at most 2 active threads and creating one is a deliberate decision).
   - `TEAM_REFLECTION` — appends to the match's `TeamReflection.note` (upserting the row if none exists), preserving existing content rather than overwriting it. Requires the observation to have a `matchId`.
   - `OPPONENT_OBSERVATION` — appends to the match's `OpponentEncounterObservation.factualSummary`, reusing the exact same identifying-detail rejection (`containsIdentifyingDetails`, extracted from `validate-observation.ts` for this reuse) and length cap as the normal opponent-observation form — the quick-capture path does not get a policy bypass. Requires `matchId` and the match to already reference an `opponentTeamId`.
   - Converting to a `PlayerDevelopmentObservation` (the Match Evidence Engine's structured, versioned assessment model) is deliberately **not implemented** here — it requires `kind`/`direction`/engine-version classification that is itself a real "classify later" decision with its own UI, better done as a dedicated follow-up rather than bolted onto this capture inbox under time pressure.
4. **No new writable truth is created.** `QuickObservation` never becomes a competing source for player goals/assists/development context — it either stays a plain note or is explicitly folded into an existing canonical owner.
5. **Coach-facing only.** Never appears in parent-facing exports or external AI payloads (same boundary as `MovementCandidate`, readiness signals, etc.).

## Consequences

- `src/lib/coaching/quick-observation.ts` is the single owner; `src/app/(app)/matches/quick-observation-actions.ts` adapts it for server actions.
- A minimal capture/list/convert UI ships on the player profile page (`PlayerQuickObservationsPanel`), scoped to the one conversion target that doesn't need match context (development thread). A match-scoped surface exposing the team-reflection/opponent-observation conversions is a natural Phase 7 (contextual evidence surfaces) follow-up, not added here to avoid scope creep into that phase's own surfacing work.

## Migration

- New `QuickObservation` model, `QuickObservationStatus`/`QuickObservationConversionType` enums (migration `20260830150000_add_quick_observation`).
