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

**Follow-up (2026-09-07), separate defect in the now-reachable code path**: once
`AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` actually started firing in production, it fired for
*every* available, unassigned, active player in the organisation — including players whose core
team has no match in the round at all — because section 4's candidate set was the whole
organisation roster, not the players whose core team is actually playing. `compute-plan-integrity.ts`
now gates that candidate set on `Player.coreTeamId` being one of the round's non-cancelled match
teams (Round Board visibility is a planning pool, not an obligation — AGENTS.md "Decision required
conditions"). The Weekly Coaching Context loader (`get-weekly-coaching-context.ts`) also now
resolves a display name for each such `playerId` (the signal carries only the id) and drops any
that do not resolve, fixing a broken "· · · +N more" render on Today's "Carries into next round"
and the Round Board carry-forward panel. Regression tests: `compute-plan-integrity.test.ts`'s new
"missing opportunity requires a core-team fixture" block, `get-weekly-coaching-context.test.ts`'s
two new opportunity-resolution tests, and `weekly-coaching-context-section.test.tsx`.

**Historical half — resolved by ADR-0121 (2026-09-07).** The design anticipated here (extend
`ensureMatchPlanningBaselineCaptured()` / `finalizeRoundRecord()` to snapshot each relevant
player's availability into the round-scoped `Availability` model at boundary-closure time) was
implemented: `captureRoundAvailabilitySnapshot()` in `round-finalization-transitions.ts` writes
the frozen rows, `getRoundAvailabilityResolver()` (`src/lib/selection/round-availability.ts`)
reads snapshot-for-FINALIZED / live-for-open / `NO_HISTORICAL_DATA`-for-pre-feature, and
`compute-plan-integrity.ts` §2/§4 resolve through it. `get-planning-period-fairness.ts`,
`repeatedContext`, and the Insights readers (`opportunity-gap.ts`, `opportunity-matrix.ts`,
`load-timeline.ts`) needed no code change — they already queried the model and simply begin
receiving real data. `scripts/backfill-round-availability.ts` (opt-in) recovers the provable
subset for rounds finalized before ADR-0121.

**Still open**: the generation-engine eligibility gap (plain `UNAVAILABLE` not excluded by
`selection-eligibility.ts`) and the policy layer's own unfiltered `p.availabilities` read — both
distinct smaller findings, not covered by ADR-0121.

## Containment

The public "Fair playing opportunity" and "Squad selection engine" deep pages
(`content/docs/how-matchboard-works/`) describe only the verified, currently-functioning
mechanism as of the fix above.

## Resolution criteria (met by ADR-0121)

The first option below was taken. Confirmed by regression tests in
`src/lib/selection/__tests__/round-availability.test.ts`,
`src/lib/selection/__tests__/capture-planning-baseline.test.ts` (snapshot written on round
finalize, immutable, cleared on reschedule-reopen), and
`src/lib/selection/__tests__/compute-plan-integrity.test.ts` (a FINALIZED round is judged
against the captured value, not a since-changed current one; a pre-ADR-0121 FINALIZED round
asserts nothing).

- ✅ A real production write path for round-scoped `Availability` exists for finalized rounds
  (`finalizeRoundRecord()` snapshots each relevant player's `currentAvailability` at
  boundary-closure time), and `get-planning-period-fairness.ts`'s "unavailable rounds excluded
  from fairness debt" rule now operates on real historical rows.
- (Not taken) retiring the model.

## Remaining open findings (own scoping decisions, not this ARR)

- Generation-engine eligibility gap: `selection-eligibility.ts` does not exclude a plain
  `UNAVAILABLE` player.
- Policy layer reads `p.availabilities` unfiltered in `compute-plan-integrity.ts`'s policy block.

## Disposition

Substantially resolved.

- **Current-round live-check half** — fixed, tested, verified (2026-09-04); see the "Fixed"
  section above.
- **Historical / season-fairness half** — resolved by **ADR-0121** (2026-09-07): the round-scoped
  `Availability` model now has a real production writer. `finalizeRoundRecord()`
  (`round-finalization-transitions.ts`) freezes a per-round availability snapshot when a round's
  planning boundary closes; `getRoundAvailabilityResolver()` (`src/lib/selection/round-availability.ts`)
  reads the frozen snapshot for a `FINALIZED` round and the live `Player.currentAvailability` for
  an open one; a round finalized before ADR-0121 (no snapshot) resolves `NO_HISTORICAL_DATA` and
  every reader asserts nothing rather than guessing. `compute-plan-integrity.ts` §2/§4 and its
  `repeatedContext` enrichment, `get-planning-period-fairness.ts`, and the Insights
  `opportunity-*`/`load-timeline` readers all now receive correct historical availability (the
  latter needed no code change — they already queried the model). `scripts/backfill-round-availability.ts`
  (`npm run backfill:round-availability`, opt-in) recovers the provable subset for pre-ADR-0121
  finalized rounds.
- **Still open** — the generation-engine eligibility gap for plain `UNAVAILABLE` (not excluded by
  `selection-eligibility.ts`), and the policy layer's own separate unfiltered `p.availabilities`
  read. Each is a distinct, smaller finding with its own scoping decision, not folded into
  ADR-0121.
