# Gate C W1 — Blockers and Deferrals

## No official Gate C wave-ordering document

The handoff bundle has no Gate-C equivalent of `20_UI_LAB_CANDIDATE_WAVES.md` — see
`SOURCE_RECONCILIATION.md` for the full finding. This wave's scope is self-assigned per the
brief's own fallback instruction, not a blocker to implementation, but disclosed here per the
brief's requirement not to silently expand or assume scope.

## C07 — Assistant Coach context-free fallback (deferred, not attempted this wave)

**Why:** `CURRENT_STATE_AUDIT.md` confirms zero Assistant Coach / hypothesis wiring exists
anywhere in Today's production component or lib tree today. Demonstrating C07's own acceptance
question ("Same priority and layout when OFF; only material contextual synthesis when ON")
honestly requires wiring the existing, separately-approved Assistant Coach hypothesis system
(ADR-0157 §4, already shipped for Player Detail and other surfaces) into Today for the first
time. That is a genuine new capability, not a fixture or presentation change — the brief's §12
explicitly forbids exactly this for this wave ("Add a new AI recommendation engine", "Introduce
a second Today composition owner"). Building a fixture that merely *simulates* an ON state
without any real underlying wiring would misrepresent a hypothesis as implemented capability,
which the brief's §8 also forbids.

**Disposition:** out of scope for Gate C W1. If and when Today-level Assistant Coach synthesis
is approved as a real capability (a separate, scoped implementation effort — most likely its own
ADR amendment extending ADR-0157's existing hypothesis system to the Today route), C07 becomes a
Gate C W2+ candidate at that point, built from the real wiring rather than a simulated one.

## C04-C06 — Round Board (not started this wave)

Round Board's own register rows. The brief instructs not to start Round Board's Gate C wave as
part of this one; nothing in the handoff bundle contradicts that, and no Round Board production
code or UI Lab route is touched by this PR.

## C08 — Round Board and Today joint scope (not started this wave)

Jointly owned by Round Board and Today; deferred alongside C04-C06 for the same reason — Round
Board's own Gate C wave has not started, and C08 cannot be done honestly without it.

## Tactics readiness in C03

Every C03 fixture uses `tactics.state: "UNKNOWN"` (see `DATA_TRUTH_AND_FIXTURES.md`) — there is
no canonical, distinctly-persisted tactics record to source a real `"READY"`/`"MISSING"` value
from (D7 "never invented"), so `resolveTodayMatchdayAction()`'s `MISSING_TACTICS` branch is not
exercised by this wave. This is a disclosed, accepted gap in capture coverage of that one
function branch, not a defect — the function itself is unchanged production code with its own
existing unit tests.

## No genuine Today production defect found

The audit in `CURRENT_STATE_AUDIT.md` found nothing in Today's own production code requiring an
ARR or GitHub issue.

## Pre-existing, unrelated finding surfaced by this PR: Visual Authority Gate reports B01/B01-AFTER/B02/B03/B04 as INVALID

This PR's own `Visual Authority Gate` check fails — not because of anything in Gate C, but
because evaluating it exposed a pre-existing issue in Gate B's already-merged, already-approved
candidates. Filed as
[issue #827](https://github.com/lagebj/matchboard/issues/827).

**Root cause:** `computeFingerprint()` hashes the *entire content* of each file in a scenario's
`componentOwners` list. B01/B01-AFTER/B02/B03/B04 (Gate B W1, PR #790) all list the shared
`src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` as a componentOwner. Every subsequent Gate
B wave (W2/B05 #805, W3/B06 #808, W4/B07 #811) correctly appended its own new, unrelated exports
to that same shared file — each addition silently invalidated B01-B04's already-approved
fingerprint, even though none of their own rendered output changed.

**Why this PR is the one surfacing it:** this PR touches `scripts/ui-lab-visual-review.mjs`
(registering the new Gate C routes), which matches the gate's `classify()` applicability rule
and triggers a full re-evaluation of *every* scenario in the repository's entire
`docs/ui-lab/**/candidate_manifest.json` registry — not just scenarios this PR's own diff
touches. This PR does not modify `match-b-fixture.ts` or any B01-B04 file; `git diff` between
B01-B04's approved commit and current `main` confirms their own componentOwner files are
byte-identical, only the shared file changed, and only because of later, unrelated Gate B waves.

**Disposition:** not fixed here — this is pre-existing drift on `main` predating this branch,
touching Gate B's own approved candidates, which this wave's own constraints explicitly forbid
reopening. Filed as a GitHub issue (not an ARR — one mechanism with a granularity defect, not two
competing implementations) rather than silently worked around. The owner needs to post a fresh
`/visual-approve <sha> scenarios: B01, B01-AFTER, B02, B03, B04` to clear it (their real rendered
output hasn't changed); Gate C's own scenarios remain `AWAITING_APPROVAL` independently of this.
