# ADR-0088: Plan -> Run -> Learn phase-boundary transitions get one owning function per boundary

## Status

Accepted

## Date

2026-08-24

## Decision owners

- Matchboard engineering

## Context

ARR-0028 (Architecture Integrity Programme, AIP-0 baseline) found that Matchboard's three
lifecycle phase boundaries — Plan finalize/un-finalize, and the Run -> Learn handoff to the
first DRAFT post-match report — were each reimplemented independently at multiple call sites
instead of owned by one function per boundary, violating AGENTS.md's "one business operation,
one owning implementation, multiple adapters" invariant:

1. `MatchRound.status` DRAFT<->FINALIZED was written by four independent functions
   (`finalizeMatchRound`, `finalizeSingleMatch`, `unfinalizeMatchRound`, `unfinalizeSingleMatch`),
   each reimplementing the same Prisma writes rather than sharing them.
2. The Run -> Learn handoff (first DRAFT post-match report) had two independent implementations:
   `seedReportFromFinalizedSquad()` (direct post-match entry, seeds `UNKNOWN` attendance) and an
   inline reimplementation inside the `endLiveSessionAndCreateReportAction` server action (seeds
   `PRESENT` attendance, derives goals/assists/fair-play/rotations from `LiveMatchEvent` rows).
3. `endLiveSessionAndCreateReportAction` also wrote `LiveMatchSession.status = "ENDED"` inline
   instead of calling the existing `endLiveSession()` function.

AIP-3's own re-verification found the identical pattern (2) and (3) on the Event side too
(`endEventLiveSessionAndCreateReportAction`, not evidenced in ARR-0028's original scope but the
same root cause), and confirmed (1)'s four writers really do duplicate literal, byte-identical
Prisma calls (not just similar-looking ones) for the fields `finalizeMatchRound`/
`finalizeSingleMatch` and `unfinalizeMatchRound`/`unfinalizeSingleMatch` share.

Two of these three findings are **not** a case of "delete the duplicate" — round-level and
per-match finalize/un-finalize are genuinely distinct product operations at different
granularity (AGENTS.md's "Per-match and round finalization" section describes both as
intentional capabilities), and `seedReportFromFinalizedSquad`/the live-session seeding are two
legitimate strategies for the same transition, not two implementations of the same one. Merging
either pair into a single function would be wrong. The residue is the *reimplementation of shared
writes*, not the existence of two callers.

## Decision

### Plan phase: shared write primitives, not shared orchestration

`src/lib/selection/round-finalization-transitions.ts` is the one place the literal Prisma writes
for "a set of selections becomes FINALIZED/reverts to DRAFT" and "a round record becomes
FINALIZED/reverts to DRAFT" are decided:

- `finalizeSelectionsForScope(tx, scope, ...)` / `unfinalizeSelectionsForScope(client, scope, ...)`
  — `scope` is `{ matchRoundId }` or `{ matchId }`, letting one function serve both the
  round-level and per-match callers.
- `finalizeRoundRecord(tx, matchRoundId, rulesId, currentRuleConfigVersion)` /
  `unfinalizeRoundRecord(client, matchRoundId)` — the literal `MatchRound.status` write plus (for
  finalize) the `RuleConfig.version` bump that always accompanies it.

`finalizeMatchRound()`/`unfinalizeMatchRound()` call these unconditionally for their round-wide
scope. `finalizeSingleMatch()`/`unfinalizeSingleMatch()` call the selection-scope functions for
their match-wide scope, then call the round-record functions only when their match was the
round's last DRAFT/FINALIZED one (auto-finalize / auto-revert side effect) — same functions,
different callers, no reimplementation. Orchestration (validation, plan-integrity checks,
override-reason handling, response shape) stays in each of the four existing functions, which is
exactly right: they answer different questions ("is this one match blocked?" vs "is this whole
round blocked?") and should not be merged.

### Run -> Learn handoff: shared domain module per report family, not shared across League/Event

`seedReportFromLiveSession()` (League, in `src/lib/reports/report-mutations.ts`, alongside
`seedReportFromFinalizedSquad`) and `seedEventReportFromLiveSession()` (Event, in the new
`src/lib/reports/event-report-mutations.ts`) are the owning implementations for "derive a DRAFT
report from a just-ended live session's recorded events." Both were extracted verbatim out of
their respective server actions (`live-report-handoff.ts`, `event-live-report-handoff.ts`), which
are now thin adapters: validate session/match/organisation consistency for their specific entry
point, then delegate.

League and Event report seeding are **not** merged into one function — they operate on different
schemas (`PostMatchReport`/`playerActuals` vs `EventPostMatchReport`/`playerReports`,
`homeGoals`/`awayGoals` vs `ourScore`/`opponentScore`) per AGENTS.md's explicit League/Event
product separation. Each domain gets its own owning function; the fix is moving business logic
out of "use server" action files into the domain layer, not cross-domain merging.

### Session-end write: always through the owning session function

`endLiveSessionAndCreateReportAction` now calls `endLiveSession()`
(`src/lib/live-match/live-match-session.ts`) instead of an inline
`db.liveMatchSession.update(...)`. `endEventLiveSessionAndCreateReportAction` now calls the
pre-existing `endEventLiveSession()` (`src/lib/live-match/event-live-match-session.ts`) the same
way — it already existed but was never used by this call site.

## Rationale

- A shared low-level write primitive with a scope parameter (`{ matchRoundId } | { matchId }`)
  is the minimal fix that eliminates literal duplication without forcing two genuinely different
  product operations (round-level vs per-match finalize) into one function with branching
  behavior — which the AIP-3 spec's implementation bias explicitly steers away from ("prefer pure
  transition validation and explicit application services over a generic state-machine library").
- Extracting report-seeding logic into the domain layer directly enforces AGENTS.md's own stated
  invariant ("routes, server actions... must not independently implement common domain
  behaviour") rather than merely documenting it — the violation was concrete and mechanical
  (150+ lines of derivation/creation logic living in a `"use server"` file), not a matter of
  interpretation.
- Reusing `endLiveSession()`/`endEventLiveSession()` instead of reimplementing their one write
  removes a second, independent source of truth for "what does ending a live session mean" — a
  future change to session-end semantics (e.g. a new audit call, a new validation) now only needs
  to change one function per domain to apply everywhere that domain ends a session.

## Alternatives considered

### Merge finalizeMatchRound/finalizeSingleMatch (and their un-finalize counterparts) into one function with a mode flag

- Benefits: fewer files
- Costs: the AIP-3 spec explicitly warns against this shape ("not a generic state-machine
  library"); a mode-flag function conflates two different validation scopes (round-wide vs
  match-wide plan-integrity checks) and two different response shapes, making both harder to
  read than two callers sharing primitives
- Reason not selected: distinct callers over shared primitives, not one caller with branches

### Merge League and Event report seeding into one cross-domain function

- Benefits: further reduces file count
- Costs: League and Event reports have different schemas, different field names, and are a
  deliberate product separation per AGENTS.md — a shared function would need to abstract over
  incompatible data shapes for no real benefit, and would couple two domains AGENTS.md keeps
  intentionally independent
- Reason not selected: one owning function per domain, matching the existing League/Event
  boundary elsewhere in the codebase

### Leave the Event-side duplication for a later phase

- Benefits: smaller diff, matches ARR-0028's originally-evidenced (League-only) scope exactly
- Costs: the identical bug pattern on the Event side would remain unrecorded/unfixed despite
  being found during this same investigation; AIP-3's mission explicitly spans "live match
  operation" for both domains
- Reason not selected: the fix is the same narrow pattern already being applied to League; fixing
  it consistently is cheaper than deferring and re-discovering it later. The Event-side **report
  completion** (DRAFT->REPORTED->LOCKED) duplication found during this investigation is a
  separate, larger finding — see ARR-0030 — and *is* deferred, since it requires understanding a
  full state-machine (not just a seeding strategy) that the League side already centralizes in
  `report-domain.ts` and the Event side does not.

## Consequences

### Positive

- Four independent `MatchRound.status` writers reduced to two shared primitive functions plus
  their four (still-distinct, still-necessary) orchestrating callers.
- Two independent DRAFT-report-creation implementations per domain (League, Event) reduced to one
  owning function per domain, called from a thin server-action adapter.
- `endLiveSession()`/`endEventLiveSession()` are now actually used by every code path that ends a
  session in their domain.
- New tests (`round-finalization-transitions.test.ts`, `report-mutations.test.ts`) directly
  assert field-level parity between round-level and per-match finalize/un-finalize, and between
  the two report-seeding strategies' required-field/valid-enum invariants.

### Negative

- `seedReportFromLiveSession`/`seedEventReportFromLiveSession` now live in the domain layer with
  a `organisationId` parameter the caller must have already validated — slightly more implicit
  trust than re-deriving it internally, documented explicitly in each function's docstring.

### Risks and mitigations

- Risk: a future new finalize/un-finalize entry point (e.g. a bulk-finalize action) reimplements
  the writes again instead of calling the shared primitives. Mitigation: ARR-0028's containment
  section (still active) explicitly forbids this; the primitives are the obvious/only place to
  look given the module name and docstrings.
- Risk: the Event-side report-completion duplication (ARR-0030, deferred) diverges further before
  it's addressed. Mitigation: recorded explicitly rather than silently left as an unrecorded
  observation from this investigation.

## Migration and compatibility

- No schema or data migration required — this is application-layer restructuring only, preserving
  every existing external behavior and response shape.
- Existing tests (`finalize-single-match.test.ts`, `unfinalize.test.ts`,
  `finalize-match-round-idempotency.test.ts`, `match-helper-actions.test.ts`,
  `league-live-match-client.test.tsx`) all pass unchanged, confirming no behavior change.
- New tests: `src/lib/selection/__tests__/round-finalization-transitions.test.ts`,
  `src/lib/reports/__tests__/report-mutations.test.ts`.
- Rollback: revert the four selection files, `live-report-handoff.ts`,
  `event-live-report-handoff.ts`, and delete `round-finalization-transitions.ts`/
  `event-report-mutations.ts` — each reverted file is independently self-contained again exactly
  as before.

## Related records

- ADRs: ADR-0083 (MatchRound.status enum — establishes the two-value persistence rule this ADR's
  shared writers respect), ADR-0086 (live match realtime — the Neon-vs-Durable-Object dual
  tracking of live-session end state remains a separate, deliberate design, not touched here)
- ARRs: ARR-0028 (resolved by this ADR), ARR-0030 (Event report-completion duplication, discovered
  during this investigation, explicitly deferred — not resolved by this ADR)
- Implementation: `src/lib/selection/round-finalization-transitions.ts`,
  `src/lib/selection/finalize-match-round.ts`, `finalize-single-match.ts`,
  `unfinalize-match-round.ts`, `unfinalize-single-match.ts`, `src/lib/reports/report-mutations.ts`
  (`seedReportFromLiveSession`), `src/lib/reports/event-report-mutations.ts` (new),
  `src/app/(app)/matches/[matchId]/live/live-report-handoff.ts`,
  `src/app/(app)/events/[eventId]/event-live-report-handoff.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Record created. Architecture Integrity Programme AIP-3 (Lifecycle contract). Resolves ARR-0028.
