# ADR 0019: Generation Drafts and League/Event Policy Contexts

## Status

Accepted

## Context

Stage 4 removed the proprietary JSON policy DSL and migrated rules into explicit layers (core invariants, default TypeScript policy, optional Rego). However, policy and generation still lack two critical capabilities:

1. **No explicit league vs event policy context.** The default policy and Rego rules apply uniformly regardless of whether the decision is about league match selection (longitudinal fairness over rounds/periods/seasons) or event squad generation (temporary construction feasibility). League fairness concerns (match count adjustments, period balance) should not affect event squad generation, and event construction concerns (squad size, position coverage) should not affect league selection.

2. **No draft/preview/commit lifecycle for event squads.** League selections already have DRAFT → FINALIZED status. Event squad generation persists assignments immediately without a review step. Coaches need to see generated squads, review policy warnings, adjust manually, and then commit — the same Generate → Preview → Explain → Adjust → Validate → Commit workflow that league planning supports.

## Decision

### 1. Policy decision types

Add explicit `PolicyDecisionType` to `SelectionPolicyInput.context`:

- `league_match_selection` — per-match squad selection within a round
- `league_round_fairness` — round-level fairness evaluation
- `event_squad_generation` — event squad construction
- `event_helper_selection` — event match helper selection
- `event_lineup_planning` — event match lineup slot assignment
- `post_match_report_availability` — post-match report availability check

Add `PolicyFairnessScope` to scope fairness evaluation:

- `match` — single match context
- `round` — round-level fairness
- `period` — Spring/Fall fairness
- `season` — full-season fairness
- `event` — event-level context
- `event_match` — single event match context

### 2. Context-aware default policy

The default TypeScript policy now branches by mode:

- **League mode**: applies fairness score adjustments (low recent/period/season match count) and match-level warnings
- **Event mode**: applies squad construction warnings (GK coverage, squad below minimum, squad below target) but not longitudinal fairness adjustments

Rego policies branch by `input.context.mode` and `input.context.decisionType`.

Core invariants (removed, inactive, unavailable, duplicate) apply in all modes.

### 3. Event squad draft lifecycle (future work)

Event squads need a DRAFT → CONFIRMED lifecycle analogous to league Selection DRAFT → FINALIZED. This requires:

- `EventSquadStatus` enum in Prisma schema (DRAFT, CONFIRMED)
- Commit/unconfirm server actions with validation
- Pre-commit validation (minimum size, no duplicates, GK coverage)
- Assistant work items for draft review states

This ADR records the architecture decision. The schema migration and server actions will be implemented in a follow-up.

## Consequences

### Positive

- Policy context is explicit — league and event rules don't accidentally cross
- Default policy correctly separates longitudinal fairness (league) from construction feasibility (event)
- Rego rules can target specific decision types
- Foundation for event squad draft lifecycle is established in types

### Negative

- `decisionType` is now required in `SelectionPolicyInput` — all callers must provide it
- Event squad generation needs schema migration and new actions (follow-up work)
- Rego policies must explicitly check mode/decisionType to avoid cross-contamination

## Rejected alternatives

- One generic fairness score for all workflows — would conflate longitudinal fairness with temporary construction
- Auto-apply generation without preview — risky for coach trust; league already has DRAFT/FINALIZED lifecycle
- Moving solver logic into Rego — solver must remain deterministic app code
- Duplicating league/event rules in assistant UI — assistant should consume policy/validation output, not duplicate logic
- Allowing policy to override core invariants — hard safety rules must never be overridden