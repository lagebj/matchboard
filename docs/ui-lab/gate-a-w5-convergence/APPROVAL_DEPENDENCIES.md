# Gate A W5 — Approval Dependencies (W4 Outstanding Owner Decision)

Per `15_OWNER_APPROVAL_AND_REVIEW_SHEET.md`'s "Decision A". This is **not** an approval — it is the
enumeration the owner needs to make that decision, kept separate from this PR's own Decision B
(W5 convergence findings, see `REVIEW_RECORD.md`).

## Status at this PR's creation

All 13 W4 manifest entries remain `status: "CANDIDATE"`, `approval: null`. PR #780 merging W4's
code into `main` on 2026-10-12 did **not** record human golden approval — code merge and design
approval are different authority types (`03_MERGED_BASELINE_AND_APPROVAL_INVENTORY.md`'s "Authority
types" list), and this PR does not change that status for any scenario.

**This PR's A10 breakpoint fix (`INTERACTION_STATE_AUDIT.md`) changes the visible container layout
of all 3 A10 scenarios between 600-840px wide.** Any capture evidence an owner reviews for A10
should be taken **after** this fix lands, not reused from the pre-fix CI runs cited in `VISUAL_
COVERAGE_AND_CAPTURE.md` — recapture is a mechanical CI re-run away (push triggers `ui-lab-visual-
review.yml` automatically) and does not require a new fixture version (layout-only change).

## Per-family decision table

| Family | Scenarios | Fixture version(s) | Candidate capture count | Usability question (from `A05_A08_A10_A11_REVIEW.md`) |
|---|---|---|---|---|
| A05 | `disabled`, `enabled-with-pattern`, `enabled-without-pattern`, `unavailable` | 1 (all) | 10+14+10+10 = 44 | Is a valuable hypothesis conspicuous, cited, and clearly not a fact? Does "off" leave no reserved gap? |
| A08 | `off`, `on-strong-pattern`, `on-no-insight` | 1 (all) | 10+10+10 = 30 | Is the surrounding layout identical across all three, with no filler when on-but-empty? |
| A10 | `review-alternative-success`, `stale-proposal-blocked`, `disabled-or-failed` | 2, 2, 1 | 34+14+14 = 62 (pre-this-PR's-fix; recapture recommended) | Can I review an evidence-backed proposal and apply it in place? Is a stale proposal blocked before I can even try? Does the pitch remain readable at 390px and the 600/768/840px breakpoints — **directly relevant to this PR's `W5` fix, worth the owner's specific attention this round** |
| A11 | `coach-text-and-parsed-evidence`, `profile-change-review-guarded`, `profile-change-review-rejected` | 3, 1, 1 | 10+20+20 = 50 | Can I see exactly what was structured from my own note, and nothing more? Can I accept/reject/defer without any implicit write? |

Total: 13 scenarios, 186 candidate captures (pre-this-PR's-A10-fix count; A10's 62 should be
recaptured before final review — see above).

## What the owner needs per scenario (per `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`)

For each of the 13: exact fixture version, representative mobile+desktop light+dark images, the
scenario's own usability question (above), and one decision: `APPROVE_GOLDEN` / `REVISE` /
`REJECT`. **Only the repository owner's own explicit decision can set `approval` — this PR (or any
coding agent) cannot infer, backdate, or copy approval metadata from CI success, a technical
review's recommendation, or another wave's approval.**

## This PR's disclosed effect on that decision

- A10's three scenarios have a real, fixed layout defect (`INTERACTION_STATE_AUDIT.md`) — recommend
  reviewing A10 against a fresh post-fix capture, not the pre-fix evidence cited in W4's own review
  doc.
- A05/A08/A11's ten scenarios are completely unchanged by this PR — the existing CI evidence
  (`VISUAL_COVERAGE_AND_CAPTURE.md`) remains current and reviewable as-is.
- `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s "Mandatory gates before profile mutation work" are
  still explicitly unresolved product decisions, carried forward unchanged (W4-BLK-09 / this PR's
  `CONFLICT_AND_BLOCKER_REGISTER.md` `W5-F03`) — A11's `profile-change-review-guarded` fixture's
  hypothetical materiality threshold is disclosed, not newly resolved, by W4 approval either way.

## Gate impact

**`C6 Design authority complete` remains unmet regardless of this PR's outcome.** This PR cannot
and does not change that — only the owner's explicit per-scenario decision can. A W5 audit PR "may
be technically accepted with C6 unmet, but it cannot claim all Gate A goldens are approved"
(`04_W5_SCOPE_AND_COMPLETION_DEFINITION.md`), which is exactly this PR's posture.
