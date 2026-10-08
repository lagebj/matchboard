# ADR-0158: Retire the superseded convergence-bundle scope; deliver its League/Event, schema, and maintenance-gate residue

## Status

Accepted (programme — delivered incrementally; see "Delivery" below).

## Context

A product-owner-authored specification
(`.matchboard-work/matchboard_product_architecture_convergence_bundle/`, gitignored working
bundle — decisions normatively sourced from there, matching ADR-0152/ADR-0155/ADR-0156/ADR-0157's
own sourcing precedent) asked for an 11-slice "Matchboard Product and Architecture Convergence"
programme: remove the generic coach-facing Insights catalogue, restructure `More` into
Groups/Formations/Rules/Settings/Admin, move Season/History/Opponents under League, extend AI
into a typed five-layer `AnalysisFeature`/`AnalysisContext`/`AnalyticalInference` reasoning
contract, converge League/Event football policy, contract the schema, finish Touchline, and add
permanent maintenance gates (dead-code check, legacy-visual-dependency check, parity CI,
compatibility registry).

The bundle's reviewed baseline was commit `86b2631e3` (2026-09-27, ADR-0152 Slice 4b) — before
ADR-0154 (canonical tactical positions), ADR-0155 (development context and evidence), ADR-0156
(team season profile), and ADR-0157 (contextual coach workspace convergence) existed. By the time
this ADR was written (`main` at `3124f7f05`, 2026-10-08, ADR-0157 Slice C9 merged as PR #767), two
of those later-accepted ADRs had already delivered most of the same ground, with a materially
different and incompatible target shape:

- ADR-0157 Slice C8 already removed `More` from primary navigation entirely (`src/components/
  shell/nav-items.ts`), retired `/insights` and `/history` behind centrally-tracked, per-route
  redirects (`src/lib/insights/retired-insight-redirects.ts`,
  `docs/product/navigation-model.md`'s "Route disposition (post-More)" table), and moved
  Season/Opponents under League. This is not the bundle's own target shape — the bundle asks for
  `More` to be *retained* as a Groups/Formations/Rules/Settings/Admin destination; ADR-0157
  instead redirects `/more` straight to `/settings` with no destination page at all.
- ADR-0152 Slice 4 already shipped most of the bundle's Layer-5 AI-inference contract: the
  `analysisRole` enum (`SUPPORTED`/`CONTRADICTED`/`UNRESOLVED`/`SURPRISING`/`RECURRING_PATTERN`/
  `NEXT_FOCUS`/`EVIDENCE_GAP`), the `EVIDENCE_GAP`-only clarification round trip, and "no numeric
  confidence" — under contract v2's own shape, not the bundle's separate `AnalysisFeature`/
  `AnalysisContext`/`AnalyticalInference` types.
- ADR-0157's own knowledge model (Fact / Deterministic evidence / Coach observation / Assistant
  Coach hypothesis, plus the optional `DecisionEvidenceSupport` presentation metadata) is a
  different, already-accepted alternative to this bundle's five-layer model (Source fact / Coach
  evidence / Derived feature / Deterministic finding / AI inference). ADR-0157 explicitly locks
  "no second relevance system" and "no new database table" as non-goals for exactly this reason.

Repository inspection (run before writing this decision down, not assumed from either document)
confirmed the above, and also confirmed three bundle items this bundle specified that remain
genuinely undelivered and do not conflict with ADR-0157's shape:

- **League/Event shared football-policy parity.** ADR-0152 already converges most of League and
  Event onto one lifecycle/evidence vocabulary (`resolveLiveReportingPrimaryAction`,
  `checkNormalLiveEventGuard`, the guided-debrief service, `selectPreMatchExpectations`, all
  generic over `FootballMatchRef`/`DebriefReportRef`). The remaining asymmetries are already
  individually tracked — qualitative-evidence writing is League-only pending issue #691 (`Event`
  has no `teamId`-equivalent to key evidence off), the post-match-review context builder's
  `plan`/`playerContext`/`opponentHistory`/`recentTeamPatterns` sections are League-only pending
  issue #696 (same root cause), and Event has no Today/Match-Details lifecycle parity at all
  pending issue #686. No parity contract test suite exists asserting the scenarios in the
  bundle's `08-league-event-domain-convergence.md`/`15-acceptance-test-matrix.md` across both
  adapters.
- **`LeagueRoundParticipant.playerId` schema contraction.** ADR-0106 added this nullable column
  "for now", with an explicit scope decision that "only `GuestPlayer`s populate this table" and
  permanent `Player` round-participation stays on `Selection`/`Availability`. Mechanical
  verification (grep across `src/`, excluding generated Prisma output, and the migration history)
  found zero current writer and zero current reader of `LeagueRoundParticipant.playerId` anywhere
  in application code — only `guestPlayerId` is ever read or written. The field is retained solely
  for the hypothetical future consistency the bundle's `09-schema-data-contraction.md` says is not
  sufficient grounds for retention.
- **Maintenance gates.** No dead/unreferenced-code check (Knip or equivalent), no legacy-visual-
  dependency check, and no `docs/architecture/compatibility-registry.md` exist yet.

## Decision

### 1. The bundle's Insights/More/AI-contract scope (its Slices 1-5, and PAC-005/PAC-007/PAC-010
   as they relate to `More`'s target shape) is superseded by ADR-0157 and ADR-0152 and will not be
   implemented as separately specified. ADR-0157's four-class knowledge model and
   `DecisionEvidenceSupport` contract remain the one active evidence/relevance vocabulary; no
   parallel `AnalysisFeature`/`AnalysisContext`/`AnalyticalInference` contract is introduced. No
   further work restores `More`, a generic Insights hub, or a second IA convergence.

### 2. League/Event football-policy parity contract suite

Add a parity contract test suite asserting *equivalent football semantics* (not identical rows)
across the League and Event adapters for the scenarios already named in the bundle's acceptance
matrix: before kickoff, active period, break, resume, final period complete, finish live, report
available, long-running reconciliation, forgotten-period-start recovery, live event rejected
outside playable period, guest produces no persistent player evidence, qualitative evidence,
AI-context cutoff, and planned-versus-actual, run through the already-shared resolvers
(`resolveLiveReportingPrimaryAction`, `checkNormalLiveEventGuard`, the debrief service,
`selectPreMatchExpectations`).

Where League and Event genuinely do not yet converge (issues #691, #696, #686), the suite asserts
the *documented* asymmetry (Event's own degraded/`null` behaviour) rather than forcing a false
parity or inventing a Team-equivalent concept for Event — consistent with the bundle's own
instruction never to infer or default a Team for Event evidence scope. Resolving those issues
requires their own product/architecture decision (an explicit Event group-scope representation)
and is out of scope for this ADR.

### 3. Drop `LeagueRoundParticipant.playerId`

Remove the column (plus its now-meaningless `@@unique([matchRoundId, playerId])` index) and
replace ADR-0106's "for now" scope-decision language with an explicit statement that permanent
`Player` round-participation is `Selection`/`Availability`-owned, full stop — this table is
guest-only by construction, mirroring `LeagueMatchGuestAssignment`'s own guest-only design.
`player`/`guestPlayer` on the Prisma model, the Zod/TypeScript types, and any test fixture
asserting the old nullable shape are updated in the same change. This is additive-safe to deploy
(a column drop with zero current writer/reader) but still follows ADR-0105 migration discipline:
verify zero non-null production rows before the migration ships.

### 4. Permanent maintenance gates

- Add a maintained dead/unreferenced-code check (Knip) as `npm run deadcode:check`, with explicit
  entry points for Next.js routes, scripts, Prisma/config files, workers, tests, Playwright, and
  migrations/seeds/generated files, wired into `npm run validate`.
- Add a legacy-visual-dependency check that fails when active source or current docs introduce a
  reference to a removed Product Surface 1.0 identifier/import/wrapper, excluding historical
  ADR/archive content.
- Add `docs/architecture/compatibility-registry.md`, centralizing every still-retained
  compatibility redirect (the existing `/insights/*`, `/history`, `/more`, `/reviews`,
  `/formations` redirects ADR-0157 C8 already ships) with its canonical replacement, reason
  retained, implementation location, and removal condition — this registers what ADR-0157 already
  built; it does not create new redirects.

## Alternatives considered

- **Implement the bundle exactly as written, including its Insights/More/AI-contract scope.**
  Rejected: this would re-open and partially undo ADR-0157 Slice C8 (already merged, already the
  live production navigation) and introduce a second, competing evidence/AI-reasoning contract
  alongside ADR-0152's contract v2 and ADR-0157's `DecisionEvidenceSupport` — exactly the
  "duplicated domain behaviour" `architectural-residue-records` exists to prevent, created
  deliberately rather than found as residue.
- **Archive the bundle entirely and do nothing.** Rejected: it would leave genuinely real,
  non-conflicting gaps (League/Event parity test coverage, a speculative dead column, absent
  maintenance tooling) unaddressed merely because the bundle that first named them turned out to
  be mostly superseded.
- **Force League/Event parity now by inventing an Event Team-equivalent.** Rejected: the bundle
  itself prohibits inferring or defaulting a Team for Event evidence scope, and issues #691/#696
  already exist for this; manufacturing a boundary decision inside a parity-test PR would exceed
  this ADR's authority.

## Consequences

### Positive

- The repository stops carrying an actionable-looking but already-superseded 11-slice programme
  document as a live instruction; future agents reading the bundle's `IMPLEMENTATION_PROMPT.md`
  have this ADR to resolve the conflict without re-deriving it.
- A speculative, unused nullable column is removed rather than carried indefinitely.
- League/Event lifecycle/evidence parity gets its first explicit regression-proof contract suite.
- Dead-code and legacy-visual-dependency drift gets a permanent, low-noise check instead of relying
  on manual review.

### Negative

- Issues #691/#696/#686 (the genuine remaining League/Event asymmetries) are not resolved by this
  ADR — only documented and contract-tested as known, intentional asymmetry.

## Migration

Additive/contractive, not behaviour-changing for a coach: the `LeagueRoundParticipant.playerId`
drop follows ADR-0105 expand/contract discipline (verify zero non-null rows, then drop column and
index in one migration — no application code currently depends on the field's presence, so no
expand phase is required). No other schema change.

## Supersedes

Supersedes the Insights/More/AI-contract scope of the gitignored
`matchboard_product_architecture_convergence_bundle` working document (never itself an ADR) for
the reasons in "Context" above. Does not supersede ADR-0152, ADR-0157, or ADR-0106; it extends
ADR-0106's `LeagueRoundParticipant` scope decision from "for now" to permanent, and complements
ADR-0152/ADR-0157 by filling the residue they did not cover.

## Delivery

Delivered incrementally, one branch/PR/merge per slice (sequential-PR policy):

0. This ADR.
1. `LeagueRoundParticipant.playerId` schema contraction.
2. Maintenance gates: dead-code check, legacy-visual-dependency check, compatibility registry.
3. League/Event football-policy parity contract suite.

### History

#### 2026-10-08

Record created. Repository inspection performed before writing this decision down confirmed
ADR-0157 Slice C8 and ADR-0152 Slice 4 already deliver the bundle's Insights/More/AI-contract
scope under an incompatible target shape, and confirmed the three residual items (League/Event
parity tests, the dead `LeagueRoundParticipant.playerId` column, and the absent maintenance gates)
are genuinely undelivered and non-conflicting — reflected in "Context" above.
