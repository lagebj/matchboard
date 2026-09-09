# ARR-0043: Player names are interpolated into stored selection explanations, warnings, and reasons

## State

Open. Recorded during Consolidation Programme C6 (F6, recommendation-explanation work), not
resolved there — the fix is a dedicated selection-engine PII pass, out of scope for the
explanation-contract change.

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
