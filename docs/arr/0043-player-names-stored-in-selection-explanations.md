# ARR-0043: Player names are interpolated into stored selection explanations, warnings, and reasons

## State

Resolved — 2026-09-09 (Consolidation Programme C6 follow-up). Every `${playerName}` /
`${candidate.playerName}` / `${getPlayerName(...)}` interpolation was removed from persisted
selection-engine strings; a regression test enforces it. See "Resolution".

## Identified

2026-09-09.

## Intended architecture

`AGENTS.md` ("Coach-facing vs parent-facing language" / "Explanation model" / "Assistant Manager
Workflow Rules") is explicit:

> Do not store player names inside assistant issues, explanations, recommendations, decision
> records, or cross-team impact payloads. Use player IDs. Resolve names for display only.

Explanations attach to a specific `SelectedPlayer` / `Selection` already, so the name is
redundant as well as a privacy leak — the rendering surface knows which player the explanation
is for.

## Residue

`src/lib/selection/generate-selection.ts` interpolates a resolved player name
(`${candidate.playerName}` / `${playerName}`, from `getPlayerName(player)`) directly into
persisted free-text on roughly 20 sites, across three sinks that are all stored:

- `buildExplanation(code, summary, hardRule)` — `summary` is persisted to `Selection.explanation`
  (JSON) and `SelectionExplanation` rows (ARR-0002). ~13 sites, e.g. `registered_match_fairness`,
  `support_priority_over_core`, `development_priority_over_core`, `same_week_missed_core_priority`,
  `position_secondary_match` / `position_tertiary_match` / `position_mismatch`,
  `support_avoid_suitability`, `indirect_support_backfill`, `player_locked_in`,
  `development_not_ready`, `support_development_then_core_priority`.
- `message:` on warning / plan-integrity signal objects (persisted to `Warning` rows), e.g. the
  `unknown availability`, tentative-availability, `support_no_show`, and position-coverage
  messages.
- `selectionReason:` prose on `SelectedPlayer` (persisted to `Selection.selectionReason`), e.g.
  the core-match-drop, higher-priority-opportunity, and pinned-in reasons.

Two of those strings also use non-neutral wording: `"which is a weak positional fit"` and
`"This may weaken the team's positional coverage"` (`weak`/`weaken` — see the coach-facing
language rules).

`src/lib/selection/resolve-round-support.ts` and `generate-round.ts` build `ExplanationRecord`s
via local helpers (`buildSupportExplanations`, `buildDonorDropExplanation`) — these were not
audited line-by-line here; they must be checked in the same pass.

## Evidence

- `grep -n 'playerName' src/lib/selection/generate-selection.ts` → 54 occurrences; the
  `buildExplanation(...)` / `message:` / `selectionReason:` subset interpolates a name into a
  stored string.
- `AGENTS.md` "Do not store player names inside … explanations …".
- ARR-0002 (the same explanation data has two storage locations — both would carry the name).

## Impact

- Player personal data (name) is persisted in `Selection.explanation`, `SelectionExplanation`,
  `Warning.message`, and `Selection.selectionReason` rows, contrary to the stated rule and the
  PII inventory intent (`docs/domain/pii-inventory.md`).
- The same rows are read by the Round Board tooltip, the coach handover view, `team-review-page`,
  and the admin policy workbench — none strictly need the embedded name (they resolve the player
  from the id).
- A future external-AI or parent-export path that reads these rows would leak names unless it
  re-sanitised — the rule exists precisely so that sanitisation is not required downstream.

## Containment

- Do not add a new `buildExplanation(...)` / `message:` / `selectionReason:` site that
  interpolates a player name. New per-player explanation prose is name-free — the surface knows
  the player.
- New reason data should use the `RecommendationReason` contract
  (`src/lib/explanations/recommendation-reason.ts`, C6), whose `params` are counts/minutes/tiers
  only — no names, no scores.

## Resolution criteria

- Every `buildExplanation` / `message:` / `selectionReason:` string in
  `generate-selection.ts`, `resolve-round-support.ts`, and `generate-round.ts` is name-free.
- The `weak` / `weaken` positional wording is replaced with neutral language.
- A regression test asserts no persisted `Selection.explanation` / `SelectionExplanation` /
  `Warning.message` / `Selection.selectionReason` value produced by a generated round contains a
  fixture player's name.
- `docs/domain/pii-inventory.md` updated if it currently implies these rows are name-free.

## Resolution

Every player-name interpolation was removed from persisted / surfaced selection-engine strings —
wider than the criteria's three files, since the same violation existed in adjacent modules:

- `generate-selection.ts` — ~25 `buildExplanation` summaries, warning `message:`s, `selectionReason:`s
  and `exclusionReason:`s. Player-scoped explanations now read "This player …" / restructured
  (the explanation already attaches to one player); warning messages read "A selected player …"
  (each warning object carries `playerId`, so the surface resolves the name). `"weak positional
  fit"` / `"may weaken the team's positional coverage"` → `"limited positional fit"` / `"may
  reduce the team's positional coverage"`.
- `resolve-round-support.ts` — 6 squad-repair / support-resolution explanation summaries.
- `generate-round.ts` — the duplicate-in-two-teams hard-rule-violation message.
- `resolve-round-conflicts.ts` — 2 round-conflict removal messages.
- `validate-generated-round-invariants.ts` — 2 invariant-violation messages.
- `compute-plan-integrity.ts` — 6 `title` / `currentState` strings on `SELECTED_PLAYER_UNAVAILABLE`,
  `DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE`, `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`
  signals (all carry `playerId`).
- `rotation-candidate-evaluation.ts` — 4 `Excluded because …` reason strings.

Team names, counts, dates, and role labels are kept (all allowed in coach-facing explanations).
`getPlayerName()` / the transient in-memory `SelectedPlayer.playerName` field are unchanged —
they are never persisted.

Regression test: `src/lib/selection/__tests__/no-player-names-in-explanations.test.ts` runs the
full generation + persistence pipeline for the fixture round and asserts no fixture player's
`firstName` or `"firstName lastName"` appears in any `Selection.selectionReason`,
`Selection.explanation` JSON, `SelectionExplanation` row (all Json columns), or `Warning.message`.
`docs/domain/pii-inventory.md` gained a positive entry.

## Related decisions / records

- ARR-0002 (selection explanation dual storage — same rows)
- ARR-0033 (Round Board renders selection explanations — a reader)
- ADR-0128 (C6 recommendation-reason contract — the name-free structured model new code uses)

## Supersedes / Superseded by

None.

## History

### 2026-09-09

Recorded during Consolidation Programme C6. The C6 PR fixed the two non-name explanation leaks it
found (`score {n}` in the Tactics panel, `goalsAgainst / occurrences` arithmetic in the rotation
generator) and shipped the name-free `RecommendationReason` contract, but the systemic
player-name interpolation across `generate-selection.ts`'s ~20 stored-string sites is a separate
dedicated pass.

### 2026-09-09 (same day)

Resolved. The dedicated PII pass removed every player-name interpolation across seven
selection-engine modules (see Resolution), fixed the `weak`/`weaken` wording, added the
regression test, and updated the PII inventory.
