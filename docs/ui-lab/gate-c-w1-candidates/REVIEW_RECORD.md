# Gate C W1 — Review Record

## Disposition

`READY_FOR_INDEPENDENT_REVIEW`

## Summary

Two rounds of independent review of PR #826 found, in total, five genuine production defects
and three fixture-integrity gaps.

**First round:**
- **P1-01** — the quiet-day hero could render alongside a real Matchday action, contradicting it.
- **P1-02** — "Today in order" never showed on a quiet-composition day.
- **P1-03** — squad readiness and carry-forward could render twice.
- **P2-01/P2-02/P2-03** — fixture clock, href scoping, and duplicate-suppression test rigor.
- **G-01** — a pre-existing, unrelated Visual Authority Gate fingerprint-staleness defect
  (issue #827), correctly left out of scope.

**Second round found that the P1-03 fix itself introduced two new defects:**
- **P1-04** — organisation-wide squad availability (`getOrgActivePlayerAvailability()`)
  disappeared whenever a Matchday anchor existed, because P1-03's condition wrongly treated "a
  Matchday anchor exists" as proof this fact was shown elsewhere. It wasn't — Matchday's own card
  shows a different fact (match-specific selected-squad readiness).
- **P1-05** — carry-forward items beyond the first were silently dropped on quiet days, because
  P1-03's condition suppressed the context rail's entire collection instead of just the one item
  the quiet-day hero already features inline.

**All findings across both rounds are now fixed.** The corrected rule distinguishes "the same
fact shown twice" (suppress) from "a related but different-scope fact, or a different item from
the same collection" (keep both visible) — see `INFORMATION_OWNERSHIP_MATRIX.md` for the explicit
classification.

## A. Finding P1-04

**Correction:** `today-surface.tsx`'s `contextRailSquadStatus` is now suppressed only when
`compositionState === "QUIET" && !matchdayContext` (the one case where the quiet-day hero is
genuinely showing the identical org-wide fact inline) — not whenever any Matchday anchor exists.
`today-context-rail.tsx` gained an optional `squadStatusTitle` prop (forwarded to the existing
`SquadReadinessWidget`'s own `title` override, no new widget), set to `"All active players"`
whenever a Matchday anchor exists, to disambiguate the two readiness views on the same page.
**Affected files:** `today-surface.tsx`, `today-context-rail.tsx`. **Test evidence:** 6 new
tests in `today-surface.matchday-quiet-composition.test.tsx` (all four quiet/decision ×
with/without-Matchday combinations, a missing-data case, and a Live Now/Matchday-exclusivity
regression), plus a new real-candidate test in C03 league/prepare and two new Playwright tests
(desktop + mobile) in `e2e/ui-lab-gate-c.spec.ts`. All use deliberately different org-wide
(28 available) vs. match-specific (e.g. 10 available · 1 doubtful) numbers.

## B. Finding P1-05

**Correction:** `today-surface.tsx`'s `contextRailCarryForwardItems` is now
`carryForwardItems.slice(1)` whenever `compositionState === "QUIET"` (the complement of the one
item `TodayQuietState`'s own unchanged `.slice(0, 1)` features), rather than an empty array. The
underlying adapter (`buildTodayCarryForwardItems()`) and its ordering are unchanged. **Affected
files:** `today-surface.tsx` only. **Test evidence:** 7 new tests covering zero/one/two/three
items across quiet (with and without Matchday) and decision composition, using distinct item
labels so a count-only assertion could not mask a dropped or duplicated item; C01's own fixture
now carries three items (was one), with 2 new component-test assertions and 2 new Playwright
tests (desktop + mobile).

## C. Regression results — prior remediation intact

- Matchday consistency (P1-01): unchanged, still passing (6 tests from the first remediation
  pass, re-run clean).
- Same-day chronology (P1-02): unchanged, still passing.
- Deterministic fixtures (`GATE_C_NOW_ISO`): unchanged.
- Organisation-scoped navigation (P2-02): unchanged.
- Identity-based decision suppression (C02, P2-03): unchanged — C02's fixture, tests, and
  manifest entry are untouched by this pass (no Matchday anchor, no squad/carry-forward props).
- Fixture safety: unchanged — `applyRecommendation` still always denies.

## D. Production changes

- `src/components/touchline/today/today-surface.tsx` — corrected the two P1-03 suppression
  conditions (see A/B above).
- `src/components/touchline/today/today-context-rail.tsx` — new optional `squadStatusTitle`
  prop only; no behavior change when omitted.

No other production file changed in this pass.

## E. Fixture and browser evidence

- `npm run typecheck` / `npm run lint` — clean.
- `npm test` — 593+163 files, 6573+1039 tests, all passing.
- `npx playwright test --project=ui-lab-gate-c` — 62/62 passing locally (58 prior + 4 new).
- Full local run of `scripts/ui-lab-visual-review.mjs` across every gate — 0 errors.
- Real CI capture run and regenerated `capture-attestation.json` — see the commit that adds it;
  not fabricated ahead of that run, and the prior revision's evidence is not reused since
  rendering genuinely changed again (C01 and all six C03 candidates).

## F. Governance status

A PR comment posted by this remediation (the completion report for the *first* round) triggered
a Visual Authority Gate re-evaluation that failed with `INVALID: comment pagination incomplete,
failed closed` — a transient GitHub API issue, not a structural one (the PR has only 6 comments,
well within normal pagination limits, and the account's API rate limit had ample headroom at the
time). This is a governance API problem, not a failed visual review, and is reported here
separately rather than conflated with a technical-check failure. The next evaluation (triggered
by this commit) is expected to succeed cleanly again, matching every evaluation before and after
the one transient failure; its actual result is reported in the PR's own check status at review
time, not asserted here in advance. No `/visual-approve`/`/visual-reject` is posted by this
remediation. Issue #827 remains open and untouched.

## G. Remaining limitations

- Tactics readiness is fixed at `UNKNOWN` in every C03 fixture — unchanged, disclosed in
  `BLOCKERS.md`.
- C07, C04-C06, and C08 remain out of this wave's scope — unchanged, disclosed in `BLOCKERS.md`.
- Issue #827 remains open and tracked separately.
- The transient comment-pagination failure noted in §F is not something this remediation can fix
  (shared Visual Authority Gate infrastructure) — if it recurs persistently rather than
  transiently, it would warrant its own separate governance investigation, not a fix bundled
  into this candidate remediation.

## H. Disposition

`READY_FOR_INDEPENDENT_REVIEW`
