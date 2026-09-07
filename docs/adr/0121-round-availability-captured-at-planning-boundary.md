# ADR-0121: Per-Round Player Availability Is Captured at Planning-Boundary Closure

## Status

Accepted

## Context

Several readers need to know **what a player's availability was for a given match round**,
including rounds finalized in the past:

- `computeRoundPlanIntegrity()` — the `SELECTED_PLAYER_UNAVAILABLE` and
  `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` checks, and the `repeatedContext` ("this missing
  opportunity repeats an earlier omission") enrichment.
- `get-planning-period-fairness.ts` — the "unavailable rounds excluded from fairness debt" rule
  (AGENTS.md "Season overview rules").
- Insights `opportunity-gap.ts`, `opportunity-matrix.ts`, `load-timeline.ts` — all render a
  per-(player, round) "unavailable" cell/count.

The domain has always had two availability representations:

1. **`Player.currentAvailability`** — a single mutable current value. Correct for a round whose
   planning boundary is still open; wrong for a historical round (the value has moved on by the
   time a season is reviewed).
2. **The round-scoped `Availability` model** (`[playerId, matchRoundId] → AvailabilityStatus`) —
   the right shape for historical questions, and already queried by every reader above, but
   **ARR-0041** established it has had **no production write path**. Every real finalized round
   therefore resolved every player to "no row" → `UNKNOWN`, silently disabling the historical
   half of all those checks.

ARR-0041's current-round half was fixed (2026-09-04) by pointing `computeRoundPlanIntegrity()`'s
two live checks at `Player.currentAvailability`. Its historical half was left open, with two
recorded resolution options: give the round-scoped model a real writer, or retire it. This ADR
takes the first option.

### Repository audit findings

- The `Availability` model already has exactly the needed shape — `[playerId, matchRoundId]`
  unique, `organisationId`, `status: AvailabilityStatus` (the **same enum** as
  `Player.currentAvailability`), `note?`. No schema change, no enum mapping.
- `ensureMatchPlanningBaselineCaptured()` (`capture-planning-baseline.ts`, ADR-0109) is already
  the one idempotent, race-safe owner of "the pre-match plan has become historical intent." When
  a round's last open match closes, it calls `round-finalization-transitions.ts`'s
  `finalizeRoundRecord()` inside a transaction — the exact moment, and the exact writer, where a
  historical availability baseline belongs. `reopenMatchPlanningForReschedule()` is its symmetric
  reverse.
- `get-planning-period-fairness.ts` and the three Insights readers already query the
  `Availability` model directly with `status` filters and already treat "no row" as neutral
  (never as "unavailable"). They need **zero code changes** — they simply begin receiving real
  data once a writer exists.
- No marker column is needed to tell "captured" from "not captured": a `FINALIZED` round with at
  least one `Availability` row is unambiguously captured, because this snapshot is the only
  writer.

## Decision

**1. Capture at planning-boundary closure.** `finalizeRoundRecord()` freezes an `Availability`
row per relevant player as the round becomes `FINALIZED`, in the same transaction that already
locks selections and bumps the rule-config version. Population = players with a selection in the
round ∪ active, non-removed players whose core team has a non-cancelled match in it — the same
population `computeRoundPlanIntegrity()`'s missing-opportunity check evaluates. A player outside
that set had no round obligation, so a missing captured row for them is "out of scope", not
"unknown-and-concerning". Written with `skipDuplicates`; immutable once written (a later edit to
`Player.currentAvailability` for a future round never rewrites it).

**2. Clear on genuine reschedule.** `unfinalizeRoundRecord()` deletes the snapshot rows when
`reopenMatchPlanningForReschedule()` reverts a round to `DRAFT` (ADR-0109 §4). The round's
availability is live-editable again and must not read as "captured." Safe because this snapshot
is the only writer of League `Availability` rows.

**3. Three-way reader** (`src/lib/selection/round-availability.ts`,
`getRoundAvailabilityResolver(matchRoundId, roundStatus, liveAvailabilityByPlayerId)`):

| Round state | `source` | Value returned |
|---|---|---|
| Not `FINALIZED` | `LIVE` | `Player.currentAvailability` (from the caller's already-loaded map) — identical to pre-ADR-0121 behaviour |
| `FINALIZED`, ≥1 snapshot row | `CAPTURED` | the frozen row; a player with no row → `UNKNOWN` / `NO_HISTORICAL_DATA` |
| `FINALIZED`, 0 snapshot rows (closed before this shipped, or empty roster) | `NO_HISTORICAL_DATA` | `UNKNOWN` for every player |

`compute-plan-integrity.ts` §2/§4 resolve through this. `NO_HISTORICAL_DATA` is not in
`AVAILABILITY_VALUES_AVAILABLE`, so a pre-ADR-0121 finalized round produces **no**
availability-derived signal — an honest "we don't know", never a fabricated "was available".
`repeatedContext` needs no change: it already only counts an earlier round that has a captured
`AVAILABLE` row and no selection.

**4. Opt-in historical backfill.** `scripts/backfill-round-availability.ts`
(`npm run backfill:round-availability`, `--dry-run` supported) writes `AVAILABLE` rows for
players who held a `FINALIZED` selection in a pre-ADR-0121 finalized round — a finalized
selection is provable evidence the player was available enough to be planned. Non-selected
players are left with no row (genuinely unrecoverable — writing their *current* availability
would be the exact bug this ADR prevents). Idempotent (skips any round that already has a row).
Not run automatically by any deploy or migration; the maintainer runs it when ready to accept
the retroactive change to historical fairness/Insights output. Mirrors
`backfill-match-planning-baseline.ts`'s lifecycle.

## Consequences

- Open rounds: no behaviour change. The `LIVE` branch reads the same field the ARR-0041 fix
  introduced.
- Newly finalized rounds: historical readers now have accurate per-round availability. The
  `repeatedContext` enrichment, `get-planning-period-fairness.ts`'s "unavailable rounds excluded
  from fairness debt", and the Insights unavailable cells become real for the first time in
  production.
- `get-planning-period-fairness.ts`'s `availableRounds`-gated flags (`support_burden_review`,
  `core_exposure_review`) were previously unreachable (`availableRounds` was always 0) and can
  now fire. This is the rule finally working, not a regression.
- Rounds finalized before this ADR, and never backfilled: unchanged (readers see
  `NO_HISTORICAL_DATA` / no rows, exactly the safe default they already handled).
- No migration. Single PR. Additive writer + additive reader + additive opt-in script.

## Relationship to other records

- **Extends ADR-0109** — adds availability to what automatic planning-boundary capture snapshots
  alongside selections and the movement ledger.
- **Resolves the historical half of ARR-0041** — the round-scoped `Availability` model now has a
  real production writer; update that ARR's Disposition.
- The current-round half of ARR-0041 (`Player.currentAvailability` for open rounds) and the
  generation-engine eligibility gap for plain `UNAVAILABLE` are unaffected and out of scope here.
