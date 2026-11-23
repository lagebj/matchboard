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

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D01-AGREEING` | Declared and evidence-derived positions agree | `/dev/ui-lab/gate-d/d01-overview-position-evidence/agreeing-positions` | desktop, mobile | dark, light | `PlayerCurrentStoryCard`, `PlayerPositionMapWidget` (→ `TouchlinePositionMap`), `PlayerPositionProfile` (→ `TouchlinePositionMap`, via the fixture-safe `PlayerPositionProfileMount`) |
| `GATE-D-W1-D01-DIVERGING` | Declared and evidence-derived positions diverge | `/dev/ui-lab/gate-d/d01-overview-position-evidence/diverging-positions` | desktop, mobile | dark, light | Same as above |

Register viewport/theme requirement: desktop dark, mobile dark. Both scenarios additionally
capture desktop light and mobile light (non-normative wider coverage, per mission brief §7).

## D02 — Player Detail Evidence, position-dot consolidation

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D02-POPULATED` | Populated evidence, all four groups | `/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/populated-evidence` | desktop, mobile | light, dark | `EvidenceStory`, `Sparkline`, `StackedDistribution` (via `buildPlayerEvidenceViewModel`, the real pure view-model builder) |
| `GATE-D-W1-D02-SPARSE` | Partial + unknown data | `/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/sparse-evidence` | desktop, mobile | light, dark | Same as above |

Register viewport/theme requirement: desktop light, mobile light. Both scenarios additionally
capture desktop dark and mobile dark.

## D04 — Player Detail Matches, minute coverage

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-D-W1-D04-FULL` | Full minute and position coverage | `/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage` | mobile, desktop | dark, light | `PlayerMatchTimeline` |
| `GATE-D-W1-D04-PARTIAL` | Unknown minute coverage | `/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage` | mobile, desktop | dark, light | `PlayerMatchTimeline` |

Register viewport/theme requirement: mobile dark, desktop light. Both scenarios additionally
capture mobile light and desktop dark.

## D07 — Attribute evolution review (directional, ADR-0160 §4)

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D07-AUTOMATIC` | Non-material automatic change | `/dev/ui-lab/gate-d/d07-attribute-evolution-review/automatic-non-material` | desktop, mobile | dark, light | `AssessmentHistoryDisplay` — reproduces the real `AssessmentHistoryPanel`'s rendering over fixture data |
| `GATE-D-W1-D07-MATERIAL` | Material change, pending coach approval | `/dev/ui-lab/gate-d/d07-attribute-evolution-review/pending-material-approval` | desktop, mobile | dark, light | `MaterialApprovalReview` — new directional component, no production equivalent exists |

A manual-edit/lock + attribute-level-rebase state (ADR-0160 §5) is explicitly deferred — see
`BLOCKERS.md`.

## D08 — Primary position proposal (directional, ADR-0160 §1/§6)

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D08-STRONG` | Strong, unambiguous evidence | `/dev/ui-lab/gate-d/d08-primary-position-proposal/strong-evidence` | desktop, mobile | dark, light | `PositionProposalReview` (new directional component) + `collapseTacticalToProfile` (reused from Gate A's `a12-profile-editor`) |
| `GATE-D-W1-D08-CONFLICT` | Evidence with a conflicting coach note | `/dev/ui-lab/gate-d/d08-primary-position-proposal/conflicting-note` | desktop, mobile | dark, light | Same as above |

## D09 — Evidence lineage (exposes existing data)

| Scenario ID | Required state | Route | Viewports | Themes | Components |
|---|---|---|---|---|---|
| `GATE-D-W1-D09-LINEAGE` | Original, superseded, and active observation versions | `/dev/ui-lab/gate-d/d09-evidence-lineage/superseded-lineage` | desktop, mobile | dark, light | `EvidenceLineageDisplay` (new presentational component over real `qualitative-evidence-service.ts` field shapes and the real `supersededAt` behavior) |

## Deferred (not part of this wave)

D03, D06 (Assistant Coach cross-source hypothesis — Wave 2 candidate). D05 does not exist in the
official register.
