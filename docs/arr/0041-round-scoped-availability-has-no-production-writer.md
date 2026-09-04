# ARR-0041: Round-scoped `Availability` has no production write path

## State

Partially resolved — see "Resolution" below. The current-round live checks are fixed and
regression-tested. The historical/season-fairness half of this finding remains open.

## Identified

2026-09-04, while implementing the Matchboard Public Documentation Expansion Programme's B2
bundle (Fair playing opportunity / Squad selection engine deep pages). Verifying "how does a
coach mark availability, and what does the generation engine actually read" against real seeded
data and the real `generateSelection()` code path surfaced a discrepancy between the schema's
apparent intent and actual runtime behaviour: a player explicitly seeded as `UNAVAILABLE` for a
specific round via the round-scoped `Availability` model was still selected as `CORE` by
`generateMatchRound()`, then flagged after the fact by `computeRoundPlanIntegrity()`'s
`SELECTED_PLAYER_UNAVAILABLE` Blocked check.

## Residue

Two independent, non-overlapping representations of "is this player available" exist:

1. **`Player.currentAvailability`** (`AvailabilityStatus`, a single scalar field on `Player`, not
   round-scoped) — set by the only production writer, `setPlayerAvailability()`
   (`src/lib/players/player-domain.ts`) via `setPlayerAvailabilityAction`
   (`src/app/(app)/players/actions.ts`). This is what the Players page's inline availability
   control writes, what the Round Board's "Available players" column reads
   (`src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx`), and — critically — the only
   availability signal `generateSelection()` (`src/lib/selection/generate-selection.ts`) reads
   for its own hard-exclusion logic (`INJURED`/`SICK`/`AWAY`/`UNKNOWN` excluded,
   `TENTATIVE` included with a warning).
2. **`Availability`** (Prisma model, `matchRoundId` + `playerId` + `status`, genuinely
   round-scoped) — read extensively: `compute-plan-integrity.ts` (the
   `SELECTED_PLAYER_UNAVAILABLE` Blocked check and a second per-round check),
   `get-planning-period-fairness.ts` ("unavailable rounds excluded from fairness debt"),
   `get-season-overview.ts`, `opportunity-gap.ts`, `opportunity-matrix.ts`, `load-timeline.ts`
   (via `get-players-overview.ts`), `best-lineup.ts`, `simulation-context-builder.ts`/
   `simulation-service.ts`/`apply-simulation.ts`, `get-player-pathways.ts`, and
   `report-mutations.ts`. A repository-wide search (`grep -rn "db\.availability\."`) finds **no**
   production `create`/`upsert` call for this model anywhere outside test factories
   (`src/test/support/factories.ts`) and test setup/teardown (`src/test/test-db.ts`). No server
   action, page, or domain function writes a round-scoped `Availability` row in real coach usage.

In real production use, every `Availability` lookup for every real round therefore resolves to no
row, and every affected computation's own "no row" fallback is `"UNKNOWN"`. That fallback happens
to make the `SELECTED_PLAYER_UNAVAILABLE` Blocked check a structural no-op in practice (its inner
condition only matches `INJURED`/`SICK`/`AWAY`/`UNAVAILABLE`, never bare `UNKNOWN`) — so this
specific check does not misfire in production. But every other reader listed above that treats
"no row" as meaningfully different from "confirmed available" (fairness's own documented
"unavailable rounds excluded from fairness debt" rule chief among them) cannot actually
distinguish "this player was genuinely unavailable that historical round" from "we simply never
recorded a round-scoped row for them," because the latter is universally true in production.

## Intended architecture

AGENTS.md's "Canonical data truth" section and its broader "one business operation, one owning
implementation" principle both imply a single, unambiguous concept of "is this player available
for this round." The schema's `matchRoundId`-scoped `Availability` model, and the amount of
downstream code written against it, indicates the intended design was genuinely round-scoped
availability history — not a single always-current flag reused across every round. The current
reality is closer to the latter: `Player.currentAvailability` behaves as "whatever the coach most
recently set, applied to whichever round is next generated," with no durable per-round record of
what that value actually was at the time.

## Evidence

- `grep -rn "db\.availability\." src/` (excluding `__tests__`/`.test.ts`) returns 17 read sites
  and zero write sites in application code.
- `src/app/(app)/players/actions.ts`'s `setPlayerAvailabilityAction` is the only production
  availability-setting server action found repository-wide (`grep -rln "currentAvailability"
  src/app/(app)` across every route group), and it calls `setPlayerAvailabilityDomain()`
  (`src/lib/players/player-domain.ts`'s `setPlayerAvailability()`), which writes only
  `Player.currentAvailability` — no `matchRoundId` argument exists anywhere in that call chain.
- `src/lib/selection/generate-selection.ts`'s own `db.player.findMany()` candidate-pool query (no
  `availabilities` relation `include`/`select`) confirms the per-match generation engine's
  eligibility loop (`player.currentAvailability === "INJURED" | "SICK" | "AWAY" | "UNKNOWN" |
  "TENTATIVE"`) never touches the round-scoped model at all.
- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx` builds its "Available players"
  column and its own `Unavailable: ${p.currentAvailability}` selection-reason text directly from
  `Player.currentAvailability`, confirming the Round Board's own coach-facing availability
  concept is the non-round-scoped field, not the `Availability` model.
- Reproduced live: seeding a round-scoped `Availability` row of `UNAVAILABLE` for a player whose
  `Player.currentAvailability` remained `AVAILABLE` (the seed script's own default) resulted in
  that player being selected as `CORE` by `generateMatchRound()`, then flagged by
  `computeRoundPlanIntegrity()`'s `SELECTED_PLAYER_UNAVAILABLE` check — the two models disagreed,
  and generation followed the one with no coach-facing writer.

## Impact

- **Fairness's "unavailable rounds excluded from fairness debt" rule cannot function as
  documented** (AGENTS.md, "Season overview rules"): `get-planning-period-fairness.ts` reads the
  round-scoped model to decide this, and that model is never populated for any real historical
  round, so no round is ever actually excluded from fairness debt on this basis in production —
  the very absence that should mean "we don't know" is indistinguishable from "this player was
  never unavailable."
- Several Insights surfaces (`opportunity-gap.ts`, `opportunity-matrix.ts`, `load-timeline.ts`)
  read the same always-empty-in-production source for similar per-round availability context,
  with the same silent-`UNKNOWN` effect.
- `SELECTED_PLAYER_UNAVAILABLE` (a documented Blocked plan-integrity condition, AGENTS.md
  "Blocked conditions") was, before the fix below, unreachable through ordinary automatic
  generation in production, since it depended on a round-scoped row that nothing writes.
- **Correction to an earlier claim in this record**: an initial version of this entry stated that
  "the generation engine's own hard-exclusion logic ... does correctly keep confirmed
  unavailable/injured/sick/away/unknown players out of automatic selection." That is not accurate.
  `generate-selection.ts`'s own eligibility loop hard-excludes `INJURED`/`SICK`/`AWAY`/`UNKNOWN`
  and soft-includes `TENTATIVE` with a warning, but does **not** exclude plain `UNAVAILABLE` at
  all — a player whose `Player.currentAvailability` is `UNAVAILABLE` is currently selected by
  automatic generation exactly like an `AVAILABLE` player. This is a second, adjacent, and
  separate residue from the one this record was originally opened for (a generation-engine
  eligibility gap, not a missing write path) — recorded here as an observation, **not fixed** in
  this pass, since it changes core selection-engine eligibility behaviour and needs its own
  explicit review and full selection-engine test coverage (AGENTS.md's "Testing requirements").
  It is precisely what makes the "SELECTED_PLAYER_UNAVAILABLE" Blocked condition possible to
  trigger through ordinary generation at all — the check exists as a safety net for exactly this
  gap, which may or may not be deliberate.
- A **third** independent read site for the round-scoped `Availability` model was found while
  verifying the fix below: `compute-plan-integrity.ts`'s own `buildPolicyInput()` call maps
  `p.availabilities` (an *unfiltered* relation covering every round the player has ever had a row
  for, not scoped to the current round despite being stamped with the current `matchRoundId`) into
  the default-policy/Rego evaluation input. In production this resolves to an empty array for the
  same reason as everywhere else (no rows exist), so it is currently inert, but it re-surfaced
  visibly while testing this fix against the documentation seed data (which, before also being
  fixed below, wrote directly into the round-scoped table) as an `unavailable_player_cannot_be_selected`
  policy-blocked signal. Not investigated further or changed in this pass — a different subsystem
  (compiled Wasm/Rego policy evaluation) with its own risk profile.

## Resolution

**Fixed** (2026-09-04, in the same session this record was opened, at the explicit request of the
repository owner once the finding was raised): `compute-plan-integrity.ts`'s two *current-round*
checks now read `Player.currentAvailability` directly instead of the round-scoped `Availability`
model:

- The dead `roundAvailabilities`/`playerAvailabilityMap` bulk query and the never-read
  `playerAvailabilityMap` variable were removed; `activePlayers`' own query now selects
  `currentAvailability`, and `availabilityMap` is built from it directly.
- `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`'s `kind` field was also corrected from `"BLOCKED"`
  to `"DECISION_REQUIRED"` (matching its own documented category in AGENTS.md, and matching what
  the Round Board page's own `warningSeverityMap` ruleCode override already assumed) — this signal
  was previously unreachable for the same reason, so the mislabeling had never been exercised;
  `integrity.summary.blockerCount`/`decisionRequiredCount` (which read `kind` directly, unlike the
  per-chip UI which already had the override) would otherwise have miscounted it now that it can
  actually fire.
- `scripts/seed-docs-scenarios.ts`'s `markAllAvailable()` helper (the Public Documentation
  Expansion Programme's own documentation dataset) was changed to set `Player.currentAvailability`
  instead of writing round-scoped `Availability` rows, matching the real production mechanism
  (D7 in that programme's `DECISIONS.md`: derived demo state should come from real owners) and
  removing the confusing third-read-site interaction noted above.
- Regression tests added: `src/lib/selection/__tests__/compute-plan-integrity.test.ts`'s new
  "live current-availability checks (ARR-0041)" describe block proves `SELECTED_PLAYER_UNAVAILABLE`
  fires for a `DRAFT`-selected player marked `UNAVAILABLE` with **zero** round-scoped `Availability`
  rows present, `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` fires as `DECISION_REQUIRED` for an
  available/unselected/eligible player, and it does not fire for an unavailable one.
- Full verification: `npx tsc --noEmit`, `npx eslint` on the changed files, and the complete
  `npm test` suite (`vitest run` + `vitest run --config vitest.config.components.ts`, 3630/212
  tests) all pass with no regressions — confirming this code path was previously never exercised
  by any existing test with real availability data.

**Not fixed, still open**: the *historical* half of this finding. `get-planning-period-fairness.ts`'s
"unavailable rounds excluded from fairness debt" rule, the `repeatedContext`
("Repeated missed planned opportunity") enrichment inside `compute-plan-integrity.ts` itself, and
the Insights readers (`opportunity-gap.ts`, `opportunity-matrix.ts`, `load-timeline.ts`) all still
depend on the same unpopulated round-scoped `Availability` model for *already-finalized* rounds,
where `Player.currentAvailability`'s single current value cannot substitute (it has moved on by
the time a season is reviewed). Fixing this needs a genuine historical-snapshot mechanism — the
natural fit is extending `ensureMatchPlanningBaselineCaptured()` (`capture-planning-baseline.ts`,
ADR-0109) to snapshot each relevant player's availability into the round-scoped model at the
moment a match's planning boundary closes, mirroring how it already captures selections and
movement-ledger state as the historical baseline — but that is a distinct, larger design decision
(what to snapshot, whether to backfill already-finalized historical rounds) not undertaken here.
The generation-engine eligibility gap (plain `UNAVAILABLE` not excluded) and the policy layer's
own unfiltered `p.availabilities` read are also both still open, as noted above.

## Containment

The public "Fair playing opportunity" and "Squad selection engine" deep pages
(`content/docs/how-matchboard-works/`) describe only the verified, currently-functioning
mechanism as of the fix above.

## Resolution criteria (remaining, historical half only)

Resolved when one of the following is true, confirmed by a passing regression test:

- A real production write path for round-scoped `Availability` exists for finalized rounds (e.g.,
  `ensureMatchPlanningBaselineCaptured()` snapshots each relevant player's `currentAvailability`
  into a per-round `Availability` row at boundary-closure time), and
  `get-planning-period-fairness.ts`'s "unavailable rounds excluded from fairness debt" rule is
  verified to actually exclude a round for a player with a real historical `UNAVAILABLE` row;
  **or**
- The round-scoped `Availability` model and its dependent "unavailable rounds excluded from
  fairness debt"/`repeatedContext` claims are deliberately retired, with AGENTS.md's "Season
  overview rules" and every affected reader updated to match, and the `Availability` Prisma
  model's fate (kept for historical/test use vs. removed) decided explicitly.

## Disposition

Partially resolved. The current-round live-check half was fixed, tested, and verified in this
session per the repository owner's explicit direction once this finding was raised. The
historical/season-fairness half, the generation-engine eligibility gap for plain `UNAVAILABLE`,
and the policy layer's own separate read of this model remain open, each requiring its own
explicit scoping decision rather than being folded into this fix.
