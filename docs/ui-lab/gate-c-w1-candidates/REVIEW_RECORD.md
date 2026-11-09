# Gate C W1 — Review Record

## Disposition

`READY_FOR_INDEPENDENT_REVIEW`

## Summary

An independent review of this PR's first pass (reviewed HEAD `d13feb206c14e00792ba1844e8de327cbb8eee4a`)
found three genuine production defects and three fixture-integrity gaps:

- **P1-01** — the quiet-day "Nothing needs your attention" hero could render directly below a
  real Matchday action, contradicting it.
- **P1-02** — "Today in order" (the busy same-day chronology) never rendered on a
  quiet-composition day, even with a genuine same-day Matchday object.
- **P1-03** — squad readiness and carry-forward could render twice: once in the main composition
  (or Matchday's own card) and again, unconditionally, in the context rail.
- **P2-01** — C03's kickoff fixture was relative to the real `Date.now()`, and C01's hardcoded
  upcoming-match dates would silently fall outside production's real 7-day window over time.
- **P2-02** — several fixture hrefs were unscoped paths, not production's real
  `/o/{orgSlug}/...` shape.
- **P2-03** — C02's duplicate-suppression test proved a count cap, not a genuine identity
  collision.
- **G-01** — a pre-existing, unrelated Visual Authority Gate fingerprint-staleness defect
  (issue #827), correctly left out of this PR's scope.

**All six findings (P1-01 through P2-03) are now fixed.** Two production files received a
narrow, justified, regression-tested correction (`today-surface.tsx`, `today-quiet-state.tsx`);
every Gate C fixture was reworked to use a fixed deterministic clock, production's real
same-day-match-selection pipeline, and production's real organisation-scoped href rules; C02's
fixture now demonstrates a genuine identity collision. See `CURRENT_STATE_AUDIT.md`,
`DATA_TRUTH_AND_FIXTURES.md`, and `INTERACTION_AND_STATE_AUDIT.md` for the full detail.

## A. Findings and corrections

See the Summary above and the referenced documents for exact findings and corrections. In brief:
P1-01/P1-02 are fixed by two small, additive conditions in `today-surface.tsx`'s own render
logic (`showHero={!matchdayContext}`, `showOperationalTimeline = compositionState === "DECISION"
|| Boolean(matchdayContext)`), never a new ranking engine. P1-03 is fixed by computing
`squadStatusShownElsewhere`/`carryForwardShownElsewhere` from facts already resolved
(`matchdayContext`, `compositionState`) and suppressing the context rail's own props accordingly.

## B. Production changes

`today-surface.tsx` and `today-quiet-state.tsx` — see `CURRENT_STATE_AUDIT.md` for why fixture
changes alone could not have corrected these: the defect was in production's own composition
logic (what renders, and when), not in what data a fixture supplied.

## C. Fixture integrity

- **Controlled clock:** `GATE_C_NOW_ISO`, a fixed reference instant, replaces every real-clock
  dependency; `TodaySurface` gained an explicit `nowIso?: string` prop for this (production
  behavior unchanged when omitted).
- **Real same-day match selection:** `gateCBuildBusyDay()` builds three real candidates and lets
  the real `selectFeaturedTodayFootballMatch()` choose the featured one.
- **Canonical URL construction:** every fixture href now follows the exact scoping rule its real
  consuming component expects, verified field-by-field against source.

## D. Interaction coverage

See `INTERACTION_AND_STATE_AUDIT.md` for the complete list, including the 10 new production
regression tests, the new fixture-builder determinism/phase tests, and the rewritten Playwright
suite's real click-through navigation assertions.

## E. Visual evidence

Real Chromium capture evidence for this remediated revision is produced by CI
(`ui-lab-visual-review.yml`), against this branch's new head commit — **not** reusing the
pre-remediation 80-capture attestation, per the independent review's explicit instruction.
`capture-attestation.json` is regenerated once that run completes (two-commit attestation
convention: this commit lands the remediation, the next commits the real evidence once CI has
produced it).

## F. Governance

This PR's `Visual Authority Gate` check reports `AWAITING_APPROVAL` for Gate C's own eight
scenarios (unchanged — this remediation does not fabricate an approval) and separately surfaces
issue #827 (pre-existing, unrelated, Gate B's own stale B01-B04 approvals) when the gate
re-evaluates the full registry. Neither state is conflated with a technical-check failure: all
of `npm run validate`'s own checks (typecheck, lint, tests, build) pass independently of the
Visual Authority Gate's human-approval state. No `/visual-approve`/`/visual-reject` is posted by
this remediation.

## G. Known limitations

- Tactics readiness is fixed at `UNKNOWN` in every C03 fixture (no canonical tactics data source
  to invent from) — unchanged from the original wave, disclosed in `BLOCKERS.md`.
- C07, C04-C06, and C08 remain out of this wave's scope — unchanged, disclosed in `BLOCKERS.md`.
- Issue #827 (Visual Authority Gate fingerprint staleness) remains open and tracked separately;
  this remediation does not attempt to fix it, per that issue's own disposition.

## H. Disposition

`READY_FOR_INDEPENDENT_REVIEW`
