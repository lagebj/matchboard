# Gate D W1 — Scenario Register

Original scope: three register rows (D01, D02, D04), six fixture-driven display routes (two
states each), all read-only presentation.

**Extension, 2026-11-23** (owner decision, ADR-0160): three more register rows (D07, D08, D09),
five more fixture-driven routes. D07/D08 are directional design candidates for a decided-but-
unimplemented policy, not production-component mounts for the review/approval interaction itself
(see `WAVE_SCOPE.md`'s "Wave 1 extension" and `VISUAL_VS_CURRENT.md`). All simulated accept/
reject/defer/lock interactions are disclosed on-page and in `INTERACTION_AND_STATE_AUDIT.md`;
`PlayerPositionProfile`'s position editor (D01) is wired to a fixture-safe simulated handler only.

## D01 — Player Detail Overview, position evidence

**Remediated 2026-11-24**: added `ProfileRoleSummary` (directional) to both states, demonstrating
the approved 14-role profile experience (ADR-0160 §6) alongside the real 24-code production
mount, which by itself only showed current production behavior, not the decided design. `fixtureVersion` bumped to 2 on both (data unchanged).

| Scenario ID | Required state | Route | Viewports | Themes | Components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D01-AGREEING` | Declared and evidence-derived positions agree, at both the exact and profile level | `/dev/ui-lab/gate-d/d01-overview-position-evidence/agreeing-positions` | desktop, mobile, narrow | dark, light | `PlayerCurrentStoryCard`, `PlayerPositionMapWidget` (→ `TouchlinePositionMap`), `PlayerPositionProfile` (via the fixture-safe `PlayerPositionProfileMount`) — real production; `ProfileRoleSummary` — directional, reuses Gate A's real `collapseTacticalToProfile` |
| `GATE-D-W1-D01-DIVERGING` | Declared and evidence-derived positions diverge, genuinely at the profile level (`CB` vs. `RB`, not just sided codes within one profile group); no automatic mutation disclosed | `/dev/ui-lab/gate-d/d01-overview-position-evidence/diverging-positions` | desktop, mobile, narrow | dark, light | Same as above |

Register viewport/theme requirement: desktop dark, mobile dark. Both scenarios additionally
capture desktop light, mobile light, and a 320px `narrow` viewport at both themes (6 captures per
scenario total — non-normative wider coverage, per mission brief §7, same universal `narrow`
viewport every prior gate's wave also captures via `scripts/ui-lab-visual-review.mjs`).

## D02 — Player Detail Evidence, position-dot consolidation

**Remediated 2026-11-24**: the POSITION story's visual is now `ConsolidatedPositionEvidence`
(real 24-to-14 profile-level aggregation as the primary view, exact breakdown in a drill-down),
not a bare exact-code `StackedDistribution` — see `DATA_TRUTH_AND_FIXTURES.md` for the finding
that production's real POSITION story has no share breakdown at all today. `fixtureVersion`
bumped to 2 on both states (data unchanged).

| Scenario ID | Required state | Route | Viewports | Themes | Components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D02-POPULATED` | Populated evidence, all four groups; POSITION shows profile-level consolidation (CB 83% / DM 17%) with exact drill-down (CB 58% / RCB 25% / CDM 17%) | `/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/populated-evidence` | desktop, mobile, narrow | light, dark | `EvidenceStory`, `Sparkline`, `StackedDistribution` (via `buildPlayerEvidenceViewModel`, real) + `ConsolidatedPositionEvidence` (directional, reuses Gate A's `collapseTacticalToProfile`) |
| `GATE-D-W1-D02-SPARSE` | Partial + unknown data; single-code POSITION story still consolidates correctly | `/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/sparse-evidence` | desktop, mobile, narrow | light, dark | Same as above |

Register viewport/theme requirement: desktop light, mobile light. Both scenarios additionally
capture desktop dark, mobile dark, and a 320px `narrow` viewport at both themes (6 captures per
scenario total — same universal `narrow` viewport every prior gate's wave also captures).

## D04 — Player Detail Matches, minute coverage

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D04-FULL` | Full minute and position coverage | `/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage` | mobile, desktop, narrow | dark, light | `PlayerMatchTimeline` |
| `GATE-D-W1-D04-PARTIAL` | Unknown minute coverage | `/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage` | mobile, desktop, narrow | dark, light | `PlayerMatchTimeline` |

Register viewport/theme requirement: mobile dark, desktop light. Both scenarios additionally
capture mobile light, desktop dark, and a 320px `narrow` viewport at both themes (6 captures per
scenario total).

## D07 — Attribute evolution review (directional, ADR-0160 §4/§5)

**Remediated 2026-11-24**: `GATE-D-W1-D07-MATERIAL`'s fixture previously showed baseline 6 with
three automatic one-point increases (6→7→8→9) before requiring approval — contradicting ADR-0160
§4's own math (cumulative movement crosses the 2-point approval trigger at the *second* step).
Corrected to baseline 6 / current applied 7 / proposed (pending) 8 / cumulative-if-accepted +2. The
manual-edit/lock + attribute-level-rebase state previously deferred is now included
(`GATE-D-W1-D07-REBASE`).

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D07-AUTOMATIC` | Non-material automatic change | `/dev/ui-lab/gate-d/d07-attribute-evolution-review/automatic-non-material` | desktop, mobile, narrow | dark, light | `AssessmentHistoryDisplay` — reproduces the real `AssessmentHistoryPanel`'s rendering over fixture data |
| `GATE-D-W1-D07-MATERIAL` | Material change, pending coach approval (corrected cumulative math) | `/dev/ui-lab/gate-d/d07-attribute-evolution-review/pending-material-approval` | desktop, mobile, narrow | dark, light | `MaterialApprovalReview` — directional component, no production equivalent exists; now backed by the shared, independently-tested `materiality-policy.ts` threshold functions |
| `GATE-D-W1-D07-REBASE` | Manual-edit precedence and attribute-level rebase | `/dev/ui-lab/gate-d/d07-attribute-evolution-review/manual-edit-rebase` | desktop, mobile, narrow | dark, light | `AttributeRebasePanel` — new directional component, no production equivalent exists (today's `Player.evidenceCutoverAt` is player-wide, not per attribute) |

Register viewport/theme requirement for D07: not explicitly separated by state in the official
register beyond "desktop + mobile" for the scenario as a whole; all three states use the same
desktop/mobile/narrow × dark/light matrix (6 captures per state) as the rest of this wave for
consistency.

## D08 — Primary position proposal (directional, ADR-0160 §1/§6)

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D08-STRONG` | Strong, unambiguous evidence | `/dev/ui-lab/gate-d/d08-primary-position-proposal/strong-evidence` | desktop, mobile, narrow | dark, light | `PositionProposalReview` (new directional component) + `collapseTacticalToProfile` (reused from Gate A's `a12-profile-editor`) |
| `GATE-D-W1-D08-CONFLICT` | **Corrected 2026-11-24** (`fixtureVersion: 2`): quantitative evidence supports an `RB` proposal, and a genuinely contrary coach observation (recurring defensive-positioning concern at that exact position) creates real tension with it — the prior version's note actually agreed with the proposal and was replaced. | `/dev/ui-lab/gate-d/d08-primary-position-proposal/conflicting-note` | desktop, mobile, narrow | dark, light | Same as above |

## D09 — Evidence lineage (exposes existing data)

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D09-LINEAGE` | Original, superseded, and active observation versions — **now interactive** (2026-11-24): simulated Edit and Retract on the active entry, demonstrating the real `recordDeterministicExtraction()` resubmission/retraction behavior live | `/dev/ui-lab/gate-d/d09-evidence-lineage/superseded-lineage` | desktop, mobile, narrow | dark, light | `EvidenceLineageDisplay` (new presentational component over real `qualitative-evidence-service.ts` field shapes and the real `supersededAt` behavior) |
| `GATE-D-W1-D09-AMBIGUOUS` | **New 2026-11-24**: an unresolvable player reference, rejected per the real `validateExtractionSemantics` rule — zero observations result, not a kept-but-ambiguous one | `/dev/ui-lab/gate-d/d09-evidence-lineage/ambiguous-reference-rejected` | desktop, mobile, narrow | dark, light | `RejectedExtractionDisplay` (new presentational component over the real `extractionResponseSchema`/`validateExtractionSemantics` contract) |

D09's coverage note (2026-11-24): the full normative question (explicit/tentative/ambiguous references, edit/retract interaction, source-wording preservation, no double counting, no phantom rating) is now covered by these two scenarios together — `GATE-D-W1-D09-LINEAGE` covers explicit, tentative, edit, and retract; `GATE-D-W1-D09-AMBIGUOUS` covers the ambiguous-reference case. A separate third "retraction" route was considered and rejected as redundant, since `GATE-D-W1-D09-LINEAGE`'s own interactive Retract control already demonstrates that exact transition live — see "avoid unnecessary new visual components" in the remediation brief. One disclosed gap (`DATA_TRUTH_AND_FIXTURES.md`): the real schema does not persist the original raw submitted text, only each observation's structured `statement` and the run's fingerprint/char-counts — "source-wording preservation" is demonstrated at the observation-statement level, not as a byte-identical original-submission record, because no such record exists in the real persistence model today.

## Deferred (not part of this wave)

D03, D06 (Assistant Coach cross-source hypothesis — Wave 2 candidate). D05 does not exist in the
official register.
