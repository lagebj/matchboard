# Match Details + Post-Match Report — exact-goldens conformance report

**Date:** 2026-09-18
**Scope:** `.matchboard-work/matchboard_match_details_exact_goldens_2026-09-18/` (ADR-0147).
**Status:** Implemented, merged into PR #617. All screenshots below are real captures against the
PR's own live Vercel Test-slot deployment (`https://test.matchboard.football`, seeded
`test-club-a` org, `coach-all-a` persona), not local fixtures — the exact same infrastructure
`e2e/*.spec.ts` uses in CI.

Golden references: `.matchboard-work/matchboard_match_details_exact_goldens_2026-09-18/references/
golden/source/*_CANONICAL.png` and `references/golden/crops/*.png`.

## Conformance table

| Screenshot | Golden reference | Composition | Density/Materials | Data truth | Notes |
|---|---|---|---|---|---|
| `before-overview-desktop-dark.png` | `03_match_details_before_planned_desktop.png` | PASS | PASS | PASS | Identity card + Match preparation side by side, facts strip, Planned lineup + Squad, Rotation/Opponent/Notes row — matches golden region layout exactly. Jersey icons neutral (no `Team.kitColor` set on this seed team) rather than the golden's illustrative colours — real, not fabricated. |
| `before-tactics-desktop-dark.png` | *(no golden authority for Tactics tab content — see ADR-0147 §7)* | PASS | PASS | PASS | Formation summary + Coaching intent + Match format, as designed. |
| `before-overview-mobile-light.png` | *(no exact mobile golden for Match Details — `09_RESPONSIVE_AND_INTERACTION_SPEC.md`)* | PASS | PASS | PASS | Light theme renders correctly; identity/action/preparation stack in the documented mobile order. |
| `after-overview-desktop-dark.png` | right half, `01_match_details_before_after_CANONICAL.png` | PASS | PASS | PASS | Captured against a real `played` (kicked-off, no report yet) match — a sparser case than the golden's fully-reported example, and an honest, non-fabricated demonstration of the empty state: `—` score, `0` facts, "No recorded events yet.", "Continue report" CTA. Structure (result card, facts strip, Final lineup / Key events / Player involvement row, Team reflection / Notes / Post-match report row) matches the golden exactly. |
| `after-events-desktop-dark.png` | golden's "Key events" region, same source | PASS | PASS | PASS | Truth-rule copy ("Canonical events first; stored goal minute is fallback. No inferred assist pairing.") renders as designed; honest empty state. |
| `after-overview-mobile-light.png` | *(no exact mobile golden for Match Details)* | PASS | PASS | PASS | Warning banner, badge, tabs stack correctly in light theme. |
| `post-match-draft-players-desktop-dark.png` | left half, `02_post_match_report_draft_completed_CANONICAL.png` (Players tab = the unchanged editor) | PASS | PASS | PASS | Real `REPORT DRAFT` badge, real 1-0 score, real attendance/goals/assists metric strip, and a genuine `GoalAttributionGapBanner` ("1 goal was recorded during live reporting, but only 0 have a scorer...") produced by the actual unattributed goal from live reporting — proves the integrity-banner reuse is real, not decorative. |
| `post-match-draft-summary-desktop-dark.png` | left half, same source, Summary tab | PASS | PASS | PASS | Attendance/Quick facts/Team reflection tiles, Timeline(goals) showing the goal as **`Unattributed`** rather than guessing a scorer, Player highlights honestly "None recorded yet" (no attributed goal/assist exists) — the timeline truth rule verified against real, imperfect live data, exactly the case the rule exists for. |
| `post-match-completed-summary-desktop-light.png` | right half, same source | PASS | PASS | PASS | Real `COMPLETED` badge, real "Completed 18 Sept 2026 by coach-all-a@test-agent.matchboard.football" line, tab set correctly swapped to `...Reflection \| Combinations` (Review is gone, as designed) — proves the DRAFT→COMPLETED transition renders correctly end to end, including the tab-pinning fix (ADR-0147 §1b). |
| `post-match-completed-summary-mobile-light.png` | mobile golden, right half of `02_...CANONICAL.png` | PASS | PASS | PASS | Score/badge/completion line/tabs stack correctly on mobile. |

## What this proves

- The full BEFORE → live reporting → DRAFT (with a real integrity gap) → COMPLETED lifecycle
  renders correctly end to end against a real deployment, real auth, and real database writes —
  not a mock.
- The timeline truth rule (never guess scorer/assist attribution) held under real, imperfect data
  produced by an actual live-reporting session, not just the unit tests' synthetic fixtures.
- The tab-pinning regression fixed in ADR-0147 §1b is confirmed visually: the Players tab (and its
  report editor) stays selected and visible through report completion, matching
  `e2e/post-match-evidence-parity.spec.ts`'s own real-UI proof.
- No Player of the Match, rating, or fabricated statistic appears anywhere across any captured
  state.

## Known gap

No golden visual authority exists for Match Details' mobile layout (only the two Post-Match
Report mobile states were supplied as exact goldens) — the mobile screenshots above are evidence
of correct responsive behaviour against the documented priority order
(`09_RESPONSIVE_AND_INTERACTION_SPEC.md`), not a pixel comparison against an exact reference.

## Provenance

Captured via a throwaway Playwright script (not committed — used the existing
`e2e/auth.setup.ts` credential-flow pattern and the existing `/api/test-agent/seed-finalized-match`
fixture endpoint, both already part of this repository's CI infrastructure) against PR #617's own
Test-slot deployment. Test data (`A1 Blues vs Screenshot Verify...`, `A1 Blues vs E2E Draft...`)
is disposable per-PR fixture data on the `pr-617` Neon branch, deleted when the PR closes.
