# Gate C W3 — Data Truth and Fixtures

## C07 fixtures

`src/app/dev/ui-lab/gate-c/w3-shared/fixtures.ts` is this wave's **own** shared fixture
directory — deliberately not a reuse of W1's `gate-c/shared/` or W2's `gate-c/w2-shared/`, per the
issue #827 lesson (a shared-fixture-file edit silently invalidated prior waves' Visual Authority
approvals via content-hash fingerprinting).

`gateCW3DecisionDayFacts()` builds one genuine decision-day Today (one real
`AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` signal, one matching `CoachDecision` in the
projection so it resolves as the primary action) — reused, unmodified, by all five C07 scenarios.
The ON hypothesis (`alexOpportunityHypothesis`) is a fully-cited `AssistantCoachHypothesisViewModel`
with real-shaped supporting refs and disclosed missing evidence, following the real contract
`AssistantCoachHypothesisPanel` already consumes on Player Detail.

Every scenario's `fixtureSha256` is independently recomputed from its own `rawRecordsForHash` in
its `__tests__/fixtures.test.ts` — never hand-copied.

## C08 fixtures (A/B/C only)

`gateCW3QuickAddFacts(recommendation: "open" | "tentative" | "none")` in the same shared file
builds a `TodaySelectionDecision` restricted to shapes the real planner
(`today-selection-recommendation-plan.ts`) can actually produce — confirmed against that module's
logic and the real-DB tests in `today/__tests__/actions.test.ts`, not invented:

- `"open"` → `AVAILABLE`, `directlyActionable: true`.
- `"tentative"` → `TENTATIVE`; the real planner's `eligible` check requires availability to be
  exactly `"AVAILABLE"`, so this always degrades, with the real `unavailableReason` string copied
  verbatim.
- `"none"` → no viable open destination; `recommendation` itself is `null` (the real shape when
  `resolveTarget()` finds no open candidate), not a fabricated degraded object.

C08-D/E have no fixture file — `AddPlayerDialog` self-fetches its candidate lists via real Server
Actions and cannot be meaningfully mounted against static props (see `BLOCKERS.md`). Their
evidence is the real-DB integration tests in `league-match-guest-actions.test.ts` and the
pre-existing `match-helper-actions.test.ts`, run against `setupTestDb()`/`seedTestFixture()` — a
real, disposable Postgres database, real domain functions, no mocks on the mutation layer itself.

## "After RSVP" disclosure (C08-B)

Matchboard has no automated RSVP-deadline mechanism in source. `AvailabilityStatus`/
`PlannedAbsenceReason.NO_RSVP` are manually coach-selected categories, not a deadline computation
— confirmed by direct grep and by Gate A's own prior disclosure for A09
(`docs/ui-lab/gate-a-w3-candidates/BLOCKERS.md`: "Matchboard has no automated RSVP/deadline-driven
decline mechanism in source..."). C08-B is therefore built against the real mechanism that
exists — a `TENTATIVE` `Player.currentAvailability` — not a fabricated deadline.
