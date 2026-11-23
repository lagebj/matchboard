# Gate C W3 — Review Record

## Review pass 1 — implementing-agent self-review (this branch, before PR open)

Unlike W1/W2, this wave's review pass was performed by the same coding-agent session that wrote
the implementation, not a separate independent reviewer — disclosed explicitly rather than
presented as an independent pass. A genuinely independent review happens through this
repository's normal PR review process before merge (technical review, CI, and the owner's
Visual Authority review — none of which this agent can substitute for or skip).

Findings from this self-review pass, in the order discovered:

1. **Regression: a new static import broke every existing Today-rendering component test.**
   Adding `TodayAssistantCoachPanel`'s import chain to `today-surface.tsx` transitively pulled in
   `assistant-coach-actions.ts` (a real Server Action module), whose own transitive dependency
   resolves to `next-auth/lib/env.js`'s `import "next/server"` — a path Vitest's jsdom resolver
   cannot resolve, though Next's real bundler can. This broke C01-C03's and the production
   `today-surface.*.test.tsx` suite (13+ files) before being caught by re-running them explicitly.
   **Fixed**: a global mock for that module added to `src/test/setup-component.ts`, matching the
   file's existing convention of stubbing jsdom-incompatible browser/server APIs once. Verified
   the pre-existing per-test local mock (`assistant-coach-hypothesis-panel.test.tsx`) still
   overrides it correctly, and reran the full component suite (176 files / 1129 tests) clean.
2. **Incorrect assumption: TENTATIVE availability still produces a one-click recommendation.**
   The first draft of the C08-B fixture assumed `directlyActionable: true` for a tentative player.
   A real-DB test written against the actual planner failed with
   `directlyActionable: false, unavailableReason: "Player availability is tentative — review
   before assigning."` — the real planner's `eligible` check requires exactly `"AVAILABLE"`.
   **Fixed**: fixture, test, and this doc set corrected to the real, verified behavior.
3. **Incorrect assumption: a closed-boundary recommendation carries an explanatory reason.**
   The first draft of the C08-C fixture invented an `unavailableReason` string mirroring
   `isPlanningBoundaryClosed()`'s message. Reading `today-selection-recommendation-plan.ts`
   directly showed the real planner never reaches that branch for a closed-only destination —
   `resolveTarget()` returns `null`, so `recommendation` is `null` entirely, falling back to the
   plain default text. **Fixed**: fixture and test corrected; disclosed as a (non-defect)
   observation in `BLOCKERS.md` rather than silently "fixed" to match the wrong assumption.
4. **Real defect found while building C08-D against real guest actions.** No cancelled-match
   guard existed for guest-add, unlike the equivalent real-Player path. **Fixed** in production
   code (`requireMatchNotCancelled()`), with a new regression test.
5. **Real gap found while verifying C08-D/E's "lineup workflow participation" requirement.**
   Guests are entirely absent from the live-reporting pre-match package. **Disclosed, not fixed**
   (too large for this wave's scope) — filed as issue #842, with a regression test documenting
   current behavior so the gap cannot silently regress further or be silently "fixed" by accident
   without the test flipping to alert whoever does fix it.

## Review pass 2 — real CI (PR #843's first run)

CI genuinely independently caught two findings this agent's own local verification could not —
Playwright against a real browser (`next dev` build, not jsdom) in CI, where this devcontainer's
own HMR/hydration limitation blocks running Playwright locally (see memory note
`project_devcontainer_hmr_websocket_blocks_playwright`):

6. **Real defect: `AssistantCoachHypothesisPanel`'s development-focus `<input>` has no width
   constraint.** Inside a flex column, a plain `<input>` keeps its browser-default intrinsic
   width and refuses to shrink below it, overflowing a 320px viewport by 21px
   (`c07-assistant-coach-fallback/on @ 320px`). Pre-existing in production code (this component
   already ships on Player Detail) — never triggered before because this wave is the first to
   mount it inside a narrow (320px) context-rail column. **Fixed**: `w-full min-w-0` added to the
   input's className.
7. **Test defect (this agent's own new Playwright test): asserted the Promote button as enabled
   without ever recording a development focus.** The button is correctly disabled until the real
   focus `<input>` has text — the test's own assumption was wrong, not the production behavior.
   **Fixed**: the test now types into the real field first, and additionally asserts the
   pre-fill disabled state explicitly (stronger than the original intent).

Both fixes verified locally (full component suite, 176 files / 1129 tests, clean;
`npm run typecheck`/`lint` clean) and pushed in a follow-up commit; awaiting the next CI run for
final confirmation, since Playwright itself cannot be run locally in this environment.

## Verification run (this branch, after all fixes above)

- `npm run typecheck` — clean.
- `npm run lint` — clean (3 pre-existing warnings in `compute-plan-integrity.ts`, unrelated to
  this branch, unchanged).
- `npx vitest run --config vitest.config.components.ts` (full suite) — 176 files / 1129 tests
  passed.
- `npm test` (full node/real-DB suite) — passed.
- New/changed test files individually re-verified after every fixture/behavior correction above.

## Not yet done (owner-review process, not an implementing-agent action)

- CI's `ui-lab-visual-review.yml` real capture run (produces `capture-attestation.json`, committed
  in a follow-up commit once available — never fabricated locally).
- Owner `/visual-approve` or `/visual-reject` — never posted by this agent, under any framing.
- A genuinely independent second reviewer's pass through this repository's normal PR review.
