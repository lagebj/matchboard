# Gate D W2 — Evidence and Hypothesis Contract

Documents the boundary between canonical observations, derived measurements and trends, human
assessments, Assistant Coach hypotheses, and coach-confirmed development focus, per ADR-0155/
ADR-0157's knowledge hierarchy (`SOURCE_RECONCILIATION.md`), and the rules this wave's fixtures
and components enforce to prevent unsupported hypotheses.

## The four classes, as this wave presents them

1. **Canonical observation / fact.** A qualitative coach observation, a human assessment, a match
   event, an actual position interval. Represented in a fixture as a `FixtureSourceRecord` with
   `provenance: "RECORDED"`. Never duplicated — a hypothesis cites it by `EvidenceRef`, it does
   not copy its content into the hypothesis's own statement as if restated as new information.
2. **Derived measurement / trend.** A deterministic computation over canonical facts (role
   exposure minutes, event rate, co-presence). Represented as `provenance: "DERIVED"`. Always
   states its own comparison window, units, and coverage in its `detail`/`coverage` fields — never
   a bare number.
3. **Coach assessment / existing development focus.** An explicit, already-confirmed human
   judgement — in D03's fixtures, the active `developmentThread`'s own `focus`/`rationale`, shown
   in its own `TouchlineWidget`, visually and textually separated from the hypothesis card below
   it ("This is the coach's own existing, already-confirmed development focus — distinct from the
   Assistant Coach hypothesis below").
4. **Assistant Coach hypothesis.** An interpretation that may combine evidence classes 1–2 and
   cite class 3, but is never itself promoted to class 1–3 without an explicit coach action. The
   real `AssistantCoachHypothesisPanel`'s own fixed disclaimer ("This is an AI hypothesis, not a
   confirmed fact. It never changes the player's record on its own.") is reused unmodified in
   every interactive scenario — never suppressed or reworded.

## Source-reference resolution

An `EvidenceRef` (`kind`, `id`, `occurredAt?`, `label?`) is a reference, not a copy. This wave's
`resolveEvidenceSource(ref, sources)` (`w2-shared/evidence-source-types.ts`) is the one place a
ref is resolved to its backing record, and it is deliberately strict: a ref with no matching
fixture record, or whose source record's `kind` disagrees with the ref's declared `kind`, throws.
This is the mechanism that prevents "a plausible-looking source label without a corresponding
source record" — the exact failure mode the mission brief names.

## Rules that prevent an unsupported hypothesis, as implemented

- **Missing evidence is never converted to a negative assessment.** `missingEvidence` is always a
  factual absence statement ("No recorded evidence yet on positioning in transition"), never a
  claim that the missing thing is bad or didn't happen.
- **Exposure is not performance.** D06-COHERENT's hypothesis states explicitly: "this reflects a
  change in role exposure, not a demonstrated improvement in centre-back ability" — asserted by
  its own fixture test.
- **One match is never presented as a long-term trend.** Every `DERIVED_TREND` source states an
  explicit multi-match comparison window (minimum 3 vs. 3 matches); single-match evidence is
  always cited as `QUALITATIVE_OBSERVATION` or `ACTUAL_POSITION_INTERVAL`, never relabelled as a
  trend.
- **A tentative observation is never promoted to a confirmed-performance statement by the
  hypothesis's own wording.** D03-GROUNDED's hypothesis uses "This is consistent with… showing
  some effect, though the sample is still short" — a qualified, not asserted, interpretation.
- **No numerical improvement is invented from qualitative text.** Every numeric claim in a
  hypothesis traces to a `DERIVED_TREND` or `ACTUAL_POSITION_INTERVAL` source's own `detail`; a
  qualitative observation's `detail` never contains a number this wave treats as the basis for a
  quantitative claim.
- **No causal relationship is claimed beyond what the evidence establishes.** D06-COHERENT's
  hypothesis states correlation-shaped language ("is consistent with") rather than asserting
  cause.
- **An AI-generated development focus is never presented as already confirmed.** Every proposed
  focus lives in the same-page, pending Promote/Dismiss interaction — never auto-applied, never
  shown with a success state before the coach acts.
- **Contradictory evidence is never hidden to protect a hypothesis's own narrative.**
  D03-GROUNDED and D06-CONTRADICTION both disclose their contradicting refs explicitly, and the
  latter's hypothesis statement names both disagreeing sources rather than picking a winner.

## Coach confirmation boundary

The real `AssistantCoachHypothesisPanel`'s Promote/Dismiss controls are the only confirmation
mechanism this wave uses — never a second, parallel confirmation UI. A hypothesis becomes a
coach-confirmed development focus only through the real action contract's own shape (`confirm(id,
focus) => Promise<{success}|{success:false,error}>`); this wave's `AssistantCoachHypothesisMount`
substitutes a simulated implementation of exactly that same contract, never a different one. No
fixture's simulated confirmation writes to a real `AssistantCoachHypothesis`, `DevelopmentThread`,
or player record — confirmed by the "no real Server Action" assertion in every component test and
(pending CI) every Playwright test (`INTERACTION_AND_STATE_AUDIT.md`).
