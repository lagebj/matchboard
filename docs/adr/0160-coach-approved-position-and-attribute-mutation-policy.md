# ADR-0160: Coach-Approved Primary-Position Changes and Materiality-Gated Attribute Mutations

## Status

Accepted

## Context

The Gate D (Player Intelligence) programme's source contracts
(`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`,
`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`) proposed a mutation/approval policy that
directly conflicts with two currently Accepted decisions:

1. **ADR-0139** (Evolving Player-Position Model) auto-promotes a player's primary position via
   `determineAutomaticPositionUpdate()`/`evolvePlayerPositionProfile()` inside
   `runPostMatchLearning()`, with no coach-approval step.
2. **ADR-0092** (Match Evidence Engine Domain Foundation) applies numeric attribute (1–10)
   changes automatically via its accumulator, gated only by its existing eligibility rules — no
   materiality/approval threshold exists, and its rebase mechanism (`Player.evidenceCutoverAt`)
   operates at player level, not per attribute.

Gate D's own source documents explicitly flagged both as "Existing repository tension (MUST
resolve before implementation)" and "deliberate reconciliation" items — pending decisions, not
residue from a decision already made (per this repository's `architectural-residue-records`
skill, which excludes "a decision that has not yet been made" from ARR treatment). The product
owner resolved both, plus the related position-vocabulary question, in conversation on
2026-11-23 (recorded in `docs/ui-lab/gate-d-w1-candidates/BLOCKERS.md` and PR #844). This ADR is
that decision's durable record, authored ahead of its implementation per the owner's explicit
instruction to record policy direction separately from fixture-driven UI Lab design work.

This is architecture-affecting: it changes an existing automatic-mutation trigger's authorization
boundary (ADR-0139, ADR-0092), and introduces a new domain concept (a reviewable position
proposal) partially resembling the `PlayerProfileSuggestion` subsystem ARR-0049 found dead and
deleted in 2026-09-14 — that subsystem was removed because an approval-gated shape conflicted
with the *then*-current "no redundant approval" principle. This ADR reverses that principle for
primary-position changes specifically; a future implementation should re-evaluate whether reviving
`PlayerProfileSuggestion`'s schema fits, rather than assuming it does unchanged, since ARR-0049's
removal reasoning no longer universally applies.

## Decision

### 1. Primary-position changes require explicit coach approval

The evidence engine may still identify a stronger candidate primary position using ADR-0139's
existing, unchanged computation (`computeEffectivePlayerPositionProfile()`,
`determineAutomaticPositionUpdate()`'s hysteresis gate — two-consecutive-snapshot margin
persistence is retained as the candidate-identification mechanism). It creates a **proposal**; it
must not apply that proposal automatically. `evolvePlayerPositionProfile()`'s direct write to
`Player.primaryPosition` for a primary-rank change is superseded by this ADR (its secondary/
tertiary write behavior is retained — see §2).

The coach must be able to review, before accepting or rejecting: the proposed position, its
supporting evidence, computed confidence, and the current (before) position. Accept/reject must
be audited (reusing `DecisionRecord`, consistent with ADR-0139's existing audit choice, unless
implementation finds a structural reason to differ — not decided here).

### 2. Secondary and tertiary positions remain automatic, with strengthened guardrails

Primary position requires explicit approval (§1); secondary and tertiary may still evolve
automatically, but under a stronger evidence standard than ADR-0139's original hysteresis gate
alone:

- At least three distinct completed matches with meaningful positional evidence.
- Computed confidence of at least 0.7.
- An evidence-supported ranking difference — not merely more minutes in one position.
- No change based on a single unusual assignment.
- No change when evidence is ambiguous or contradictory.
- No oscillation when scores are close: retain the current order absent a clear distinction.
- Full provenance preserved for every automatic secondary/tertiary change.

Coach-declared positions remain valid signals and must not be treated as lacking evidence merely
because the player has not yet played there in a recorded match; actual match experience can
introduce emerging positions, but playing somewhere is not by itself proof of competence (ADR-0139
and ADR-0092's existing "association is not ability" principle extends here unchanged).
Secondary/tertiary reordering must never indirectly change the primary position. A coach may
manually edit or lock positional preferences at any rank.

### 3. Historical auto-promotions are grandfathered

Existing `Player.primaryPosition` values produced by ADR-0139's original automatic behavior are
**not** reversed, rewritten, or retroactively required to pass this ADR's approval gate. This
policy applies prospectively from its effective date (the date this ADR's implementation ships,
not this ADR's acceptance date). Each player's primary position at cutover becomes the starting
value under the new policy. Existing historical provenance (`DecisionRecord` rows already created
by ADR-0139's automatic writes) is retained unchanged. If historical change provenance cannot be
fully reconstructed for a given player, that limitation must be recorded at implementation time,
not papered over with invented provenance.

### 4. Numeric attribute materiality policy (supersedes ADR-0092's automatic-always scope)

ADR-0092's 1–10 attribute scale, evidence accumulator, and proposal-generation logic are retained
unchanged. A new, distinct materiality/approval layer applies **after** proposal generation:

**Automatic adjustment is permitted only when every condition holds:**
- The proposed adjustment is no more than one point.
- Evidence comes from at least three distinct completed matches.
- Computed confidence is at least 0.7.
- The existing evidence engine's other eligibility rules pass.
- No active coach override or explicit lock prohibits automation.
- The change does not move the attribute more than one point from the last coach-established or
  coach-approved baseline.

**Coach approval is mandatory when:**
- The proposed change would move the attribute two or more points from that baseline, **including
  cumulative automatic changes** (materiality considers cumulative drift since the baseline, not
  only the current proposal's one-point-capped delta — ADR-0092's per-proposal cap does not by
  itself bound cumulative movement).
- The coach has explicitly locked the attribute.
- An applicable accepted policy requires human review.

Insufficient confidence or evidence must never trigger automatic approval-bypass; the result stays
unchanged while more evidence accumulates — a low-confidence proposal is not a license to apply it
anyway, nor to force a review that wasn't otherwise warranted. These thresholds (one-point
automatic cap, three-match minimum, 0.7 confidence, two-point cumulative approval trigger) are
initial policy values, not scientifically validated measures of player ability, and must be
centralized, versioned, and independently testable — not duplicated per call site, matching
ADR-0092's own "shared domain meaning has one owner" principle.

### 5. Manual edits rebase at attribute level, not player level

A manual coach edit to one attribute establishes a new authoritative baseline **for that attribute
only**. This changes ADR-0092's `Player.evidenceCutoverAt` semantics, which is currently a single
player-wide timestamp (§5 below flags this as a required, not-yet-implemented schema change).
Previous evidence and assessment history remain available for inspection but must not immediately
reverse the manual edit. Automation resumes for that attribute only after, post-edit:

- At least three distinct completed matches with relevant qualifying evidence.
- Confidence of at least 0.7.
- Existing proposal eligibility satisfied.
- No explicit coach lock on that attribute.

No arbitrary time-based expiry applies. Editing one attribute (e.g. Passing) must not reset or
affect the evidence progression of any other attribute (e.g. Speed, Positioning) — the current
player-wide cutover, if reused naively, would do exactly that, and must not be. The coach's
original value, edit timestamp, actor, evidence cutover point, and subsequent derived changes must
all be preserved. A locked attribute stays locked until explicitly unlocked by a coach.

### 6. 14-role player-profile projection (additive extension of ADR-0154)

Confirmed by the product owner as the adopted direction (2026-11-23, prior to this ADR). This does
**not** change ADR-0154's 24-code canonical tactical vocabulary, grid, or any tactical/formation/
live-reporting/actual-evidence surface — those remain exactly as ADR-0154 established. This adds
one new, additive, deterministic domain-level projection of those 24 codes for player-profile
contexts only (declarations, profile summaries, position-map dots, mutation proposals, Assistant
Coach profile-level language), per the mapping table in
`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`:

```
GK→GK  LB→LB  CB/LCB/RCB→CB  RB→RB  LWB→LWB  LDM/CDM/RDM→DM  RWB→RWB
LM→LM  LCM/CM/RCM→CM  RM→RM  LW→LW  LAM/CAM/RAM→AM  RW→RW  LCF/CF/RCF→F
```

A declared `CB` permits left, central, or right centre-back to be considered without demanding
three distinct declarations; equivalent for DM, CM, AM, F. The projection must not rewrite
canonical match evidence or tactical records — exact sided evidence remains inspectable. A
tactical match editor continues to distinguish all 24 canonical positions on its 5×6 grid; Player
Detail's profile surfaces use the 14 profile positions on their own, separate pitch rendering.
Primary-position proposals (§1) must target a profile role from this 14-value set — never a
sided/central tactical code (e.g. never `LCB` or `LAM`) as a declared primary. One central mapping
authority implements this projection; it must not be recreated independently in the frontend, AI
prompts, or selection engines.

## What this ADR does not do

This ADR records policy direction only. It does not itself change any schema, write path, or
service behavior — `sync-effective-position.ts`, `player-evidence-service.ts`,
`Player.evidenceCutoverAt`, and the 14-role projection module all remain exactly as they exist
today until separate, explicitly reviewed implementation work lands. In particular, this ADR does
not authorize an unrestricted production migration inside the Gate D UI Lab wave: a fixture-driven
UI Lab candidate may now be built to demonstrate this decided design (since the design question is
resolved), but it must not alter production mutation behavior, and must disclose that the
candidate demonstrates a decided-but-not-yet-implemented policy where that is the case.

## Alternatives considered

### Keep ADR-0139's auto-promotion and ADR-0092's automatic-always attribute application unchanged

- Benefits: zero migration cost, matches current, already-shipped, regression-tested behavior.
- Costs: contradicts the explicit product-owner decision recorded here; leaves the "false
  confidence" risk the Gate D source contracts raised for positions and for attribute drift.
- Reason not selected: the owner explicitly decided otherwise, citing the need for one coherent
  reviewable policy across position and attribute mutation.

### Resurrect `PlayerProfileSuggestion` (ARR-0049) verbatim as the proposal mechanism

- Benefits: an approval-gated PENDING→ACCEPT/ADJUST/REJECT shape already existed in this exact
  domain; less design-from-scratch.
- Costs: it was deleted after a zero-row preflight confirmed it was entirely dead, and ARR-0049's
  removal reasoning does not automatically still hold just because an approval gate is now wanted
  again — its original design may not fit the evidence/confidence/before-after presentation this
  ADR requires, or current schema conventions.
- Reason not selected: not rejected outright, but explicitly deferred to implementation-time
  evaluation rather than assumed here — this ADR records the policy, not the exact persistence
  shape.

### A time-based expiry for post-manual-edit automation resumption (§5)

- Benefits: simpler to implement than an evidence-volume gate.
- Costs: an attribute with little subsequent match evidence would resume automatic adjustment on a
  clock even without real new evidence, reintroducing the "sparse evidence as false confidence"
  risk the Gate D programme is explicitly trying to avoid.
- Reason not selected: explicitly rejected by the product owner ("Do not use an arbitrary
  time-based expiry").

### Player-wide (not attribute-level) rebase, reusing `evidenceCutoverAt` as-is

- Benefits: no schema change required.
- Costs: editing one attribute would silently reset or affect the evidence progression of
  unrelated attributes — exactly the defect this ADR's §5 exists to prevent.
- Reason not selected: explicitly rejected by the product owner; flagged as a required (not yet
  implemented) schema change instead.

## Consequences

### Positive

- One coherent, auditable policy spans position and attribute mutation, closing the gap the Gate D
  source contracts identified between the original "fully automatic" architecture and the
  product's actual risk tolerance for false confidence in player assessment.
- Coaches gain a genuine review point for the highest-stakes change (primary position, material
  attribute drift) while routine, well-evidenced changes (secondary/tertiary, sub-material
  attribute movement) remain frictionless, preserving ADR-0139/ADR-0092's original "no new UI
  friction for normal evidence-backed change" benefit where the evidence is least consequential.
- Grandfathering avoids retroactively destabilizing already-correct historical primary positions
  or fabricating provenance that was never recorded.

### Negative

- Requires new implementation work this ADR explicitly does not perform: a proposal/review
  persistence mechanism for primary-position changes, a materiality/cumulative-drift calculation
  layered onto the existing attribute accumulator, and a schema change moving attribute rebase
  from player-level to attribute-level.
- Two previously fully "derive on read, nothing pending" engines (ADR-0139, ADR-0092) now need a
  genuinely pending, reviewable state for their highest-stakes mutations — a new kind of state this
  codebase's evidence modules did not previously need to carry.
- `ARR-0049`'s "no approval queue replaces the deleted subsystem" closing statement is now
  partially stale for primary-position changes specifically; this ADR's existence is the record of
  that change, not a silent reopening of ARR-0049.

### Risks and mitigations

- **Reintroducing dead-approval-queue theater** (the exact failure mode ADR-0139 originally
  avoided by not building on `PlayerProfileSuggestion`). Mitigated by requiring the proposal
  mechanism's design to be evaluated at implementation time against this ADR's actual
  before/after/evidence/confidence review requirements, not assumed to be a drop-in revival.
- **Cumulative-drift gaming** (many small automatic one-point changes evading the two-point
  approval trigger one at a time). Mitigated by §4's explicit requirement that materiality
  consider cumulative change since the last coach-established/approved baseline, not merely the
  current proposal's capped delta.
- **Attribute-level rebase implemented incorrectly, reusing the player-wide cutover naively.**
  Mitigated by this ADR explicitly naming the exact defect to avoid (§5) ahead of implementation,
  rather than discovering it during code review.

## Migration and compatibility

- No schema change is made by this ADR. Required future schema work (not authorized here as
  production migration, only recorded as a known follow-up): per-attribute rebase tracking
  replacing or extending the player-wide `Player.evidenceCutoverAt`; a persistence shape for
  pending primary-position proposals (evaluate, don't assume, `PlayerProfileSuggestion`'s former
  shape).
- No historical data is rewritten. Grandfathering (§3) is itself the migration strategy for
  already-decided primary positions.
- `determineAutomaticPositionUpdate()`'s hysteresis computation, `computeEffectivePlayerPositionProfile()`,
  ADR-0092's evidence accumulator, vocabulary, and provenance model are all retained unchanged —
  this ADR changes authorization/write behavior on top of them, not the underlying evidence
  computation.

## Security and operations

- No new authorization surface is introduced by this ADR itself. Once implemented, the
  coach-approval action for a position or attribute proposal must run under the same tenant-scoped,
  authenticated paths every other coach mutation already uses — no new externally-triggerable
  endpoint, no bypass of existing deny-by-default authorization.
- A position or attribute proposal pending approval must not block `runPostMatchLearning()` or any
  other learning-pipeline step for any player — matching ADR-0139's existing try/catch-isolated,
  never-blocks-another-step convention.

## Related records

- **Supersedes (in part)**: ADR-0139 — primary-position automatic write behavior only; its
  candidate-identification computation (`computeEffectivePlayerPositionProfile`,
  `determineAutomaticPositionUpdate`) and secondary/tertiary write path are retained. ADR-0092 —
  automatic-always attribute-mutation scope and player-wide rebase granularity only; its
  vocabulary, accumulator, provenance model, and `AssessmentChange` audit mechanism are retained.
- **Extends (additive, non-superseding)**: ADR-0154 — adds the 14-role profile projection as a new
  derived view; the 24-code canonical tactical vocabulary, grid, and every tactical/formation/
  live-reporting surface are unchanged.
- **Source**: Gate D (Player Intelligence) programme, product-owner decision recorded 2026-11-23 in
  `docs/ui-lab/gate-d-w1-candidates/BLOCKERS.md` and PR #844.
- **ARRs**: ARR-0049 (deleted `PlayerProfileSuggestion` subsystem) — its removal reasoning is
  partially superseded for primary-position changes specifically; see "Alternatives considered"
  above. Not reopened or reversed as an ARR; this ADR is the new decision record.
- **Security findings**: None.
- **Issues or plans**: Gate D Wave 1 (PR #844) — UI Lab candidates demonstrating this decision;
  separate, not-yet-filed implementation work for the schema/service changes this ADR names as
  required follow-up.

## Implementation evidence

None yet. This ADR precedes its own implementation, per the product owner's explicit instruction
to record the ADR amendment and any required schema or service changes separately from Gate D's
fixture-driven UI Lab design work. This section will be updated once that implementation lands.

## Supersedes

ADR-0139 (in part — see "Related records"); ADR-0092 (in part — see "Related records").

## Superseded by

None.

## History

### 2026-11-23

Record created from the Gate D Player Intelligence programme's product-owner decision, resolving
two authority conflicts the programme's source contracts had explicitly flagged as unresolved
(see `docs/ui-lab/gate-d-w1-candidates/SOURCE_RECONCILIATION.md` §4 and §4b), plus the related
14-role profile-projection direction. No implementation performed as part of this record.
