# Gate C W3 — Visual vs Current

## C07 (5 scenarios)

**Acceptance question:** "Same priority and layout when OFF; only material contextual synthesis
when ON."

- **Existing composition:** Today's production composition (`TodaySurface`) is completely
  unchanged in every respect except one new, optional, appended context-rail section.
- **Actual changes:** OFF/EMPTY render nothing — pixel-identical to today's real Today (confirmed
  by passing component tests asserting absence of any Assistant Coach text). ON renders one real
  hypothesis card below the existing four context-rail widgets, never reordering them. ERROR/STALE
  render the real, already-shipped degraded-state components (`AdvisorPanelUnavailable`/
  `AdvisorPanelStale`), identical in presentation to how Round Board/Match Insights already use
  them elsewhere.
- **Demonstrated state:** all 5, desktop + mobile + narrow + two smoke widths, light + dark.
- **Evidence:** component tests (6 files, Vitest/jsdom) pass; CI capture evidence pending the
  first real CI run of this PR (see `candidate_manifest.json`/`capture-attestation.json` note).
- **Deviation from register:** none — the register's own viewport/theme requirement (desktop +
  mobile) is exceeded, not merely met.
- **Owner-review readiness:** CANDIDATE, pending CI capture + owner `/visual-approve`.

## C08-A/B/C (3 fixture scenarios)

**Acceptance question (partial — the Today-side half):** "No route labyrinth; permission-specific
action, existing validation, accurate consequence."

- **Existing composition:** `TodaySelectionDecisions`/`TodayNextAction` unchanged — these fixtures
  exercise states the production code already produces; nothing was added to accommodate them.
- **Actual changes:** none to presentation code. The only production code changes were a guest
  cancelled-match guard (not reachable from these 3 scenarios) and the ADR-0151 status fix (a
  documentation edit).
- **Demonstrated state:** planning open (real one-click action), tentative availability (real
  review-first fallback with the real named reason), planning closed (real generic fallback).
- **Evidence:** component tests pass; real-DB integration tests in `today/__tests__/actions.test.ts`
  prove the underlying mutation/rejection behavior end-to-end (not just the display).
- **Owner-review readiness:** CANDIDATE, pending CI capture + owner `/visual-approve`.

## C08-D/E — no CI visual-review evidence; real authenticated Server Action evidence instead

Per `BLOCKERS.md`, `AddPlayerDialog` cannot be meaningfully fixture-mounted, so it has no
`/dev/ui-lab` route and is not part of this PR's CI screenshot capture. Its evidence is:

- Real-DB integration tests (`league-match-guest-actions.test.ts`, new; `match-helper-actions.test.ts`,
  pre-existing) exercising the actual `addLeagueMatchHelperAction`/`addLeagueMatchGuestAction`/
  `createAndAddMatchGuestAction` Server Actions against a disposable test Postgres database —
  genuine persistence, genuine authorization checks, no mocks on the mutation layer.
- `AddPlayerDialog` itself is unmodified production code, already reachable today on the real
  Match Details page — this wave did not build a new UI for it, so there is no new visual surface
  requiring a golden capture; the `AddPlayerDialog`/Tactics-tab visual surface, if it needs its own
  future golden reference, is a separate concern from this wave's scope.
- Do not represent passing automated/integration tests as visual approval — none is claimed here.

## Regression assessment

Full pre-existing Gate C/Today test suite (22 component test files / 105 tests before this wave;
176 files / 1129 tests across the whole component suite after) passes unmodified. Full node
(real-DB) test suite passes. `npm run typecheck` and `npm run lint` are clean (no new warnings).
