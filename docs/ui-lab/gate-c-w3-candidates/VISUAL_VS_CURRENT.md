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
- **Evidence:** component tests (6 files) and a real-browser Playwright suite
  (`e2e/ui-lab-gate-c.spec.ts`) pass, including explicit assertions that ON's Promote/Dismiss
  controls produce a truthful simulated success with zero real network requests fired (proving
  the real, session-requiring Server Actions are never invoked — see
  `C07_PRODUCTION_INTEGRATION_GAP.md`'s remediation finding). CI capture evidence: real, committed
  — `capture-attestation.json` is built from the first fully green CI run
  (`ui-lab-review-45133382324-1`, commit `20401088`), with every one of its 80 Gate C W3 hashes
  independently re-verified against the real downloaded files (`sha256sum`), not copied from the
  workflow's own self-report.
- **Deviation from register:** none — the register's own viewport/theme requirement (desktop +
  mobile) is exceeded, not merely met.
- **Owner-review readiness:** CANDIDATE, pending owner `/visual-approve`.

## C08-A/B/C (3 display-only fixture scenarios)

**Acceptance question (partial — the Today-side half):** "No route labyrinth; permission-specific
action, existing validation, accurate consequence."

- **Existing composition:** `TodaySelectionDecisions`/`TodayNextAction` unchanged — these fixtures
  exercise states the production code already produces; nothing was added to accommodate them.
- **Actual changes:** none to presentation code. The only production code changes were a guest
  cancelled-match guard (not reachable from these 3 scenarios) and the ADR-0151 status fix (a
  documentation edit).
- **Demonstrated state (display only — these routes never mutate; see below):** planning open
  (real one-click action shape), tentative availability (real review-first fallback with the real
  named reason), planning closed (real generic fallback). C08-B's fixture does **not** demonstrate
  an RSVP deadline — Matchboard has none; see `BLOCKERS.md`.
- **Evidence:** component tests pass (presentation only); real-DB integration tests in
  `today/__tests__/actions.test.ts` separately prove the underlying mutation/rejection behavior
  end-to-end against the real Server Action — but no authenticated browser journey connects the
  two. `C08_OPERATIONAL_ACCEPTANCE.md` marks every one of these PARTIAL, not PASS, for exactly
  this reason.
- **Owner-review readiness:** CANDIDATE, CI capture complete (`capture-attestation.json`),
  pending owner `/visual-approve`. A visual approval of these 3 fixtures would be an approval of
  their *display*, not of the real quick-add operational workflow.

## C08-D/E — no fixture route, no CI visual-review evidence, no browser-level evidence

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
- **No authenticated browser-level journey exists for either scenario** — see `BLOCKERS.md`'s
  "no authenticated browser-level evidence exists in this wave" section for the full, specific
  reason (the pre-existing `round-mutation.spec.ts` timeout precedent and the declined Test-slot
  provisioning request).
- Do not represent passing automated/integration tests as visual approval, and do not represent
  server-side correctness as a demonstrated operational user journey — neither is claimed here.

## Regression assessment

Full pre-existing Gate C/Today test suite (22 component test files / 105 tests before this wave;
176 files / 1133 tests across the whole component suite after this wave's final commit) passes
unmodified. Full node (real-DB) test suite passes. `npm run typecheck` and `npm run lint` are
clean (no new warnings). CI's full Gate C Playwright suite (covering W1/W2/W3 together) passed
164/164 on the final capture run (`ui-lab-review-45133382324-1`).
