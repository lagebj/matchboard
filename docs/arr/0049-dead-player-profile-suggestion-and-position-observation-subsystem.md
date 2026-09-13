# ARR-0049: Dead player-profile-suggestion and position-observation subsystem

## State

Identified

## Identified

2026-09-13

## Residue

Auditing the current player-position implementation for the Atlas Follow-up bundle's Phase F3
(evolving player-position model, ADR-0139) found a substantial, coherent subsystem that is
**entirely unreachable from any real user-facing surface today**, confirmed by three independent
checks (no component import, no `fetch()` call site, no page wiring anywhere in `src/`):

- **`PlayerProfileSuggestion`** / **`PlayerProfileSuggestionEvidence`** (Prisma models) — a
  PENDING → ACCEPTED/ADJUSTED/REJECTED suggestion-and-approval workflow for both
  `targetType: "ATTRIBUTE"` and `targetType: "POSITION"`.
- **`src/lib/player-development/suggestions.ts`** — `evaluatePlayerAttributeSuggestions()`,
  `createOrUpdatePendingSuggestion()`, `decideSuggestion()`, `getPendingSuggestions()`,
  `getSuggestionHistory()`. `createOrUpdatePendingSuggestion()` (the only function that can ever
  create a suggestion) has **zero callers anywhere in the repository** — nothing ever creates a
  pending suggestion of either target type. `decideSuggestion()` explicitly branches: attribute
  suggestions are handled; for `targetType !== "ATTRIBUTE"` it returns literally
  `{ success: false, error: "Position suggestion decisions not yet implemented" }` — a stub, not
  a working path, left in place since original authorship.
- **`src/lib/player-development/position-experience.ts`** — `getPositionExperienceForPlayer()`
  and `evaluatePositionEvidence()`, reading `PlayerDevelopmentObservation` rows with
  `kind: "POSITION"`. Only ever called by its own test file — no production caller before this
  ARR's own Phase F3 work (see "Disposition" below).
- **`src/lib/player-development/observations.ts`** — `createDevelopmentObservation()`/
  `deleteDevelopmentObservation()`, supporting `kind: "ATTRIBUTE" | "POSITION"` observations. The
  only caller is `src/app/api/players/development-observations/route.ts`, itself called by
  nothing.
- **`src/components/player-development/development-observation-section.tsx`** — a UI component
  for creating these observations, imported by no page or parent component anywhere.
- **`src/app/api/players/suggestions/route.ts`** and
  **`src/app/api/players/development-observations/route.ts`** — two API routes with real,
  working, authorized handlers, each called by zero client code.

Git history confirms the shape: this subsystem was built in `65ab2554` ("feat: Opponent Sporting
Level and Player Development (Stages 0-1)") — an early, explicitly-staged rollout ("Stages 0-1")
whose later stages (wiring a suggestion-creation trigger, a decision UI, an observation-entry UI)
were apparently never built. It was last substantively touched in `a87096fa` ("feat(evidence):
canonical post-match learning pipeline"), the commit that established ADR-0104's
`runPostMatchLearning()` orchestrator and, with it, `player-evidence-service.ts` /
`AssessmentChange` / `football-observation-service.ts` — a **different, successor** evidence
pipeline that computes and **auto-applies** attribute-rating changes directly (no
pending/approval step at all), superseding the Stage-0/1 suggestion-and-approval design without
ever removing it. This is the exact same "superseded but not removed" pattern AGENTS.md already
documents for `MatchExecutionFeedback`'s CRUD functions (see AGENTS.md's "Post-match reflection
and feedback" section) — a second, independent instance of it.

## Intended architecture

`AssessmentChange` (`recordAssessmentChange()`, `src/lib/evidence/assessment-change.ts`) is the
now-canonical, actually-used audit trail for evidence-driven player-attribute changes — reached
via `player-evidence-service.ts`'s `computeAndApplyPlayerEvidenceForMatch()`, itself wired into
`runPostMatchLearning()` (ADR-0104). It computes and applies directly, with no coach
approval gate. `AssessmentChange.targetType` already includes `"POSITION"` in its type union
(`AssessmentChangeTargetType = "ATTRIBUTE" | "GOALKEEPER" | "POSITION"`) and `"GOALKEEPER"` is a
real, live-written value (`player-evidence-service.ts:591`) — but nothing writes `"POSITION"`
either, before this ARR's own Phase F3 work.

Phase F3 (ADR-0139) deliberately does **not** complete or wire up the dead
`PlayerProfileSuggestion` approval workflow for positions — the bundle's own contract
(`07_EVOLVING_PLAYER_POSITION_MODEL.md §7`) explicitly requires "Do not require redundant
approval for normal evidence-backed evolution," which a PENDING/ACCEPT/REJECT gate would
directly violate. ADR-0139 instead writes `Player.primaryPosition`/etc. directly and audits via
`DecisionRecord` (the mechanism AGENTS.md already mandates for player-development actions, and
the one `suggestions.ts`'s own `decideAttributeSuggestion()` already uses for its accepted
attribute-suggestion writes — confirming `DecisionRecord` as the correct choice independent of
this ARR).

One piece of this dead subsystem **is** salvaged, not left to rot: `evaluatePositionEvidence()`'s
confidence/direction computation is reused as-is by
`src/lib/player-development/sync-effective-position.ts` (ADR-0139) as the "explicit position
observations" evidence input — a legitimate, still-correct evaluator, worth keeping even though
its surrounding suggestion-approval workflow is not. `getPositionExperienceForPlayer()` is
likewise reused as the observation-fetch query. Everything else named above remains dead.

## Impact

- No functional impact today — none of this code runs in any live coach workflow, so there is no
  behavior to regress.
- Risk for a future agent: encountering `PlayerProfileSuggestion`/`suggestions.ts`/
  `observations.ts`/`DevelopmentObservationSection` without this record could reasonably (and
  wrongly) conclude a "position suggestion" feature is mid-development and needs finishing,
  duplicating work ADR-0139 already deliberately did differently (direct write + DecisionRecord,
  not a suggestion queue) — this is exactly the ambiguity this ARR exists to prevent.
- `kind: "POSITION"` `PlayerDevelopmentObservation` rows can never be created through any current
  UI, so ADR-0139's observation-evidence input will, in practice, always be empty for every
  player today — a disclosed, honest limitation of Phase F3, not a bug in its reader.

## Containment

- Do not build a new UI or wiring to complete the `PlayerProfileSuggestion` POSITION
  decision path (`decideSuggestion()`'s "not yet implemented" branch) — ADR-0139 has already
  chosen a different, no-approval-required design for automatic position evolution.
- Do not delete `PlayerProfileSuggestion`/`suggestions.ts`/`position-experience.ts`/
  `observations.ts`/the two orphaned API routes/`DevelopmentObservationSection` as part of
  unrelated work without first confirming no historical `PlayerProfileSuggestion` rows exist in
  any production organisation (none can exist given the creation function has zero callers, but
  this should be verified against the real database before deletion, not assumed).
- `evaluatePositionEvidence()`/`getPositionExperienceForPlayer()` remain a legitimate dependency
  of `sync-effective-position.ts` (ADR-0139) — do not remove them while that caller exists.
- If a future coding-agent session reads `kind: "ATTRIBUTE"` suggestion code and is tempted to
  wire it up as a "missing feature," check this ARR first — the successor pipeline
  (`player-evidence-service.ts`/`AssessmentChange`) already does the equivalent job without an
  approval gate, by design.

## Resolution criteria

- [ ] A maintainer decision on whether to delete the whole dead subsystem outright (schema
      migration dropping `PlayerProfileSuggestion`/`PlayerProfileSuggestionEvidence`, removing
      `suggestions.ts`, `observations.ts`, the two orphaned routes, and
      `DevelopmentObservationSection`) or to revive the `kind: "POSITION"`/`kind: "ATTRIBUTE"`
      observation-creation UI as a genuinely useful, separate coach-facing capability.
      `evaluatePositionEvidence()`/`getPositionExperienceForPlayer()` would need extracting to a
      standalone module first if the deletion path is chosen, so ADR-0139's dependency on them
      survives.
- [ ] Once decided, either the deletion or the revival is implemented with its own regression
      tests.

## Disposition

Undispositioned — awaiting the maintainer decision above. Recorded now, per this repository's
"when an ARR is discovered during code work, record it before continuing" rule, rather than
silently building Phase F3 on top of an unexplained pre-existing gap.

## Related decisions

- ADR-0139 (Evolving player-position model) — the work that discovered this while auditing
  existing position-related code, and the reason `evaluatePositionEvidence()`/
  `getPositionExperienceForPlayer()` specifically are kept rather than orphaned further.
- ADR-0104 (Canonical post-match learning pipeline) — the successor pipeline whose
  `player-evidence-service.ts`/`AssessmentChange` machinery superseded the original Stage-0/1
  suggestion-and-approval design without removing it.

## Related implementation

- `prisma/schema.prisma` — `model PlayerProfileSuggestion`, `model PlayerProfileSuggestionEvidence`
- `src/lib/player-development/suggestions.ts`
- `src/lib/player-development/observations.ts`
- `src/lib/player-development/position-experience.ts` (partially salvaged — see above)
- `src/app/api/players/suggestions/route.ts`
- `src/app/api/players/development-observations/route.ts`
- `src/components/player-development/development-observation-section.tsx`
