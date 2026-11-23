# Gate D W1 — Scenario Register

Three register rows (D01, D02, D04), six fixture-driven display routes (two states each). All
read-only presentation — no mutation path is exercised for real; `PlayerPositionProfile`'s
position editor is wired to a fixture-safe simulated handler only (disclosed on-page and in
`INTERACTION_AND_STATE_AUDIT.md`).

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

## Deferred (not part of this register)

D03, D06 (Assistant Coach cross-source hypothesis — Wave 2 candidate), D07, D09 (mutation/approval
review — blocked by the unresolved ADR-0139 authority conflict, see `SOURCE_RECONCILIATION.md`
§4), D08 (blocked by both the ADR-0139 conflict and the separate ADR-0154 vocabulary conflict,
see `SOURCE_RECONCILIATION.md` §4b). D05 does not exist in the official register.
