# Gate C W2 — Source Reconciliation

## Authoritative source

`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` is the only authoritative register entry for C04, C05, and C06. Verbatim requirements:

| ID | Surface | Required state | Required viewport/theme | Acceptance question |
|---|---|---|---|---|
| C04 | Round Board | Planning open, unresolved player decision | Desktop dark + mobile dark | Opportunity distribution with eligible denominator near actionable round work (XR-A02) |
| C05 | Round Board | Planning closed, unresolved historical warnings | Desktop dark + mobile light | Read-only meaning, no false Resolve action |
| C06 | Round Board | Allocation, dense matrix | Desktop light + mobile assigned sheet | Match assignment retains 24-slot precision while player summaries/inspectors use 14 general roles (XR-P02) |

As with Gate C W1, **no official Gate-C wave-ordering document exists** (unlike Gate A's `20_UI_LAB_CANDIDATE_WAVES.md`). C04-C06 as a "W2" grouping is therefore self-assigned/provisional, not an official wave assignment from the original handoff bundle. The exact scenario IDs and requirements above are preserved verbatim; nothing in this reconciliation invents a missing programme decision.

## Mandatory reading completed

- `AGENTS.md`, `docs/development/coding-agent-working-session.md`.
- `docs/agents/README.md` modules: `selection-planning-and-fairness.md`, `ux-and-terminology.md`, `testing-and-quality.md`, `issue-and-arr-workflow.md`.
- `features/matchboard.feature`.
- ADR-0124 (adaptive contextual UI composition), ADR-0129 (exact positional semantics / automatic planning safety), ADR-0136 (Touchline Atlas composition convergence), ADR-0154 (canonical tactical position model), ADR-0157 (contextual coach workspace convergence), ADR-0159 (Visual Authority Gate).
- `docs/implementation/atlas-followup/reference-decomposition/round-board.md` (the real "Atlas Round Board composition contract" — no file literally named "composition contract" exists; the authoritative `02_ROUND_BOARD_CONTRACT.md` lives only in the gitignored `.matchboard-work/` bundle, not in git) and `docs/implementation/atlas-followup/gate-d-round-board-conformance-sheet.md`.
- Gate C W1's own doc set (`docs/ui-lab/gate-c-w1-candidates/`) for conventions.
- The real Round Board route, components, view-model, adapter, plan-integrity, and planning-boundary code (full audit — see `CURRENT_STATE_AUDIT.md`).

## Resolved open question: "14 general roles"

The register's C06 acceptance question names "14 general roles" without defining the vocabulary anywhere in `docs/`. Direct code audit resolved this: `src/domain/positions/roles.ts` defines `SOURCE_ROLES` as exactly 14 codes — `EXACT_ROLES` (the 12-code ADR-0129 automatic-planning vocabulary: `GK, LB, CB, RB, DM, CM, AM, LM, RM, LW, RW, ST`) plus `"SS"` and `"W"`. This is the "14 general roles" the register means. See `POSITION_VOCABULARY_AND_PRECISION.md` for why this vocabulary, and the 24-code `CANONICAL_TACTICAL_POSITIONS` it is contrasted against, are both real but neither is currently consumed anywhere in Round Board.

## C06's acceptance question is split into two independently-dispositioned concerns (fourth remediation pass)

The verbatim register text above remains authoritative and unedited. A fourth independent review found that navigation to the Lineup editor (added in a prior remediation pass) does not, by itself, demonstrate C06's acceptance question — it is correct context, not proof. See `POSITION_VOCABULARY_AND_PRECISION.md`'s "C06 as two separate acceptance concerns" section for the full split: **C06-A** (dense Round Board allocation) is demonstrated and disposed `PROPOSED_REFINEMENT (implemented)`; **C06-B** (the literal 24-slot-vs-14-role precision question quoted above) remains `BLOCKED_BY_SOURCE_OR_AUTHORITY`, with a two-option decision record left for the repository owner, not resolved by this PR.

## Scope decision

C04-C06 constitute this wave's full scope. No work on C07 (Assistant Coach fallback) or C08 (same-day quick add) was started, per the brief's explicit exclusion. Issue #827 (Visual Authority fingerprint invalidation) remains separately tracked and was not remediated here, but its lesson (a shared fixture edit silently invalidates a prior wave's approval) directly shaped this wave's fixture architecture — see `DATA_TRUTH_AND_FIXTURES.md`.
