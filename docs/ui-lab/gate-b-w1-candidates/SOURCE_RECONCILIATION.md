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

## Phase 2 — the owner chose genuine exploration; here is what it found

The owner asked this wave to pursue genuine design exploration rather than pure confirmation,
explicitly accepting that the exploration might still conclude current production is already
good. Reading the real component source directly (not relying on the earlier summary above) found:

- B01 and B02's first revision had each quietly **added** an invented `DecisionBanner` duplicating
  `MatchPreparationWidget`'s own output — a real violation, now fixed by removing it. Once fixed,
  B01/B02 **do** genuinely confirm the shipped baseline, this time for real (the audit checked,
  not assumed).
- B03/B04 surfaced one genuine, narrow, well-grounded refinement: `MatchFlowPanel` never discloses
  when a trustworthy-but-sparse chronology's running tally disagrees with the real final score.
  B03 now demonstrates the disclosure (additive, UI-Lab-local, not a production edit); B04 was
  re-checked against the same question and confirmed to need nothing.
- Fixture-injectability (decision 2) turned out not to be needed for either finding — recommended
  deferred to a wave that actually needs to manipulate a self-fetching panel (B07 is the natural
  candidate).

Full detail in `VISUAL_VS_CURRENT.md` and `BLOCKERS.md`. The owner's Event/League-parity question
(decision 3) is answered in `BLOCKERS.md` as well, grounded in `docs/agents/event-and-league-behavior.md`
and ADR-0011 rather than guessed.

## Phase 3 — independent technical review remediation (B1-R1 through B1-R5)

An independent technical review of this PR (reviewing head `f71bfc628`) found five findings
requiring correction before technical acceptance — two P1 (CI capture failure; B01's lineup
assignment producing duplicate tactical occupancy), one P1 (B04's insight claiming an unsupported
cross-match pattern with only a reference count for evidence), and two P2 (B01 not demonstrating
same-match before/after continuity; B03 exposing implementation commentary in coach-facing text).
All five are fixed on this branch — see `BLOCKERS.md`'s remediation summary, `VISUAL_VS_CURRENT.md`
for the per-scenario detail, and the commit history for the exact changes. This was a correction
pass on the existing wave, not a new design proposal or a new Gate B wave.

## What this PR does not decide

- B05 (Post-Match Report draft/final), B06 (League/Event parity), B07 (Assistant Coach
  longitudinal), B08 (information ownership/transitions) remain `NOT_READY`/`DIRECTIONAL_ONLY` per
  the register and are deferred, not deleted — see `SCENARIO_REGISTER.md`.
- Gate C-G are not started.
- No `APPROVED_GOLDEN` status is claimed anywhere in this wave.
