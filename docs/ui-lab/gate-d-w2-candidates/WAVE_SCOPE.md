# Gate D Wave 2 — Scope

## Selected scenarios: D03, D06

The register defines exactly these two rows for this wave (`SOURCE_RECONCILIATION.md`); it does
not prescribe an exact fixture-page count. The selection below is the smallest coherent set that
demonstrates every acceptance requirement from both rows plus XR-A01/XR-A04 and ADR-0157's
knowledge hierarchy, following the mission brief's own §8 initial matrix.

### D03 family — `src/app/dev/ui-lab/gate-d/d03-development-ai/`

| Scenario | What it demonstrates |
|---|---|
| `grounded-longitudinal-hypothesis` | A genuine multi-period longitudinal story (5 observations across 6 weeks), an existing coach-confirmed development focus kept visually distinct from the AI hypothesis, a derived trend with its own stated comparison window/units/coverage, and a disclosed contradicting observation (not hidden). |
| `sparse-no-hypothesis` | The required "no defensible conclusion" state: one match, one observation, no derived trend, no hypothesis — the honest insufficiency state (XR-A04), never generic padding advice. |
| `coach-decision-flow` | The full Promote/Dismiss interaction contract on one panel: a successful simulated Promote, a successful simulated Dismiss, and a simulated Promote failure that leaves the hypothesis visibly pending with an inline error. |

### D06 family — `src/app/dev/ui-lab/gate-d/d06-cross-source-hypothesis/`

| Scenario | What it demonstrates |
|---|---|
| `coherent-synthesis` | Three distinct evidence kinds (derived trend, qualitative observation, actual position intervals) supporting one hypothesis without being presented as the same measurement; 24-code exact evidence preserved alongside 14-role profile narrative language (ADR-0160 §6). |
| `genuine-contradiction` | A real, same-substance disagreement between an earlier formal `HUMAN_ASSESSMENT` and a later `QUALITATIVE_OBSERVATION` about the identical question (centre-back readiness) — disclosed, not silently resolved or averaged, per ADR-0155 §9. |
| `sparse-cross-source` | None of the three evidence families individually sufficient; the different kinds of gap (missing data, insufficient sample, no contrary evidence, explicit coach uncertainty) kept distinguishable rather than collapsed into one line. |
| `source-inspection-confirmation` | A separate coherent story (not a reuse of `coherent-synthesis`'s fixture content) whose own interaction coverage is the point: every cited source independently expandable via the new `EvidenceSourceInspector`, Promote disabled until a focus is entered, both Promote and Dismiss succeed with no real Server Action. |

Total: 7 new fixture-driven routes, 2 new family index pages, the existing Gate D root index
updated to list D03/D06 alongside Wave 1's six scenarios.

## Why these seven, not more or fewer

- D03 and D06 share one owner component and one knowledge-hierarchy constraint set, but are
  functionally distinct concerns: D03 is "AI hypothesis beside an existing coach focus, within
  one player's own development thread"; D06 is "cross-source synthesis across trend, observation,
  and position history, independent of whether a development focus already exists." Bundling
  cross-source synthesis into D03's family, or vice versa, would blur that distinction.
- Each state maps to one specific normative requirement (XR-A01's comparison-window disclosure,
  XR-A04's insufficiency state, ADR-0155 §9's non-reconciliation rule, the register's
  "source-linked story" requirement) rather than being added for fixture-count's own sake.
- `source-inspection-confirmation` is deliberately a separate fixture from `coherent-synthesis`
  (different player, different story) specifically so its own interaction-focused test coverage
  does not depend on `coherent-synthesis`'s static-narrative fixture staying unchanged, and vice
  versa — the same "independent fixtures, no hidden coupling" discipline Gate C W3 and Gate D W1
  both already established.

## Scenario IDs

`GATE-D-W2-D03-GROUNDED`, `GATE-D-W2-D03-SPARSE`, `GATE-D-W2-D03-DECISION-FLOW`,
`GATE-D-W2-D06-COHERENT`, `GATE-D-W2-D06-CONTRADICTION`, `GATE-D-W2-D06-SPARSE`,
`GATE-D-W2-D06-SOURCE-INSPECTION`. Candidate identifiers, not new official register IDs (the
register itself only has `D03`/`D06`).

## Component owners

- `src/components/ai/assistant-coach-hypothesis-panel.tsx` — real, unmodified, both families.
- `src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx`'s `DevelopmentTab` composition —
  reproduced (not imported — it is a page-local async function, not an exported component) in
  D03's `grounded-longitudinal-hypothesis`/`sparse-no-hypothesis` fixtures using the same real
  `TouchlineWidget`/`WidgetHeader`/`PlayerDevelopmentTimeline` components and the same
  `buildPlayerDevelopmentViewModel()` builder.
- `src/lib/ai/presentation/player-development-cycle-insight.ts` — real type reused for D03's
  "Learning cycle" card data shape.
- `src/domain/positions/canonical-labels.ts` (`canonicalFullLabel`) — real 24-code label
  authority, reused for every D06 position-interval source record.
- `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts` (`collapseTacticalToProfile`) —
  the one real 14-role mapping authority, reused (never re-derived) for D06's profile-level
  narrative language.
- `src/app/dev/ui-lab/gate-d/w2-shared/` (new, this wave) — `AssistantCoachHypothesisMount` (the
  Gate C W3 C07 RSC-boundary fix, reproduced for Gate D), `EvidenceSourceInspector` +
  `evidence-source-types.ts` (the new, disclosed source-linking directional presentation and its
  fixture-integrity validator), `NoDefensibleHypothesis` (the new, disclosed no-hypothesis
  presentation).

## Known implementation constraint — RSC boundary (Gate C W3's own disclosed lesson)

Per Gate C W3's C07 remediation (`src/app/dev/ui-lab/gate-c/w3-shared/today-mount.tsx`'s own doc
comment): a plain closure passed as a prop from a server `fixtures.ts`/`page.tsx` to a client
component crashes real browser/CI capture with a React Server Components serialization error —
invisible to jsdom component tests, which never cross the real server/client boundary. Every Wave
2 `page.tsx` stays a plain server component; `AssistantCoachHypothesisMount`
(`w2-shared/assistant-coach-hypothesis-mount.tsx`) is the one `"use client"` boundary, and it
constructs the simulated `AssistantCoachHypothesisActions` object internally from a plain boolean
flag, never receiving it as a prop. This is the exact pattern copied, not reinvented.

## What this wave will NOT prove

It will not implement D01/D02/D04/D07/D08/D09 again, add a D05, start Gate E, implement
ADR-0160's real position/attribute mutation persistence, modify `Player` schema, introduce a new
Assistant Coach provider or inference framework, or rework the production hypothesis-generation
pipeline. It will not make `EvidenceRef` navigable in production, or make
`getPlayerAssistantCoachHypotheses()` return a distinguishable OFF/EMPTY/ERROR/STALE status — both
are disclosed production gaps (`CURRENT_STATE_AUDIT.md`), not resolved here.
