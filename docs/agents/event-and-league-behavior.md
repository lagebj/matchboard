# Event and league behavior

This module covers league seasons, rounds, fixture lifecycle, events, and match statuses.

## League seasons and rounds

League seasons define the operational window for the season. A round is the primary planning unit for squad generation and checking. Rounds, matches, and their shared status model must stay aligned with the app's operational semantics.

The product keeps the distinction between:

- scheduled match state
- planning state
- historical/finalized state
- cancelled or genuinely rescheduled state

## Event planning

Event planning has parity with league planning but remains a separate operational surface for cups, friendlies, and tournament fixtures. Event squads, availability, and support planning must remain consistent with the league planning model.

## Live reporting parity

League and Event live execution share the same behavioral contract: protocol-v2 coordinator
ordering, persisted clocks, canonical sequence, and shared projection/Follow Live. Event
report-mode live mutation is group-role-aware, matching League: organisation mutation
authority plus, for non-admin users, `GROUP_COACH` authority on the match's football group
(ADR-0140). This rule governs only live-reporting mutation; Event's wider general planning
authorization model (squad generation, lineup editing, and other planning actions) is
unchanged by it. See `docs/development/live-match-realtime.md`.

## Match states and rescheduling

A genuine reschedule can reopen planning only when the match did not actually start. Finalized rounds and matches become historical and should not be silently changed. Real-world planning boundaries remain the authority for when historical status captures the plan.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/product-operating-model.md`
- `docs/agents/coaching-domain-model.md`
- ADRs covering round lifecycle, event planning parity, and live reporting
