# ADR-0102: Post-match Feedback Consolidated into Football Observations

## Status

Accepted

## Context

Matchboard had two coach-facing, post-match, player-level inputs living side by side on the same post-match page:

- **Post-match feedback** (`MatchExecutionFeedback`, `src/lib/coaching/match-execution-feedback.ts`) — five fixed categories (effort, team help, reset after mistake, positional discipline, teammate involvement), a value (POSITIVE/NEEDS_ATTENTION), optional observable-behavior text, a next-action, and a note. AGENTS.md's "Post-match reflection and feedback" section.
- **Football observations** (`PlayerDevelopmentObservation` with `kind: "ATTRIBUTE"`, `src/components/player-development/football-observation-section.tsx`, `src/lib/evidence/football-observation-service.ts`) — a 14-code football-skill vocabulary with a direction and an observable note, shipped as the Match Evidence Engine's domain foundation (#359) and already feeding `player-evidence-service.ts`.

Both asked the coach to describe the same match, for the same players, in different vocabularies, back to back on the same screen. Inspecting field-by-field: both capture a behavior category, a direction/value, and an observable-behavior note. Football observations' vocabulary is the newer, more granular one and is the one already wired into the evidence engine — Post-match feedback fed nothing downstream (no evidence, no readiness-scoring consumer was found).

## Decision

**Football observations (`PlayerDevelopmentObservation`) is the canonical player-development observation concept.** Post-match feedback is retired as an active input:

1. **No new `MatchExecutionFeedback` rows can be created.** The active write path (`src/components/matches/match-feedback-section.tsx`, `src/app/(app)/matches/[matchId]/post-match/feedback-actions.ts`) is removed, along with its now-obsolete tests.
2. **Historical data is preserved, never deleted.** The `MatchExecutionFeedback` table and existing rows are untouched. They render read-only via `LegacyMatchFeedbackSection` (`src/components/matches/legacy-match-feedback-section.tsx`) — labeled "Post-match feedback (legacy)", shown only on a match that already has legacy rows (renders nothing otherwise), positioned after the canonical Football observations section on the post-match page.
3. **`src/lib/coaching/match-execution-feedback.ts`'s CRUD functions were already unreachable before this change** — the removed action file inlined its own `db.matchExecutionFeedback.*` calls rather than calling this module — and remain unused after it. Left in place as flagged residue for a future cleanup pass rather than deleted in the same change that touched the active UI surface; deleting a domain module is a separate decision from retiring the UI path that never used it.
4. **No double-counting risk found.** Neither `readiness-scoring.ts` nor any other selection/evidence consumer reads `MatchExecutionFeedback` — it had no downstream effect to begin with, so retiring it changes no evidence computation.

## Consequences

- One clear place for post-match player-development input: Football observations.
- `feedbackData` on the post-match page now exists solely to feed the read-only legacy display — a direct `db.matchExecutionFeedback.findMany()` read, not a route through the deleted action file.
- Original feedback categories (effort, team help, reset after mistake, positional discipline, teammate involvement) remain visible only on historical matches that used them; no new match can reference them going forward.

## Migration

None — no schema change. `MatchExecutionFeedback` remains a fully valid, queryable table for historical reads.
