# ADR-0100: Lifecycle Consolidation — Pin Semantics and Round Progress (Phase 6, scoped)

## Status

Accepted

## Context

Phase 6 of the Evidence-Driven Coaching Loop programme calls for removing/hiding unnecessary manual finalise/lock/submit actions, deriving round/match workflow, using concrete vocabulary such as `Pin`, and updating Today/operational health to guide the coach by football action rather than internal state names.

Auditing the current implementation before making changes surfaced a direct conflict that bounds what this phase can safely do:

- AGENTS.md's Phase-0 audit (from earlier in this programme) already classifies `finalize`/`finalized` as a **technical invariant** — plan becomes immutable history — not something to remove. `submit` (the `REPORTED` intermediate report status) was already retired as a routine workflow step *before* this programme started (`AGENTS.md` "Direct post-match workflow": "Normal post-match completion uses one visible 'Complete report' action, not separate Submit plus Lock steps").
- AGENTS.md's Round status model section is explicit and absolute: **"The app uses exactly these visible status labels: Not generated, Draft, Blocked, Ready, Finalized. No alternative visible status terms for the same state may be introduced."** This directly forbids replacing that vocabulary with DECISIONS.md's target lifecycle wording (Planning open/Upcoming/Live/Played/Report incomplete/Done).

Given this, a wholesale rewrite of the finalize/unfinalize UI and the Round/Match status vocabulary is not a change this programme's coding-agent execution can make unilaterally — it would contradict an existing, deliberate product decision documented as absolute. That decision is either still correct (in which case Phase 6's target vocabulary must be understood as describing a *different* axis) or needs an explicit product-owner decision to change (out of scope here).

## Decision

**Phase 6 is scoped to what is genuinely additive and does not conflict with the existing status-label rule:**

1. **Round progress is a new, additive concept, not a replacement.** DECISIONS.md's target vocabulary (Planning/Partially played/All matches played/Reporting/Complete) describes whether a round has actually been *played and reported* — a different axis from the mandatory Draft/Blocked/Ready/Finalized planning-completeness status. `src/lib/rounds/round-progress.ts`'s `deriveRoundProgress()` computes this from the round's matches (excluding cancelled ones) and their report status, and is shown as a second, small line on the Rounds list alongside — never instead of — the existing `StatusBadge`.

2. **`PlayerLock` gets its first real UI, using "Pin" language.** The model already existed (read by `generate-selection.ts` as `lockedInPlayerIds`/`lockedOutPlayerIds`) but had zero coach-facing surface — a real, useful constraint mechanism nobody could use. `src/lib/selection/player-lock.ts` (create/list/delete) and `pinPlayerAction`/`unpinPlayerAction` (`src/app/(app)/teams/player-lock-actions.ts`) back a minimal "Pin in" / "Pin out" control added to the Team workspace's Current Round tab (`team-detail.tsx`) — the lowest-risk existing surface where a coach already reviews this round's core/sent/dropped players, rather than inventing a new interaction pattern in the much larger Round Board. Engine-facing explanation text (`generate-selection.ts`) now says "pinned in"/"pinned out" instead of "manually locked in/out" — the underlying `PlayerLock`/`LOCKED_IN`/`LOCKED_OUT` model and field names are unchanged, since the engine's own read logic depends on them.

3. **Today gains one new, real work item: a planned rotation change left `DELAYED` after the match was played.** `DELAYED` is deliberately re-visitable (ADR-0097), so a delayed change that never gets resolved is a genuine loose end, not a soft note — it belongs on Today the same way an incomplete post-match report does. A second candidate item ("an open QuickObservation getting old") was considered and rejected: AGENTS.md already establishes that "Planning notes, scoring preferences, opponent observations, and seasonal context never appear as Assistant work items" — a QuickObservation is exactly that kind of soft, non-blocking note, so surfacing it on Today would contradict an existing design principle, not extend it.

## What this explicitly does not do

- Does not remove, hide, or relabel any existing finalize/unfinalize/lock-report UI or wording — those remain exactly as documented, since they are the correctly-classified technical invariant.
- Does not introduce alternative visible labels for the Draft/Blocked/Ready/Finalized round status.
- Does not touch `REPORTED`/submit-step residue beyond what was already retired before this programme.

A full Phase 6 (actually reworking the finalize/unfinalize interaction model itself) remains open and would require an explicit product decision superseding the current "exactly these visible status labels" rule — not something to infer from DECISIONS.md's vocabulary alone.

## Consequences

- Coaches can now express "this player must play this round" or "this player must not be used this round" directly, with the engine already honoring it — previously only possible by editing the database directly.
- The Rounds list communicates actual match-day progress without disturbing the existing, required status vocabulary or its consumers (filters, badges).
- A stuck `DELAYED` rotation change is now visible on Today instead of silently forgotten.

## Migration

None — no schema change (`PlayerLock` already existed); additive UI, server actions, domain functions, and one new `AssistantWorkCategory` value (`planned_rotation_delayed`).
