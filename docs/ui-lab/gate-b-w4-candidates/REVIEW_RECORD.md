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

Real CI capture evidence for the remediated fixtureVersion 2 was committed
(`capture-attestation.json`, run https://github.com/lagebj/matchboard/actions/runs/39913284775,
`reviewedBranchHeadSha` `8be701d122e442e63d3a0ae5b0beb440f4b8ef45`, 24 B07 captures including the
new evidence-inspector-open interaction state, every SHA-256 independently re-verified, several
captures visually spot-checked) — now itself superseded by the close-out pass below (W4-R12).

## Close-out remediation — `MatchIdentityCard` fix merged into this PR

A follow-up review flagged one remaining material acceptance problem: the shared
`MatchIdentityCard` component wraps the score at narrow widths (confirmed in the above capture run,
originally recorded only as a documented production dependency). The fix (two commits,
real-browser-verified via `workflow_dispatch`, pixel-diffed against the pre-fix baseline at
600/768/900/1440px with zero difference) is now merged directly into this PR's own branch — see
`SOURCE_RECONCILIATION.md`'s W4-R12 entry for the full record, including why it couldn't be opened
as its own PR (a confirmed, real dependency cycle in this repository's sequential-PR + Visual
Authority Gate governance, not a preference) and why merging it here instead doesn't compromise the
approval model (nothing reaches `main` without the owner's own action regardless). `fixtureVersion`
remains 2 for both scenarios — no fixture content changed, only a shared production component.

## Second close-out remediation — team-identity truncation regression corrected

A follow-up independent review found the `MatchIdentityCard` fix above kept the score on one line
by truncating compact team names — discarding the suffix that distinguishes same-club teams (e.g.
"Slemmestad Rød" vs "Slemmestad Hvit"). Corrected (commit
`c608554383bde1abc5c8774d0966387b89090953`): the compact composition is now a 2-row grid with team
names in their own full-width row, wrapping onto a second line rather than truncating. See
`SOURCE_RECONCILIATION.md`'s W4-R13 entry and `VISUAL_VS_CURRENT.md` for the full design rationale
and verification (including same-club-suffix pairs, confirmed via a temporary scratch-branch
capture never merged into any real branch).

Real CI capture evidence for this final state is committed: run
https://github.com/lagebj/matchboard/actions/runs/40023252963, `reviewedBranchHeadSha`
`c608554383bde1abc5c8774d0966387b89090953`, 24 B07 captures, every SHA-256 independently
re-verified, several visually inspected directly (full team names render at every narrow width,
score on one line, no overlap or clipping, desktop composition pixel-identical to the true
original). All CI checks pass except the owner-gated Visual Authority Gate.

No `/visual-review deploy`, `/visual-approve`, or `/visual-reject` has been posted on this PR. No
promotion to `APPROVED_GOLDEN` has been attempted. This file will be updated, in a
documentation-only follow-up commit, once the owner reviews the real CI capture and the gate
resolves — the same process every prior Gate B wave has followed.
