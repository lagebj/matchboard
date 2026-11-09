# Gate C W1 — Data Truth and Fixtures

All fixtures live under `src/app/dev/ui-lab/gate-c/` and are built directly against the real
production type contracts (`AssistantCommandCentre`, `CoachSituationProjection`,
`PlanIntegritySignal`, `TodaySelectionDecision`, `AssistantWorkItem`, `TodayMatchdayContext`,
`TodayMatchdayReadiness`, `TodayLiveNowResult`) — not ad hoc objects shaped only to look right
visually. `npm run typecheck` verifies every fixture against these real types.

## One canonical source per fixture fact

- **C01 (quiet day)** — empty projection decisions, no `matchdayContext`, no due reviews. This
  genuinely drives `selectTodayComposition()` to `"QUIET"`; the composition is not hand-set.
- **C02 (decision day)** — one real top `CoachDecision` whose `candidateId` resolves (via
  `idempotencyKeyFromCandidateId()`, the real production id-mapping function) to a real
  `PlanIntegritySignal` in `roundPlanIntegrities`. Three further genuine secondary candidates
  exist across all three secondary sources (one `TodaySelectionDecision`, one second-round
  `PlanIntegritySignal`, one `AssistantWorkItem`) so the real `MAX_DECISION_DAY_SECONDARY_ITEMS =
  2` cap genuinely drops the third, rather than three screenshots of a hand-picked two-item look.
- **C03 (matchday pre-live)** — `gateCBuildMatchdayContext()`
  (`src/app/dev/ui-lab/gate-c/shared/fixtures.ts`) computes kickoff as a real offset from
  `Date.now()` at request time (180/80/20 minutes for PREPARE/VERIFY/IMMINENT), comfortably
  clear of `resolveTodayMatchdayPhase()`'s real 120/45-minute thresholds. `TodaySurface` itself
  computes `nowIso` internally (it is the real, unmodified production composition owner, and
  this wave does not change that) — an offset from the real current time is the only way to
  genuinely and permanently cross those thresholds without the fixture drifting into the wrong
  phase as real time passes. Readiness varies by phase (drafted squad/no lineup → ready squad
  with one doubtful player → everything ready) so each phase produces a different, real primary
  action via `resolveTodayMatchdayAction()`'s own fixed priority order, not three identical
  actions with a different label.

## Valid League/Event match identities

C03's League fixture uses `source: "LEAGUE"`, a round container, and `/matches/...` hrefs. Its
Event fixture uses `source: "EVENT"`, an event container, `venueLabel: null` (no home/away
concept), and `/events/.../matches/.../live` hrefs — both built from the one real
`TodayFootballMatch` contract (`today-football-match.ts`), not two parallel ad hoc shapes.

## Correct player availability and plan-integrity signals

C02's secondary selection decision and planning-attention signal use real `ruleCode` values
(`AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`-equivalent problem framing via
`TodaySelectionDecision`, and `DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE` respectively) —
not invented categories. C03's VERIFY phase uses a real `SelectedPlayerAvailabilityState:
"DOUBTFUL"` affected player, driving the real `DOUBTFUL_PLAYER` branch of
`resolveTodayMatchdayAction()`.

## No invented coaching observations or AI conclusions

No fixture in this wave includes a coach observation or an Assistant Coach hypothesis — see
`THREE_PART_EXPERIENCE_CONTRACT.md` for why that is correct, not an omission.

## Tactics readiness

Every C03 fixture sets `tactics.state: "UNKNOWN"` for both League and Event, deliberately — there
is no canonical, distinctly-persisted tactics record in the domain model to invent a value from
(D7), and Event has no tactics data source at all. This means `resolveTodayMatchdayAction()`'s
`MISSING_TACTICS` branch is not exercised by this wave's fixtures; that is an accepted, disclosed
gap, not a defect (see `BLOCKERS.md`).

## Internal consistency and determinism

`gateCBaseCommandCentre()` and the shared matchday builder are the one place each fixture's base
facts are constructed, reused by every scenario rather than duplicated. `GATE_C_FIXTURE_COMPUTED_AT`
is a fixed, deterministic timestamp for everything that is not kickoff-relative. No
scenario reads real `Math.random()` or non-deterministic input.

## Scenario isolation

None of C01-C03's fixtures write to browser storage, and the pages render from static,
request-independent fixture data only (no server action, no database). The one place Today's
production components read `localStorage` at all — `TodaySelectionDecisions`'s per-decision
dismissal state — is keyed by a `scope` prop this wave does not set (it defaults to
`"default"`, the same as production when no scope is supplied); since no interaction test in
this wave exercises dismissal, no scenario depends on, or mutates, that state. Each Playwright
test already gets its own fresh, isolated browser context by default, so even that shared key
poses no real cross-scenario risk in this wave's actual coverage.
