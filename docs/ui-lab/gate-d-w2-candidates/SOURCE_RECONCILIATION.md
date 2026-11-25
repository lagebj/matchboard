# Gate D Wave 2 — Source Reconciliation

## Register rows (verbatim, `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`)

```
D03,D,Player Detail,Development/AI,AI hypothesis and coach focus,Desktop dark + mobile light,Defensible longitudinal story from comparable observations; Assistant Coach cannot pad findings (XR-A01 XR-A04),"AssistantCoachHypothesisPanel, ADR-0155",Needs golden,GATE_D,DIRECTIONAL_ONLY,NOT_READY,,b070df73664d816f1b0ebc61d54487a24044972e

D06,D,Player intelligence,Assistant Coach cross-source hypothesis,Trend+coach observation+position history vs sparse data,Desktop + mobile,Source-linked longitudinal story and clear coach confirmation; avoid invented development performance,AssistantCoachHypothesisPanel; derived trends and player history,Needs golden,GATE_D,DIRECTIONAL_ONLY,NOT_READY,,b070df73664d816f1b0ebc61d54487a24044972e
```

`D05` does not exist in the register (`D04` → `D06`, confirmed by direct `grep "^D05,"` returning
zero matches). Not invented here.

## XR-A01 through XR-A04 (verbatim, `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`)

### XR-A01 — Comparison over time and meaningful baselines

**Applies:** A04, D01/D02/D03, E03, B04 where relevant.

**Required:** Progression visualization states the measured construct, time periods, comparable
baseline, units, source coverage, number of independent observations/matches, and limits of
interpretation. Use discrete markers or a no-trend state if the sample does not justify a
connected series. Historical profile attribute changes show before/after and recorded source; do
not imply smooth continuous performance growth.

**Accept:** A sparse two-match fixture does not display a reliable continuous improving curve; a
better-supported multi-period fixture permits actual comparison with a visible basis.

**Reject:** Generic up-arrow without comparison basis; season trend from sparse events; apparent
causation from correlation.

### XR-A02 — Distribution that explains opportunities

**Applies:** A04, C04/C06, D01, E03. D03/D06 are not in this requirement's own "Applies" list.
Not load-bearing for this wave.

### XR-A03 — Position and attribute development stories

**Applies:** A04/A06/A11, D01/D02/D07/D08/D09. D03/D06 are not listed here either. Not
load-bearing for this wave (D01/D02/D07/D08/D09 are Wave 1 concerns).

### XR-A04 — Editorial selection and progressive disclosure

**Applies:** A04, Match B03/B04, Player D01/D02, Season E03 (per this file's own list) — but the
register's own D03 row explicitly cites `(XR-A01, XR-A04)`, and the register row is treated as the
authoritative scope pointer for which XR requirements govern a Gate D surface, consistent with
Wave 1's own precedent of resolving this exact kind of cross-reference gap in favour of the
register.

**Required:** The first view contains the most defensible relevant finding(s), not a fixed
collection of metric cards. Suppress unsupported or unhelpful findings; allow source and numerical
drilldowns without losing selected context. If evidence cannot justify a finding, display the
coaching question and available facts with an honest insufficiency state.

**Accept:** A strong evidence fixture produces a useful supported story; a sparse fixture does not
produce an empty framed chart or contrived conclusion.

**Reject:** "Always show 5 charts/insights"; unsupported story headline; one-size-fits-all chart
grid.

## Disclosed source inconsistency — D06 has no explicit XR citation

The register's D03 row cites `(XR-A01, XR-A04)`. The **D06 row has no parenthetical XR citation at
all** — unlike every other Gate D row, and unlike D03 itself. Neither XR-A01's nor XR-A04's own
"Applies" list in `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` names D06 by surface ID either. This
is documented here as a genuine source gap, not resolved by inventing a citation: D06 is governed
by the general Decision D4/D5 "data truth" principles in
`04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` and by family resemblance to D03 (same owner
component, same knowledge-hierarchy constraints, same register acceptance-question shape), not by
a literal XR-A01/XR-A04 citation it does not carry.

## Knowledge hierarchy (ADR-0155 / ADR-0157)

ADR-0155 and ADR-0157 state the same four-class hierarchy (ADR-0157 §2, confirmed by direct
reading of `docs/adr/0157-contextual-coach-workspace-convergence.md` in this wave — Wave 1's own
audit had not independently re-read ADR-0157 and flagged that gap; it is closed here):

1. **Fact** — canonical recorded state (match events, actual minutes, qualitative observations,
   selected squad).
2. **Deterministic evidence** — application-computed measurement from canonical facts (role
   exposure, co-presence, trend direction).
3. **Coach observation/assessment** — explicit human-authored or explicitly promoted judgement.
4. **Assistant Coach hypothesis** — optional AI synthesis citing Matchboard-owned evidence, never
   truth by itself.

ADR-0157 §5 (AI boundary, restated): AI may synthesize supplied evidence, explain a deterministic
recommendation, compare plan expectation with reported reality, and propose a hypothesis/
development observation requiring explicit coach promotion. AI may never establish eligibility,
decide confidence/maturity/situational relevance, create canonical evidence by itself, or mutate
selection/lineup/report/development/assessment state directly. When AI is unavailable, every
deterministic surface remains complete and useful; failure is a small status state, never a
page-level error. ADR-0157 §5 is the basis for this wave's `NoDefensibleHypothesis` state (see
`EVIDENCE_AND_HYPOTHESIS_CONTRACT.md`).

ADR-0157 §6 (Player Detail target, C5): Evidence surfaces ADR-0155 B6 trends from persisted data
only; B7 hypotheses appear clearly labelled and never outrank deterministic evidence or become the
Overview headline without explicit coach promotion.

## ADR-0160 — mutation-approval rules and the 14-role/24-code split

Read in full this wave. Directly binding wherever a D06 fixture's hypothesis references position
evidence:

- §1: Primary-position changes require explicit coach approval (creates a proposal, never
  auto-applies). Not implemented in production.
- §4: Numeric attribute materiality thresholds (automatic only under strict bounds; mandatory
  approval above a 2-point cumulative drift, a lock, or policy requiring review).
- §6: The 14-role profile projection (`collapseTacticalToProfile()`,
  `src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts`) is the approved profile vocabulary
  for narrative/profile-level statements; exact tactical evidence retains the 24-code vocabulary.
  Not a production capability outside `src/app/dev/ui-lab/gate-a/**` and its Gate D reuses.

D03/D06 are evidence/hypothesis-presentation scenarios, not proposal/mutation scenarios like
D07/D08 — neither scenario's acceptance question asks for a position or attribute proposal. The
one place ADR-0160 actually bites is D06's `coherent-synthesis` and `source-inspection-confirmation`
fixtures, which cite `ACTUAL_POSITION_INTERVAL` evidence and state a profile-level narrative claim
— both reuse the real `collapseTacticalToProfile()` function for that narrative language and keep
the exact position-interval source records at 24-code precision, independently asserted in each
fixture's own test.

## Mandatory source verification — what was and was not inspected

Recovered and read directly, this wave:

- `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` (D03/D06 rows, D05 absence)
- `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md`
- `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`
- `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` (XR-A01 through XR-A04, verbatim)
- `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`
- `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`
- `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`
- `24_CONFLICT_AND_BLOCKER_REGISTER.md`
- `02_AUTHORITY_SCOPE_AND_APPROVALS.md` (both the top-level bundle copy and, where distinct, the
  `programme_v054` copy — no discrepancy found between them)
- `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`, `16_POSITION_SEMANTICS_TRACEABILITY.csv`
- `docs/adr/0155-development-context-and-evidence.md`
- `docs/adr/0157-contextual-coach-workspace-convergence.md` (full text, this wave — closes Wave
  1's own disclosed gap)
- `docs/adr/0159-visual-authority-gate-and-deliberate-pr-review-deployments.md` (procedural
  requirements only, via `docs/development/coding-agent-working-session.md`'s own summary —
  sufficient for the procedural steps this wave follows; its full prose text was not re-read
  independently this wave either, same as Wave 1)
- `docs/adr/0160-coach-approved-position-and-attribute-mutation-policy.md` (full text)
- `docs/ui-lab/gate-d-w1-candidates/*` (all nine files, full text)
- PR #844's real GitHub approval ledger (`gh pr view 844`, `gh pr checks 844`) — not just the
  manifest's `approval` fields

Not independently verified this wave (disclosed, not assumed away):

- `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s own "Candidate UI Lab states" list does not name
  D03/D06 explicitly — it is general inspiration, not a normative state list for this wave. The
  normative states come from the register row, XR-A01/XR-A04, and the knowledge-hierarchy rules
  above.
- Gate C W3's `c07-assistant-coach-fallback/{off,empty,error,stale}` sibling fixtures were not
  read line-by-line this wave (only `on/` was, to recover the actions-override mechanism). Their
  `TodayAssistantCoachContext`-style status pattern does not transfer directly to Player Detail's
  hypothesis reader, which has no equivalent status-carrying type today (see
  `CURRENT_STATE_AUDIT.md`) — this wave's `NoDefensibleHypothesis` component is a new, smaller,
  Player-Detail-scoped answer to the same "no defensible conclusion" requirement, not a reuse of
  that Today-specific pattern.
