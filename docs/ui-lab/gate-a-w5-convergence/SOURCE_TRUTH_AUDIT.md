# Gate A W5 — Source Truth Audit

Per `06_FOOTBALL_TRUTH_AND_SOURCE_COVERAGE.md`: audit A04 as the canonical evidence grammar baseline,
then check A02/A03/A05-A12 for violations of the same semantics. This audit draws on each wave's own
"Data-truth invariant tests" sections (already enumerated with concrete test files in `A04_REVIEW.md`,
`A03_A07_A09_REVIEW.md`), cross-checked rather than re-derived, plus direct fixture/source reads for
the cross-family claims below.

## Required distinctions — compliance table

| Distinction | Correct treatment required | Found in source | Status |
|---|---|---|---|
| Unknown vs. zero minutes | `Not recorded` shown explicitly | `shared/coverage.test.ts` (A04); reused unmodified by `aggregateExactAppearancesByProfile` (A06/A12) | PASS |
| Declared vs. actual positions | Declared role is a valid signal; played experience needs interval/source evidence | A11's `profile-change-review-*` fixtures model a real `declaredPrimary` projection distinct from evidenced minutes; A12's two-case split (Case A "Legacy declared positions" / Case B "Recorded match exposure") is the same split | PASS |
| Limited vs. complete events | Score can be real while event timeline is incomplete | A04-S4 (6-4, one recorded `GOAL_FOR`) unchanged by this PR; verified no A05-A12 scenario invents a missing scorer | PASS |
| Profile projection vs. tactical exact grid | 14 roles ≠ 24 codes, mapping must be explicit | A12 (14 roles), A06/A07/A09/A10 (24 exact codes via `TouchlinePlanningPitch`); A11's deliberate LCM→CM example documents the mapping rather than silently collapsing it (see `CROSS_WAVE_CONSISTENCY.md` C-X05) | PASS |
| Source confidence vs. skill strength | Sparse observations lower confidence, never skill | A04-S2 (`role-exposure-sparse`, "2 of 6", no derived trend line) unchanged | PASS |
| AI interpretation vs. extracted coach text | Extraction cannot add claims absent from the text | A11 independent-review finding R1 (removed an invented `period: "SECOND_HALF"` attribution) and A11-F1 (`phase: "GENERAL"` when the text doesn't name a tactical phase) — both already fixed pre-W5, re-confirmed present in current source (`fixtures.ts` for `coach-text-and-parsed-evidence`) | PASS |
| Opponent/contextual facts vs. measured performance | No fabricated possession/xG/shots/grades | Confirmed by source grep: no such field exists in any A05-A12 fixture file | PASS |
| Completed/live data vs. draft | Read-only submitted reports not mutated by a review candidate | No W4 scenario writes to any persisted report; all outcomes are explicitly "(simulated)" | PASS |

## A11 source-field grounding (W5 bundle's specific check)

`08_ASSISTANT_COACH_AND_EVIDENCE_SEMANTICS.md` asks for an exact check against the real
`qualitative-evidence-extraction-contract.ts` shape. Confirmed by source read of `a11-qualitative-
evidence-and-mutation/coach-text-and-parsed-evidence/fixtures.ts`: the composure observation
carries `period: null, phase: "GENERAL"` (not attributed to a half or tactical phase the coach's
note never named), and the explicit team-pressing note carries `phase: "PRESSING", period:
"SECOND_HALF"` only because that note's own text names the half. Both match the bundle's required
values exactly. The extraction scenario imports and runs the real `extractionResponseSchema`/
`safeParseExtractionResponse`/`validateExtractionSemantics` against this fixture data (not a
re-declared parallel schema) — the only W4 file that imports a production module directly,
confirmed in `ACTION_OWNERSHIP.md`'s A11 row and independently re-confirmed by source grep this
session (`import { ... } from "@/lib/evidence/qualitative-evidence-extraction-contract"` present in
`a11-qualitative-evidence-and-mutation/coach-text-and-parsed-evidence/fixtures.ts`).

## MatchInsights determinism under Assistant Coach state

`MatchInsights` (`src/lib/matches/match-insights/get-match-insights.ts`) is reused directly and
unmodified by A05/A08 (`CONTRACT_RECONCILIATION.md`'s own reconciliation table, row 1). It is
prop-driven, not self-fetching, and no A05/A08 fixture or component path calls it with a different
input depending on Assistant Coach activation state — confirmed by source read: the deterministic
Match Insights content shown in every A05/A08 state (`disabled`/`enabled-with-pattern`/`enabled-
without-pattern`/`unavailable`/`off`/`on-strong-pattern`/`on-no-insight`) comes from the same fixed
fixture value, and only the separate Assistant Coach card/notice region varies. This directly
satisfies C-X06/C-X09's "deterministic facts untouched by AI state" requirement.

## A10 evidence source grounding

Per `06_FOOTBALL_TRUTH_AND_SOURCE_COVERAGE.md`'s instruction to audit each A10 evidence source's
group/match/player/slot semantics: `lineup-proposal-contract.ts`'s `validateProposalSemantics`
(round-2/round-3 fixes, already landed pre-W5) rejects slot-mismatched evidence as
`EVIDENCE_TARGET_MISMATCH` and subject-mismatched evidence as `EVIDENCE_SUBJECT_MISMATCH` — both
confirmed present in the current source and covered by the 54-case test file cited in `ACTION_
OWNERSHIP.md`.

## Caption truthfulness

Every interactive A07/A09/A10/A11 page that simulates a write carries an explicit, visible caption
stating no server was called (`data-testid="fixture-simulation-caption"` in A10;
equivalent literal strings in A05/A08/A11/A07/A09, confirmed present in every scenario's rendered
output by source read of each page's JSX). No scenario in any wave labels a simulated interaction
as a verified production write.

## Findings

None. No source-truth violation was found in any A01-A12 family, W1 through W4 (including the
narrow A10 layout fix in this PR, which touches no data/fixture file). This is consistent with —
not independently surprising given — the fact that every prior wave's own independent technical
review already specifically audited this exact dimension before recording owner approval (see each
wave's "Data-truth invariant tests" section). W5's contribution here is confirming no regression was
introduced by a later wave against an earlier wave's approved semantics, which is the genuinely new
cross-wave question this audit could answer that no single wave's own review could.
