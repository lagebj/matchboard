# Gate D W2 — Scenario Register

Scope: two register rows (D03, D06), seven fixture-driven display routes. All interactive states
use the real, unmodified `AssistantCoachHypothesisPanel` with its documented `actions` override
(no production component change); all simulated Promote/Dismiss/failure interactions are
disclosed on-page and independently asserted (component tests + Playwright) to invoke zero real
Next.js Server Actions.

## D03 — Player Detail Development, AI hypothesis

Register viewport/theme requirement: desktop dark + mobile light.

| Scenario ID | Required state | Route | Viewports | Themes | Components mounted |
|---|---|---|---|---|---|
| `GATE-D-W2-D03-GROUNDED` | Existing coach-confirmed development focus, kept visually distinct from a grounded AI hypothesis citing a derived trend plus two observations, with one disclosed contradicting observation | `/dev/ui-lab/gate-d/d03-development-ai/grounded-longitudinal-hypothesis` | desktop, mobile, narrow | dark, light | `TouchlineWidget`/`WidgetHeader`/`PlayerDevelopmentTimeline` (real) + `AssistantCoachHypothesisPanel` (real, via `AssistantCoachHypothesisMount`) + `EvidenceSourceInspector` (directional) |
| `GATE-D-W2-D03-SPARSE` | One observation, no derived trend, no hypothesis — the honest no-defensible-conclusion state | `/dev/ui-lab/gate-d/d03-development-ai/sparse-no-hypothesis` | desktop, mobile, narrow | dark, light | `TouchlineWidget`/`WidgetHeader`/`PlayerDevelopmentTimeline` (real) + `NoDefensibleHypothesis` (directional) |
| `GATE-D-W2-D03-DECISION-FLOW` | Three pending hypotheses in one panel, each with its own distinctly titled source inspector: successful simulated Promote, successful simulated Dismiss, simulated Promote failure | `/dev/ui-lab/gate-d/d03-development-ai/coach-decision-flow` | desktop, mobile, narrow | dark, light | `AssistantCoachHypothesisPanel` (real, via `AssistantCoachHypothesisMount`) + `EvidenceSourceInspector` (directional, one per hypothesis — added by remediation, see `DATA_TRUTH_AND_FIXTURES.md`) |

Both scenarios additionally capture desktop light, mobile dark, and a 320px `narrow` viewport at
both themes (6 captures per scenario total — non-normative wider coverage, consistent with Wave
1's own universal `narrow` convention via `scripts/ui-lab-visual-review.mjs`).

## D06 — Player intelligence, cross-source hypothesis

Register viewport/theme requirement: desktop + mobile (no theme specified; both captured).

| Scenario ID | Required state | Route | Viewports | Themes | Components mounted |
|---|---|---|---|---|---|
| `GATE-D-W2-D06-COHERENT` | Derived trend + qualitative observation + two actual position intervals supporting one coherent hypothesis; 24-code exact evidence alongside a 14-role profile narrative statement | `/dev/ui-lab/gate-d/d06-cross-source-hypothesis/coherent-synthesis` | desktop, mobile, narrow | dark, light | `AssistantCoachHypothesisPanel` (real) + `EvidenceSourceInspector` (directional) |
| `GATE-D-W2-D06-CONTRADICTION` | An earlier `HUMAN_ASSESSMENT` and a later `QUALITATIVE_OBSERVATION` genuinely disagree about the same substantive claim; both disclosed, neither silently resolved | `/dev/ui-lab/gate-d/d06-cross-source-hypothesis/genuine-contradiction` | desktop, mobile, narrow | dark, light | Same as above |
| `GATE-D-W2-D06-SPARSE` | No defensible cross-source narrative; missing data / insufficient sample / no contrary evidence / coach uncertainty kept distinguishable | `/dev/ui-lab/gate-d/d06-cross-source-hypothesis/sparse-cross-source` | desktop, mobile, narrow | dark, light | `NoDefensibleHypothesis` (directional) |
| `GATE-D-W2-D06-SOURCE-INSPECTION` | A separate coherent cross-source story whose own four cited sources are each independently expandable; Promote disabled until a focus is typed | `/dev/ui-lab/gate-d/d06-cross-source-hypothesis/source-inspection-confirmation` | desktop, mobile, narrow | dark, light | `AssistantCoachHypothesisPanel` (real) + `EvidenceSourceInspector` (directional) |

All four scenarios additionally capture a 320px `narrow` viewport at both themes (6 captures per
scenario total — non-normative wider coverage, consistent with every prior gate's wave).

## Deferred / out of scope

D01, D02, D04, D07, D08, D09 — already delivered in Wave 1 (PR #844, merged, approved). D05 does
not exist in the official register. Gate E is not started.
