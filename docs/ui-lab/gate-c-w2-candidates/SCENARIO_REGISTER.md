# Gate C W2 — Scenario Register

All three scenarios mount the real, unmodified production presentation components (`RoundBoard` and its full child tree) against deterministic fixtures, via the shared `RoundBoardFixtureHarness` (`src/app/dev/ui-lab/gate-c/w2-shared/round-board-fixture-harness.tsx`), never a re-implemented visual.

| ID | Route | Production components mounted | Viewports/themes captured | Interaction states |
|---|---|---|---|---|
| C04 | `/dev/ui-lab/gate-c/c04-planning-open` | `RoundBoard`, `RoundStatusStrip`, `RoundBoardRail`, `PlayerAssignmentInspector`, `PlayerAssignmentSheet` | Desktop dark, mobile dark | Default; player selected (inspector open); mobile sheet open |
| C05 | `/dev/ui-lab/gate-c/c05-planning-closed` | Same, plus the closed-state `DecisionBanner` path | Desktop dark, mobile light | Default (closed banner + retained warning); open-match player selected (valid action); closed-match player selected (read-only notice); mobile match-first drill-in |
| C06 | `/dev/ui-lab/gate-c/c06-dense-allocation` | Same, plus `AllocationMatrix` (desktop secondary mode) | Desktop light, mobile assigned sheet | Default (board view); Allocation view (dense matrix); player selected with Lineup link; mobile sheet open with a committed assignment |
| C06 (denied-assignment variant) | `/dev/ui-lab/gate-c/c06-dense-allocation/denied-assignment` | Same as C06 | Desktop, mobile | A real, reachable route for the deliberately-rejected cross-team assignment (independent review P1-07 — this needed to be a genuine browser-testable route, not only exercised at the component-test layer) |

## Edge cases (exercised as fixture-builder-function variants, not separate routes — per the brief's own instruction)

- **C04**: `buildC04NoEligiblePlayersFixture` (zero eligible players — no division by zero), `buildC04AllAssignedFixture` (every eligible player covered), `buildC04SeveralMissingFixture` (three players missing an opportunity across two teams, never collapsed into one row).
- **C05**: `buildC05ClosedNoWarningFixture` (closed round, nothing unresolved), `buildC05FullyOpenControlFixture` (control case — a fully open round where Resolve is genuinely valid), `buildC05OpenMatchWarningFixture` (a match-only warning on a still-open match — Resolve routes into that match's own context), `buildC05InsufficientIdentityFixture` (a warning with neither a player nor a match identity — fails safe to read-only).
- **C06**: `buildC06WithDeniedAssignmentFixture` (a deliberately rejected cross-team assignment — proves the UI never shows a successful result before a real accepted one; also exposed as its own route, above).

Each variant has direct component-test coverage in its scenario's `__tests__/page.test.tsx` (24 tests total across the three scenarios after the remediation pass: 6 C04 + 12 C05 + 6 C06) plus real-browser coverage in `e2e/ui-lab-gate-c.spec.ts` (29 new Playwright tests under the `ui-lab-gate-c` project, run locally against `next dev` and in CI). See `VISUAL_VS_CURRENT.md` for what each proves and `CURRENT_STATE_AUDIT.md` item 5 for the one genuinely untestable edge case (a closed round's allocation matrix, which the production component makes structurally unreachable).
