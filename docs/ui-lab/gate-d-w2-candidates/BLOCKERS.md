# Gate D W2 — Blockers

## Evidence-fidelity findings from owner review — resolved (2026-11-25)

The owner's review of this PR's first version (CI-green, 42 captures attested) found four real
defects this wave's own independent review and self-review had not caught:

- **P1** — D03-DECISION-FLOW cited evidence (`trend-amir-lm-minutes`, `obs-amir-lm-comfort`,
  `trend-amir-trailing-rate`, `trend-amir-copresence`) with **no backing `EvidenceSourceMap`** —
  the fixture had no `sources` export at all, and no test called `resolveEvidenceSource` against
  it. This is a genuine gap in this wave's own evidence-integrity discipline, not previously
  disclosed as a known limitation.
- **P1** — `evidence-source-detail.tsx`'s pill label was derived from `FixtureSourceProvenance`
  (RECORDED/DERIVED) rather than `EvidenceRef.kind`, so a `HUMAN_ASSESSMENT` (a coach's own
  judgement) rendered identically to a canonical fact ("Recorded fact").
- **P2** — D03-GROUNDED labelled a raw per-window count (5 giveaways, then 2) a "rate" with no
  exposure denominator.
- **P2** — D03-GROUNDED's page stated a "five-week window" for a range that is actually six weeks.

All four are corrected — see `DATA_TRUTH_AND_FIXTURES.md`'s own "Remediation" section for the full
technical account, `EVIDENCE_AND_HYPOTHESIS_CONTRACT.md` for the corrected knowledge-class
framing, and the fresh independent review (`REVIEW_RECORD.md`) for verification that the
corrections hold and introduced no new defect. This is recorded as a genuine finding against this
wave's own earlier claims, not retroactively erased.

## Resolved before implementation

- **D06's missing XR citation** (`SOURCE_RECONCILIATION.md`) — not a blocker: documented as a
  genuine source inconsistency and resolved by treating the register row as authoritative,
  consistent with Wave 1's own precedent for the same class of cross-reference gap.
- **ADR-0157's own text not previously re-read** (Wave 1's disclosed gap) — closed this wave; read
  in full, knowledge hierarchy confirmed to match ADR-0155's own description.

## Production capability gaps — disclosed, filed, not fixed in this wave

Both are genuine missing capabilities (not competing implementations), filed as GitHub issues per
`docs/agents/issue-and-arr-workflow.md`'s three-way test, rather than fixed inline — both require
a production domain-type/contract change out of this wave's UI-Lab-only scope (mission §16):

- **[#845](https://github.com/lagebj/matchboard/issues/845)** — `EvidenceRef` has no navigable
  source-detail capability; D06's "source-linked story" acceptance question is unsatisfied in
  production today. This wave's `EvidenceSourceInspector` is a disclosed directional UI Lab
  answer, not a fix.
- **[#846](https://github.com/lagebj/matchboard/issues/846)** — Player Detail's Development tab
  collapses AI-off / no-hypothesis / provider-not-ready into identical silence (an empty
  `hypotheses` array renders nothing). Corrects Wave 1's own `CURRENT_STATE_AUDIT.md`, which had
  incorrectly attributed a different surface's real OFF/EMPTY/ERROR/STALE states to this one.

## Local verification limitation (pre-existing, not introduced by this wave) — resolved by CI

Per existing project memory and Wave 1's own precedent: `next dev` + Playwright cannot hydrate
reliably inside this devcontainer (the HMR WebSocket upgrade fails/retries forever, reproducing
on untouched Wave 1 pages too — not specific to this wave's new routes). This wave's new Vitest
component tests (both `vitest.config.components.ts` and default config) were run and pass
locally; the new `e2e/ui-lab-gate-d.spec.ts` additions could not be executed locally for this
reason.

**Outcome**: CI's real browser run (`ui-lab-visual-review.yml`, PR #847) found 4 real failures on
the first run — genuine Playwright-vs-jsdom text-matching differences (Playwright's `getByText`
is a case-insensitive substring match by default; Testing Library's jsdom default is an exact
match), plus one test targeting the wrong button index. None were component or fixture defects.
Fixed in a follow-up commit, re-verified against the real CI run: all Playwright tests and all 42
scheduled captures (7 scenarios × 6 viewport/theme combinations) passed. See `REVIEW_RECORD.md`
for the full account and `capture-attestation.json` for the independently re-verified capture
evidence.

## No authority conflicts found

No conflict between this wave's scope and any accepted ADR. ADR-0160's mutation-approval
machinery is not triggered by any D03/D06 fixture (neither register row's acceptance question
asks for a position/attribute proposal); where a fixture cites position evidence, it uses the
real `collapseTacticalToProfile()` mapping correctly (verified by test) rather than conflicting
with ADR-0160 §6.

## Capture evidence superseded by this remediation

The previous `capture-attestation.json` (CI run 45643162459) attested screenshots of the
pre-remediation rendering for D03-GROUNDED, D03-DECISION-FLOW, D06-COHERENT, and D06-CONTRADICTION
(all four render `EvidenceSourceInspector`, whose pill labels changed) and D06-SOURCE-INSPECTION
(same shared component). Those screenshots no longer represent the current code and are not reused
as evidence — see `capture-attestation.json`'s own updated content for the fresh, independently
re-verified CI run this remediation triggered.

## No unresolved source requirements beyond the disclosed D06 XR gap above

All nine mandatory source files from the mission brief's §2 were recovered and read (see
`SOURCE_RECONCILIATION.md`'s verification list). Nothing required for this wave's scope was
unreadable.
