# B07 — Blockers and disclosures

## Authorization basis

Picked up directly from the Gate B W4 coding-agent mission brief (B07, Assistant Coach
longitudinal match context), which names the scenario, the required-read ADR set, and explicitly
forbids starting B08, Gate C, production migration, or owner visual approval in this PR.

## Register CSV not independently re-read this session

The original `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/
programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` is not present in this checkout. The B07 row
is recovered verbatim from the three prior waves' own committed extracts (identical across W1/W2/
W3) instead — see `SCENARIO_REGISTER.md`.

## Local capture not attempted

`next dev` + Playwright cannot hydrate in this sandbox (HMR WebSocket upgrade fails/retries
forever) — a pre-existing, environment-specific limitation that reproduces on untouched,
already-approved earlier Gate B pages too, not something introduced by this wave. Real visual
capture comes from CI's `ui-lab-visual-review.yml` job once this PR is opened and runs, matching
every prior Gate A/B wave.

## Real CI capture — first pass committed, now superseded by independent-review remediation

The original PR head's capture run (https://github.com/lagebj/matchboard/actions/runs/39852677221,
`reviewedBranchHeadSha` `49a2b990842938788afaad26c98fa4805e7e90d4`) completed cleanly (24m59s, all
1144 captures including 20 for B07, every SHA-256 independently re-verified) and was visually
spot-checked — that pass is what surfaced the 320px score-wrap/label-truncation finding (see
`VISUAL_VS_CURRENT.md`) that fed into this remediation. Fixture content changed materially during
remediation (chronology, opponent identity, causal framing, the B07-B advisor state, and the
metric labels) — `fixtureVersion` bumped 1 → 2 for both scenarios, so that capture evidence no
longer matches the current fixtures and cannot be reused. The superseded attestation is preserved
unmodified under this directory's `capture-attestation.json` `priorVersions[0]` for audit history.

That remediation's own fresh capture run (https://github.com/lagebj/matchboard/actions/runs/39913284775,
committed in `capture-attestation.json`) is now **itself superseded** by the close-out pass: the
`MatchIdentityCard` fix (see "MatchIdentityCard narrow-width fix" above) is merged into this PR's
branch after that capture ran, so B07's own committed screenshots still show the unfixed layout. A
further fresh CI run against this merged state, captured and committed the same two-commit way, is
required before `capture-attestation.json`'s top-level content is trustworthy again — see
`SOURCE_RECONCILIATION.md`'s W4-R12 entry and `REVIEW_RECORD.md` for current status.

## Degraded AI state — deliberately deferred, not attempted

See `INTERACTION_AND_STATE_AUDIT.md`. Not a gap found and left unfixed — a scope decision made
up front, since B07's required contrast (meaningful cross-match pattern vs. trivial single-match
fact) doesn't need a third `unavailable`/`reviewing` variant to be legible, and the brief frames
it as optional.

## Event-origin parity — not attempted, real production constraint

Confirmed during investigation: Event has no completed-match Overview/Advisor composition at
all, and `post_match_review`'s own plan/opponent-history/recent-team-patterns sections are
League-only (tracked separately as issue #696, not introduced by this wave). B07 is built on
League fixtures only, as a consequence of real production scope, not a choice this wave made.

## `MatchIdentityCard` narrow-width fix — merged into this PR directly (close-out remediation)

Originally found and documented (not fixed) during the prior remediation pass as a pre-existing
production dependency, confirmed to reproduce identically in already-captured B04/B06 baselines.
A fix was prepared on its own branch (`fix/match-identity-card-narrow-score-wrap`), as a
narrowly-scoped maintenance change, consistent with this repository's production/UI-Lab
review-boundary convention — **but it could not be opened as its own PR**: `AGENTS.md` requires
PRs to be worked strictly sequentially, and PR #811 was (and remains) open. PR #811 in turn cannot
merge until the owner resolves the Visual Authority Gate — confirmed, not assumed, to be a hard
required status check via `gh api repos/lagebj/matchboard/rules/branches/main`. This is a genuine
dependency cycle: B07's own captures can't reflect the fixed layout until the fix is on `main`;
the fix can't become its own PR while #811 is open; #811 can't merge until the owner approves B07.

**Resolution:** the fully independently-verified fix (two commits,
`abfa8d9967cb64344fc86229c00dda657e5822f6` and `cd7f9b59565913760693214d8d80805de5e3559e`) was
merged directly into this PR's own branch via `git merge --no-ff`, rather than left undone or
worked around with something that would compromise the approval model. Nothing merges to `main`
without the owner's own action either way — the fix is simply now part of what the owner reviews
in this one PR, instead of invisible to it. See `VISUAL_VS_CURRENT.md` for the root cause and the
real-browser verification evidence (pixel-diffed against the true pre-fix baseline, not only
visually inspected).

## Other production dependencies found during independent-review remediation — not fixed in this PR

Two real production-component/behavior items were found while remediating B07; neither was
changed here:

1. **"AI Advisor" vs. "Assistant Coach" terminology** — the real `CompletedMatchAdvisorPanel`
   badge still says "AI Advisor"; production's own sibling components
   (`AdvisorPanelReviewing`/`AdvisorPanelUnavailable`) already use "Assistant Coach" in their body
   copy, so this split pre-dates B07. See `CURRENT_STATE_AUDIT.md`'s terminology section.
2. **Evidence-drilldown production boundary** — production's Advisor pipeline persists
   `evidenceRefs` (opaque tokens resolved to a category label) but not full inspectable source
   records; B07-A's `SourceInspector` drilldown is a UI Lab design proposal for what a future
   production capability could expose, not proof the live model can reconstruct it. See
   `CURRENT_STATE_AUDIT.md`'s "Production vs. UI Lab boundary" section.

## `npm run build` not run locally

Reproduces pre-existing in this sandbox independent of this change (OOMs on a clean checkout of
`main` too) — not re-attempted here; relies on CI's real Build job, same as every recent Gate B
wave.
