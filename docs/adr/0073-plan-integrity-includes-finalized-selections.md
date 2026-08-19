# ADR-0073: Plan integrity squad checks include finalized selections

## Status

Accepted

## Date

2026-08-19

## Context

A coach reported being unable to finalize a real production round: 3 blocked conditions —
"Blocked: Blå is below minimum squad size", "Squad has no goalkeeper coverage at all.", "Squad
has 0 players but minimum is 11." — despite Blå having 12/12 players selected including a
goalkeeper. Verified directly against production data (read-only, with the maintainer's explicit
authorization): the round had 3 matches — Blå (12 selections, already `FINALIZED` via an earlier
per-match finalize action), Hvit (12, `DRAFT`), Rød (11, `DRAFT`) — 35 players total, matching
the reported "35 players selected across 3 matches, targeting 36" exactly.

Root cause: `computeRoundPlanIntegrity()` (`src/lib/selection/compute-plan-integrity.ts`) loaded
each match's selections with `where: { status: "DRAFT" }`. For Blå's match, whose 12 selections
had all been flipped to `FINALIZED` by an earlier per-match finalization, this query returned
zero rows — so every downstream check built from that match's selection list (the native
`SQUAD_BELOW_MINIMUM` signal, and the default policy's `squad_below_minimum`/
`no_goalkeeper_coverage` warnings, both fed by the same `m.selections` via
`buildPolicyInput()`'s `squads` array) saw an apparently-empty, fully-invalid squad for a match
that was in fact correctly staffed and already locked.

This directly contradicts documented intent: AGENTS.md already states finalization "recomputes
live integrity from current state server-side" and that per-match finalization "locks all DRAFT
selections for the target match as FINALIZED" while "other matches in the round remain in DRAFT
state" — the plan-integrity computation simply never accounted for the finalized-but-still-real
case when evaluating squad composition for the round's *other*, still-DRAFT matches.

## Decision

`computeRoundPlanIntegrity()`'s top-level query now loads both `DRAFT` and `FINALIZED`
selections (`status: { in: ["DRAFT", "FINALIZED"] }`) for both `round.matches[].selections` and
top-level `round.selections`. Squad-composition checks (native `SQUAD_BELOW_MINIMUM`, the policy
`squads`/`teams` input feeding goalkeeper-coverage and minimum-size warnings), the same-round
duplicate-assignment check, and the "available player without a planned opportunity" check all
now see a match's or player's full selection set regardless of draft/finalized status — a
finalized selection is still a real, planned assignment.

`SELECTED_PLAYER_UNAVAILABLE` is the one exception: it stays scoped to `DRAFT` selections only
(explicit `.filter((s) => s.status === "DRAFT")` in that loop), because a `FINALIZED` selection
isn't something a draft action can fix, and the match it belongs to isn't part of what the
round-level or per-match finalize call currently being evaluated would change.

## Consequences

- A round containing one or more individually-finalized matches can now be finalized (or have
  its remaining matches finalized) without spurious override requirements caused by the
  already-locked matches.
- The same-round duplicate-assignment check now also catches a genuine integrity violation it
  previously missed: a player with a `FINALIZED` selection in one match and a `DRAFT` selection
  in another match in the same round (a real double-booking) is now correctly flagged — it was
  invisible before, since the `FINALIZED` half never appeared in the DRAFT-only query.
- Regression test added: `src/lib/selection/__tests__/compute-plan-integrity.test.ts` — confirms
  a fully-staffed, individually-finalized match reports no squad-composition signals, and that a
  genuinely under-staffed `DRAFT` match still does.

## Related decisions

- None — first ADR specifically covering this function's selection-status handling.

## History

- 2026-08-19: Accepted. Fixed after a real, reported production blocker; verified against
  production data with the maintainer's explicit read-only authorization.
