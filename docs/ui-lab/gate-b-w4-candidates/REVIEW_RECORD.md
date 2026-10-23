# Gate B W4 — Review Record

| Scenario | Status | Notes |
|---|---|---|
| B07-HISTORICAL-PATTERN | `CANDIDATE`, `approval: null` (fixtureVersion 2) | Independent-review remediation applied (W4-R5/R6/R7/R9); not yet reviewed by the owner. |
| B07-TRIVIAL-FACT | `CANDIDATE`, `approval: null` (fixtureVersion 2) | Independent-review remediation applied (W4-R5/R8); not yet reviewed by the owner. |

## Independent review (PR #811, reviewed commit `edd576b52471559cbe7140c10240c1ad8b0c116f`)

A separate, independent review found four P1 defects (B07-B's Advisor state was
production-unreachable; match-format/chronology contradicted this team's established 60-minute
regulation; historical evidence named the wrong opponent and over-claimed causation/coverage; the
320px captures showed a real score-wrap/label-truncation defect) and several P2 items (evidence-
inspector capture coverage, test quality, evidence-drilldown production-boundary disclosure,
terminology). Every finding was independently re-verified against the real repository before any
fix — none were taken on faith. See `SOURCE_RECONCILIATION.md` (entries W4-R5 through W4-R10) for
the full, finding-by-finding record; `fixtureVersion` bumped 1 → 2 for both scenarios as a result.
The 320px/360px layout defect and the "AI Advisor"/"Assistant Coach" terminology split were both
confirmed as real, **pre-existing production-component behavior** (not introduced by B07) and are
recorded as production dependencies in `BLOCKERS.md`, not fixed inside this PR.

No `/visual-review deploy`, `/visual-approve`, or `/visual-reject` has been posted on this PR. No
promotion to `APPROVED_GOLDEN` has been attempted. This file will be updated, in a
documentation-only follow-up commit, once the owner reviews the real CI capture (fresh evidence
against the remediated fixtureVersion 2 code, still pending as of this remediation commit) and the
gate resolves — the same process every prior Gate B wave has followed.
