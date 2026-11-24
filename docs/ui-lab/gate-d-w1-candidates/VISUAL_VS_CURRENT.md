# Gate D W1 — Visual vs. Current

What already exists in production, what this wave's candidates demonstrate, and — for D01 — a
disclosed mismatch between the register's acceptance question and the current accepted
architecture. Classifications below restate `CURRENT_STATE_AUDIT.md`'s findings against what the
implemented candidates actually proved.

## D01 — Player Detail Overview, position evidence

**Already in production, unmodified**: `PlayerCurrentStoryCard`, `PlayerPositionMapWidget` →
`TouchlinePositionMap` → `PositionEvidenceDot`, `PlayerPositionProfile`. All three components are
mounted exactly as production uses them; nothing was rebuilt.

**What the real-component mount demonstrates**: declared and evidence-derived positions render
side by side, both using the real `canonicalFullLabel`/`exactPositionLabel` vocabulary,
distinguished by provenance (a declaration card vs. an evidence-derived pitch map) and by
support-band/confidence — this is the current, real production behavior, and remains valid as a
"what exists today" reference.

**Remediation (2026-11-24)**: the owner adopted the 14-role profile tier as decided direction
(ADR-0160 §6), resolving the authority conflict this section previously disclosed (see
`SOURCE_RECONCILIATION.md` §4b). The real 24-code mount above does not by itself demonstrate the
*approved* experience, only today's production behavior — an owner review correctly found that
disclosing the mismatch was not sufficient; D01 must show the decided 14-role presentation.
Added `ProfileRoleSummary` (directional, reusing Gate A's real `collapseTacticalToProfile`, not a
new mapping): declared profile role, evidence-derived profile role with support-band/confidence,
and an exact-tactical drill-down. `GATE-D-W1-D01-AGREEING` shows both profile roles agreeing
(`CB`/`CB`); `GATE-D-W1-D01-DIVERGING` shows them genuinely differing at the profile level
(`CB`/`RB` — not merely different sided codes within one profile group), with an explicit
statement that no automatic primary-position mutation occurs. `fixtureVersion` bumped to 2 on
both (rendering changed; underlying fixture data and `fixtureSha256` did not).

## D02 — Player Detail Evidence, position-dot consolidation

**Already in production, unmodified**: `buildPlayerEvidenceViewModel`, `EvidenceStory`,
`Sparkline`, `StackedDistribution`. The `TREND` group (ADR-0155 B6, closed by ADR-0157 C5) is
real and wired in production (`EvidenceTab`, `page.tsx` lines ~484-493) — not a stub, confirmed by
direct code reading before this wave began.

**Remediation (2026-11-24)**: an owner review correctly found the original candidate showed only
an exact-sided breakdown (CB 58% / RCB 25% / CDM 17%) — a valid exact view, but **not** the
profile-level consolidation D02's actual acceptance question requires. Further investigation
found the deeper truth: production's real `buildEvidenceStories()`
(`src/lib/touchline/presentation/player-detail-production-adapter.ts`) never populates
`positionShares` at all — its real POSITION story shows only a single top-position headline, no
percentage breakdown of any kind. `positionShares` is a real, type-level rendering slot already
wired to the real `StackedDistribution` component, but no live data source currently feeds it.

Added a real, deterministic 24-to-14 aggregation (`consolidateExactSharesByProfile`, reusing Gate
A's `collapseTacticalToProfile` — no second mapping) and `ConsolidatedPositionEvidence`: the
profile-level view (CB 83% / DM 17%, correctly summing CB+RCB and CDM) is now the primary
presentation, with the exact breakdown (CB 58% / RCB 25% / CDM 17%) kept accessible via an
explicit `<details>` drill-down — neither level is dropped, and nothing is double-counted (a new
`__tests__/profile-consolidation.test.tsx` asserts both totals independently sum to 100 and that
every exact share is counted in exactly one profile bucket). Applied to both `populated-evidence`
and `sparse-evidence` (the latter's single `LM` code trivially consolidates to `LM` 100%,
exercising the one-code edge of the aggregation). `fixtureVersion` bumped to 2 on both (rendering
changed; underlying fixture data and `fixtureSha256` did not).

**Classification correction**: this is **not** `ALREADY_IMPLEMENTED_AND_VERIFIED` as previously
recorded — the real production POSITION story has no share breakdown to verify against. The
UI Lab candidate now truthfully demonstrates a directional two-level presentation over a real
rendering slot that currently has no live production data source, not a reproduction of an
existing populated production example.

## D04 — Player Detail Matches, minute coverage

**Already in production, unmodified**: `PlayerMatchTimeline`.

**What the candidate demonstrates**: a match with no recorded minutes at all, and a match with
recorded minutes but no recorded actual position, both render their real, honest state — never a
fabricated `0'` and never a position inferred from a plan. Full and partial coverage are visually
distinguishable within the same list.

**No disclosed mismatch.**

## D07 — Attribute evolution review (extension, 2026-11-23, directional; remediated 2026-11-24)

**Already in production**: the automatic attribute-mutation accumulator and `AssessmentChange`
audit model (ADR-0092), now amended by ADR-0160 to add a materiality/approval layer on top.

**What exists vs. what's new**: `GATE-D-W1-D07-AUTOMATIC` reproduces real, already-shipped
behavior (`AssessmentHistoryPanel`'s rendering, mirrored over fixture data for the reason
disclosed in `DATA_TRUTH_AND_FIXTURES.md`). `GATE-D-W1-D07-MATERIAL` is **not** real production
behavior yet — `MaterialApprovalReview` is a directional design candidate for ADR-0160's decided
policy. No schema supports a "pending approval" state today (confirmed: `AssessmentChange` always
represents an already-applied change). This is explicitly disclosed, not blended with the
real-component candidates above.

**Remediation (2026-11-24)**: an owner review found `GATE-D-W1-D07-MATERIAL`'s original fixture
contradicted ADR-0160 §4's own cumulative-materiality math (it showed three automatic one-point
increases reaching +3 before requiring approval, when the policy requires approval at +2).
Corrected the fixture and the component's type to explicitly separate a coach-established
baseline, the current (already-applied) value, and the proposed (pending, not-yet-applied)
value — the prior type conflated "proposed" with what looked like an already-settled number.
Added `materiality-policy.ts`, a small, independently-unit-tested pure module computing the exact
threshold boundary, so the fixture's correctness is verifiable by a real test rather than only by
inspection. Also added `GATE-D-W1-D07-REBASE`, the manual-edit/lock + attribute-level-rebase state
previously deferred — directional, since today's `Player.evidenceCutoverAt` is player-wide, not
per attribute, and no production UI for any of this exists.

## D08 — Primary position proposal (extension, 2026-11-23, directional)

**Already in production**: `ADR-0139`'s automatic candidate-identification computation
(unaffected by ADR-0160); the 14-role profile mapping (`collapseTacticalToProfile`, reused from
Gate A's `a12-profile-editor` directional study — not new to this candidate).

**What's new/directional**: the entire review/approval interaction (`PositionProposalReview`) does
not exist in production. ADR-0139's `evolvePlayerPositionProfile()` still writes automatically
today. Both states explicitly disclose this on-page and in the component's own header comment.

**Correction, 2026-11-24**: `GATE-D-W1-D08-CONFLICT`'s coach note previously *agreed* with the
proposal ("prefers staying tucked in" actually supports a move to the more central `RB`), failing
to demonstrate a genuine conflict. Replaced with a note raising a real, position-relevant
defensive concern (recurring difficulty defending 1v1 in the channel) that creates real tension
with the quantitative proposal — the coach must weigh two sources that point in different
directions, which the system does not resolve for them. `fixtureVersion` bumped to 2;
`fixtureSha256` recomputed.

## D09 — Evidence lineage (extension, 2026-11-23, expanded 2026-11-24)

**Already in production, unmodified data model**: `qualitative-evidence-service.ts`'s
supersession marking (`supersededAt`) — real, already-shipped (ADR-0152); and
`qualitative-evidence-extraction-contract.ts`'s `validateExtractionSemantics` — a PLAYER/PAIR-
scoped claim with no resolvable `playerRef` rejects the whole extraction response.

**What's new**: `EvidenceLineageDisplay` is a new presentational component — no existing
production component surfaces this lineage to a coach today (every real read helper filters to
active-only observations). This candidate exposes real data through new presentation, per the
owner's decision #6 ("exposing existing lineage... not another supersession model").

**Expansion, 2026-11-24**: `GATE-D-W1-D09-LINEAGE` is now interactive — simulated Edit and Retract
on the active entry, locally reproducing the real `recordDeterministicExtraction()` resubmission/
retraction semantics (edit creates a new active entry and supersedes the old one; retract
supersedes the active entry with nothing replacing it, matching the service's own documented "a
coach retracted a claim on resubmit" behavior). A second scenario, `GATE-D-W1-D09-AMBIGUOUS`, was
added using the real `RejectedExtractionDisplay` component to show that an unresolvable player
reference produces **zero** observations — not a low-confidence or flagged-ambiguous one, since
no such tier exists in the real contract. Together these two scenarios now cover explicit,
tentative, edit, retract, and ambiguous-reference-rejection — the full D09 normative question,
except for one disclosed gap (see `DATA_TRUTH_AND_FIXTURES.md`): the real schema has no field for
the original raw submitted text, only each observation's structured `statement` and the run's
fingerprint/char-counts, so "source-wording preservation" is demonstrated at the
observation-statement level, not as a byte-identical original-submission record that doesn't
actually exist in production. A separate "retraction" scenario was considered and rejected as
redundant with `GATE-D-W1-D09-LINEAGE`'s own interactive Retract control.

## Acceptance classification (2026-11-24 remediation, brief §11)

Three distinct questions, deliberately not collapsed into one status, per scenario:

- **Design acceptance** — does the UI Lab candidate demonstrate the approved experience?
- **Production capability** — does the actual application support the operation today?
- **Operational verification** — has the real production behavior been verified end to end
  (not merely a fixture-driven component/browser test of a UI Lab candidate)?

| Scenario | Design acceptance | Production capability | Operational verification | Note |
|---|---|---|---|---|
| D01 | PASS | FAIL | FAIL | 14-role profile projection has zero production callers outside Gate A's own directional study; nothing to operationally verify because it doesn't run in the real app. |
| D02 | PASS | FAIL | FAIL | Real `positionShares` rendering slot exists but has no live production data source at all; the consolidation logic is new UI-Lab-only code with no production counterpart to verify against. |
| D04 | PASS | PASS | PARTIAL | `PlayerMatchTimeline` is real, live, unmodified; verified via component tests mounting real fixture data, not a running authenticated end-to-end session — this remediation did not add browser-level D04 coverage (not in the brief's §8 list) and does not claim to. |
| D07 | PASS (after fixing the cumulative-materiality math defect) | FAIL | FAIL | No schema or service distinguishes a pending-approval attribute change from an already-applied one; `AttributeRebasePanel`'s state machine is directional, not real persistence. |
| D08 | PASS (after fixing the non-conflicting fixture defect) | FAIL | FAIL | `ADR-0139`'s automatic write path is unchanged in production; the review/approval surface itself does not exist. |
| D09 | PARTIAL | PARTIAL | PARTIAL | The underlying supersession (`supersededAt`) and rejection (`validateExtractionSemantics`) mechanisms are real, shipped, and verified by their own existing service tests (ADR-0152) — but no production UI surfaces this lineage to a coach, and this candidate cannot represent byte-identical original-submission-text preservation because no such field exists in the real schema (disclosed, not fabricated). Design acceptance is PARTIAL, not PASS, specifically because of that one disclosed sub-gap. |

**Do not read any PASS above as evidence that ADR-0160's policy is implemented in production.**
Every D07/D08 PASS is a design-acceptance PASS only — the production capability and operational
verification columns for both remain FAIL by design, because this remediation's scope explicitly
excludes implementing the real mutation/approval machinery (see `BLOCKERS.md` and the owner's
remediation brief §12).
