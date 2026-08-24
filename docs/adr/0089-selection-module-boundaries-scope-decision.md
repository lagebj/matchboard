# ADR-0089: `generate-selection.ts` decomposition deferred; module boundaries elsewhere confirmed sound

## Status

Accepted

## Date

2026-08-24

## Decision owners

- Matchboard engineering

## Context

AIP-0's baseline investigation (Architecture Integrity Programme) found `src/lib/selection/`
mostly matches AGENTS.md's documented single-purpose-file architecture cleanly — no circular
imports, `npm run architecture:check` passes clean, `src/domain/team-composition/` has zero
overlap with `src/lib/selection/`. The one confirmed exception: `generate-selection.ts` is 1,529
lines with a single exported function, `generateSelection()`, whose body is ~1,430 lines — exactly
what AGENTS.md's "Selection architecture" section already warns against ("Do not grow a
monolithic `generate-selection.ts`"). A second, smaller, separate finding: `generate-round.ts`
had a 55-line inline helper (`selfSquadRepairBelowTarget`) duplicating a squad-repair concern
`resolve-round-support.ts` already owns.

AIP-4 attempted both fixes.

## Decision

### Fixed: relocate `selfSquadRepairBelowTarget`

Moved verbatim (zero logic changes) from `generate-round.ts` to `resolve-round-support.ts`,
exported, imported back into `generate-round.ts`. Confirmed via `npx tsc --noEmit`, `npm run
lint`, and the full `src/lib/selection/` test suite (251 tests, all passing unchanged) that this
introduced no behavior change.

### Deferred: `generateSelection()` decomposition

Read the function in full to find real phase boundaries before attempting extraction (per the
AIP-4 spec's requirement to verify candidate responsibility groups against actual code, not
assume them). Found genuine phase-shaped structure — context loading (~L100-455),
eligibility-filtering (~L456-655), core-overflow/match-drop resolution (~L657-747), rotation-
candidate scoring through final assembly (~L749-1529) — but the ~25+ local variables produced in
just the first phase (including at least one closure capturing further locals) are read by code
scattered across the *entire* remaining ~1,000 lines, not handed off cleanly at phase boundaries.
Extracting even the first phase into a named function would require threading a large context
object through essentially every line of the rest of the function — a high-touch-surface
mechanical change where one missed or mis-threaded reference silently changes selection output,
for a codebase with real coaches making real squad decisions from it.

**Decision: do not force this extraction now.** Per the AIP-4 spec itself ("Do not reorganize
`src/lib/selection/` only because it is large") and its acceptance criterion ("Selection behaviour
is unchanged except verified defects"), a decomposition whose main achievable outcome is moving
code around at meaningfully elevated regression risk, for a function that already delegates its
actual domain logic to ~11 separate, well-bounded collaborator modules (rotation eligibility,
fairness, explanation generation, conflict evaluation, etc. — verified via AIP-0's import-graph
analysis), does not clear the bar. The remaining ~1,400 lines are largely orchestration/glue
across those collaborators, which is inherently sequential and stateful — not idle code that
merely wasn't split up yet.

## Rationale

- The spec's own "required properties" are about *locatability and ownership*, not line count:
  "Domain rules have one owning implementation" and "Pure decision logic does not depend directly
  on Next.js request/runtime concerns" are both already true here — the domain rules live in the
  11 collaborator modules `generate-selection.ts` calls into, not duplicated inline.
- A safe decomposition needs a genuinely clean handoff of state between phases. This function does
  not have one at the granularity that would make extraction low-risk; forcing one anyway
  substitutes a real, working file for a file that merely looks smaller, at nonzero regression
  probability against production coach data.
- Declining to force a risky mechanical change under time/context pressure is the correct call per
  this repository's own standing instruction to prefer honest partial completion over guessing
  through a high-blast-radius change.

## Alternatives considered

### Force the extraction anyway, thread a context object through all ~1,000 lines

- Benefits: `generate-selection.ts` would be meaningfully shorter
- Costs: very high probability of introducing a subtle reference/ordering bug in core selection
  logic, for a codebase whose test suite (verified: 251 selection tests passing) exercises
  observable output, not necessarily every internal reference path a mechanical rename could
  silently break
- Reason not selected: the acceptance criterion is unchanged behavior, not smaller files

### Write extensive new characterization tests first, then attempt the extraction anyway

- Benefits: would reduce (not eliminate) the risk described above
- Costs: substantial additional scope beyond what AIP-4 budgeted for; the spec explicitly frames
  this as "smallest useful boundary changes," and writing a full characterization suite for a
  1,400-line function is a significant undertaking in its own right, better done as its own
  deliberately-scoped task with a fresh budget than folded into this pass under time pressure
- Reason not selected: not the smallest useful change; better as an explicit future task (see
  Consequences below) than attempted here

### Split into multiple files without extracting named phase functions (e.g. one file per rough section)

- Benefits: smaller files
- Costs: does not solve the actual problem (tightly-coupled mutable state across "sections");
  would just relocate the same tangle across file boundaries, adding import overhead without
  reducing coupling — explicitly what the spec's "Forbidden implementation style" section warns
  against ("abstraction layers that only rename")
- Reason not selected: files, not coupling, would be the only thing that changed

## Consequences

### Positive

- `generate-round.ts`'s misplaced squad-repair helper now lives with the concern it belongs to.
- No regression risk introduced into the core selection engine.
- This ADR gives the next person who looks at `generate-selection.ts`'s size the actual analysis
  instead of a bare "this is big" observation — including exactly where the state-threading
  problem is, so a future genuine attempt doesn't have to re-derive it.

### Negative

- `generate-selection.ts` remains 1,470ish lines with one large function. The stated AIP-4
  acceptance criterion "Round orchestration, movement, integrity, finalisation, and explanation
  ownership are easier to locate" is met at the *module* level (the 11 collaborators) but not
  fully at the *file* level for this one file.

### Risks and mitigations

- Risk: a future agent re-attempts the same extraction without reading this ADR, hits the same
  wall, and either gives up again (wasted effort) or forces it through and introduces a
  regression. Mitigation: this ADR, plus a short pointer comment could be added directly above
  `generateSelection()` if a future pass wants one — not added now to avoid the file drifting
  further from its current, verified-correct state for a comment-only change.
- Risk: the monolith grows further over time without this ADR's finding being revisited.
  Mitigation: `npm run architecture:check` already flags real dependency-direction violations; a
  future line-count or function-length lint rule scoped to `src/lib/selection/` would be a
  reasonable, low-risk follow-up if this becomes a recurring concern — not added here since it
  was not part of AIP-4's evidenced scope.

## Migration and compatibility

- No schema or data migration.
- No behavior change: `npx tsc --noEmit`, `npm run lint`, and the full `src/lib/selection/` test
  suite (251 tests) all pass unchanged before and after the one relocation made in this pass.
- Rollback: revert the two-file diff (`generate-round.ts`, `resolve-round-support.ts`); trivial,
  pure code movement.

## Related records

- ADRs: none directly related (this is the first ADR scoped to `src/lib/selection/`'s internal
  module boundaries specifically)
- Prior finding: AIP-0 baseline (F-004, `.matchboard-work/matchboard-architecture-integrity/state/FINDINGS.md`)
- Implementation: `src/lib/selection/generate-round.ts`, `src/lib/selection/resolve-round-support.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Record created. Architecture Integrity Programme AIP-4 (Selection module boundaries). Closes
AIP-0's F-004 finding: relocation done, full decomposition explicitly deferred with reasoning
rather than left as a silently-abandoned attempt.
