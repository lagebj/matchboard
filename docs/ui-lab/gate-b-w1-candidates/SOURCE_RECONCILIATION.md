# Gate B W1 — Source Reconciliation

`CANDIDATE` only. This wave implements the official Gate B register's **B01-B04** (Match
Details: planned ready, planned incomplete, completed sparse, completed rich) as dev-only,
fixture-backed UI Lab pages under `src/app/dev/ui-lab/gate-b/`. No production route, component,
data loader, persistence, or AI service is changed.

## Sources recovered

- `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`
  — the real, non-invented Gate B scenario register. Verified present, read in full; see
  `SCENARIO_REGISTER.md` for the verbatim B01-B08 rows.
- `20_UI_LAB_CANDIDATE_WAVES.md` in the same bundle — defines Gate A's W0-W5 wave split, but does
  **not** define a Gate B sub-wave split. There is no pre-authorized "B-wave-1 = B01+B02+B03+B04"
  grouping anywhere in the recovered bundle. This PR self-scopes to B01-B04 because that is
  exactly what the coding-agent task's own §4 "First design wave" proposes, and it maps almost
  verbatim onto those four register rows — but the grouping itself is this PR's own choice, not a
  recovered authority, and is stated as such here rather than presented as pre-approved.
- `08_OPEN_SPECIFICATION_DECISIONS_AND_REVIEW_ORDER.md` — confirms Gate B was, at authoring time,
  pending route-level rules and owner approval per family before any golden work begins.
- `00_START_HERE.md` / `07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md` / `16_GATE_B_HANDOFF_AND_OWNER_MAPPING.md`
  state, more than once, that `HANDOFF_READY ≠ GATE_B_AUTHORIZED` — the bundle documents evidence
  and readiness, it does not itself authorize starting Gate B. **This PR's authorization basis is
  the repository owner's own 2026-10-17 directive to begin Gate B**, not an inference from the
  bundle's `HANDOFF_READY` status — recorded explicitly here and in `BLOCKERS.md` rather than left
  implicit.
- `docs/ui-lab/gate-a-w5-convergence/PRODUCTION_OWNER_AND_GATE_B_HANDOFF.md` — the real,
  already-reviewed per-family production-owner table (more current than the hypothetical one in
  the handoff bundle). Confirms `MatchInsights` is "real/deterministic and already prop-driven"
  (directly reusable), and documents the exact precedent this wave follows for components that
  self-fetch/mutate and are not fixture-injectable (A05/A08's `AssistantCoachHypothesisPanel`,
  W4-BLK-10).

## The framing decision — top owner-review question

The register's own language for B01 ("stable match identity while prioritizing kickoff/plan/
opponent and task") and B04 ("meaningful recorded chronology, comparable measures and earned
findings with source drilldown") was written against a master programme (v0.4) that predates
three ADR-0157 convergence slices that have since **shipped to production**:

- C3 "Match Preparation convergence" (PR #760) — `before-match-overview.tsx`'s current
  composition order (identity → opponent memory → ranked Match Insights → current plan →
  coaching intent) already matches B01's register description almost word-for-word.
- C6 "Completed Match story" (PR #764) — `completed-match-story.ts`, `plan-vs-reality-panel.tsx`,
  and `match-flow-panel.tsx` already implement the sparse-vs-rich result/chronology distinction
  B03/B04 ask for, including the exact "6-4 scoreline, one logged event" rule this wave's B03
  fixture exercises.

**Decision made in this PR**: B01-B04 candidates **confirm, via fixtures, that the real shipped
composition satisfies each register row's normative requirement**, rather than proposing a new
composition. This mirrors how several Gate A scenarios (A01/A02/A06/A12) treated already-shipped
Touchline components as reference baselines rather than redesigning them. Where the real
composition could not be reused as-is (self-fetching/mutating mid-level panels — see
`DATA_TRUTH_AND_FIXTURES.md`), that gap is disclosed, not silently worked around.

**This is the first and most consequential owner-review question for this PR**: confirm this
framing is correct, or redirect toward genuine compositional proposals for B01-B04 instead. Every
other decision in this wave follows from this one.

## What this PR does not decide

- B05 (Post-Match Report draft/final), B06 (League/Event parity), B07 (Assistant Coach
  longitudinal), B08 (information ownership/transitions) remain `NOT_READY`/`DIRECTIONAL_ONLY` per
  the register and are deferred, not deleted — see `SCENARIO_REGISTER.md`.
- Gate C-G are not started.
- No `APPROVED_GOLDEN` status is claimed anywhere in this wave.
