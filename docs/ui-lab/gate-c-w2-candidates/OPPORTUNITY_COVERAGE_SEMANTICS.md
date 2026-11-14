# Gate C W2 — Opportunity Coverage Semantics (C04)

## The two measures, precisely

| Tile | Numerator | Denominator | What it counts | Source |
|---|---|---|---|---|
| "Opportunities planned" | `plannedOpportunities` | `targetOpportunities` | **Squad placements** — sum of each match's current squad size vs. each match's target squad size. A player counted here could, in principle, be double counted across matches if the domain ever allowed it (it doesn't — see below), but the measure itself is slot-shaped, not player-shaped. | `buildRoundBoardViewModel` (`round-board-production-adapter.ts`), derived from the matches array the page already builds. |
| "Eligible players with an opportunity" | `assignedEligiblePlayerCount` | `eligiblePlayerCount` | **Distinct players** — how many of the players eligible for this round (active, core team has a playable fixture this round) currently have *any* planned match opportunity. | `RoundPlanIntegrity.coverage` (`compute-plan-integrity.ts`), passed through unchanged. |

These numbers will sometimes coincide numerically (e.g. when every match's target squad size equals its roster size) — that is a coincidence of a specific round's shape, not evidence the two measures are the same thing. The C04 fixtures deliberately set `targetSquadSize` above roster size in several cases specifically so the two tiles read different numbers, proving the distinction is real and not merely cosmetic.

## Why `coverage`'s own field names are slightly misleading (disclosed, not changed)

`RoundPlanIntegrity.coverage.eligibleAvailablePlayerCount` and `.assignedEligibleAvailablePlayerCount` are **not filtered by current availability**, despite the "Available" in the name. Reading `compute-plan-integrity.ts` directly:

```ts
const eligibleActivePlayers = activePlayers.filter(
  (p) => p.removedAt === null && p.coreTeamId != null && teamsWithPlayableFixtureThisRound.has(p.coreTeamId),
);
// ...
coverage: {
  eligibleAvailablePlayerCount: eligibleActivePlayers.length,
  assignedEligibleAvailablePlayerCount: eligibleActivePlayers.filter((p) => selectedPlayerIds.has(p.id)).length,
  unassignedEligibleAvailablePlayerIds: unassignedEligibleAvailable, // THIS list is availability-filtered
}
```

Only the third field, `unassignedEligibleAvailablePlayerIds` (which Round Board does not currently consume — see below), is actually filtered to players whose availability resolves to `AVAILABLE`/`TENTATIVE`. The two count fields count *every* eligible active player regardless of availability — an injured player with no planned opportunity still reduces the coverage percentage. This is the canonical, already-shipped definition; this wave surfaces it faithfully rather than re-deriving a "corrected" version in the UI (rule 3: use the data model as given).

## What Round Board does and does not read from `coverage`

- Reads: `eligibleAvailablePlayerCount`, `assignedEligibleAvailablePlayerCount` (now, via this wave's fix).
- Does not read: `unassignedEligibleAvailablePlayerIds`. The per-player "Decision required" attention items the rail already lists come from `RoundPlanIntegrity.signals` (specifically the `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` rule), which **is** availability-filtered at the point the signal is generated — so the specific players surfaced as individual decisions are correctly availability-aware even though the aggregate coverage tile is not. These are legitimately two different questions ("how many eligible players have an opportunity" vs. "which available players specifically need a decision") answered by two different, both-canonical mechanisms.

## Edge cases verified

- Zero eligible players: both tiles read `0 / 0`, not a NaN or a fabricated 100%.
- Every eligible player assigned: coverage tile is complete (`N / N`) while the squad-placement tile can still show a shortfall if `targetSquadSize` exceeds the roster — proving the tiles answer different questions even at the "everyone's covered" extreme.
- Several players missing: each appears as its own attention item (never collapsed into a single count), and the coverage tile's denominator reflects the true eligible population, not just the affected players.
