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

6. **Test defect (this agent's own new Playwright test): asserted the Promote button as enabled
   without ever recording a development focus.** The button is correctly disabled until the real
   focus `<input>` has text — the test's own assumption was wrong, not the production behavior.
   **Fixed**: the test now types into the real field first, and additionally asserts the
   pre-fill disabled state explicitly (stronger than the original intent). Confirmed fixed by the
   next CI run.
7. **Real defect: `AssistantCoachHypothesisPanel`'s header row (StatusPill + uncertainty label)
   and button row (Promote + Dismiss) are non-wrapping `flex` rows, and `TouchlineButton` always
   applies `whitespace-nowrap` to its label by design.** Overflowed a 320px viewport by 21px
   (`c07-assistant-coach-fallback/on @ 320px`) — pre-existing in production code (this component
   already ships on Player Detail), never triggered before because this wave is the first to
   mount it inside a narrow (320px) context-rail column at full page width. **First attempted
   fix was wrong**: adding `w-full min-w-0` to the development-focus `<input>` did not change the
   measured overflow at all (341/320, byte-identical before and after) — proof the input was
   never the actual cause, caught by rereading the next CI run's own numbers rather than assuming
   the first fix worked. **Corrected fix**: `flex-wrap` added to both the header and button rows,
   the actual non-wrapping flex content — a real, more probable culprit given `TouchlineButton`'s
   own always-on `whitespace-nowrap`. `w-full`/`min-w-0` kept on the input regardless, since it
   is still a correct, harmless constraint. **Confirmed fixed**: the next CI run
   (`https://github.com/lagebj/matchboard/actions/runs/45091046517`, commit `e99bd4f0`) passed
   the full Gate C Playwright suite, including this exact previously-failing test.

## Review pass 3 — external remediation review (2026-11-23)

The repository owner supplied a detailed, independently-authored remediation brief against this
PR's then-current head (commit `e99bd4f0`). This pass is genuinely independent of pass 1/2 above
— a different author, reviewing the finished artifact rather than the work-in-progress. Findings,
each verified against the actual code before being accepted as real:

8. **P1, confirmed real: C07-ON's Promote/Dismiss invoked the real, session-requiring Server
   Actions against a synthetic fixture id that has no persisted `AssistantCoachHypothesis` row.**
   Verified: `requirePageActorContext()` runs first in both actions and would hit a real,
   uncaught auth failure against `/dev/ui-lab`'s unauthenticated context, not the actions' own
   clean "hypothesis not found" path (which only applies to a *real session* with a *missing*
   row — this fixture has neither). **Fixed**: `AssistantCoachHypothesisPanel` gains an optional
   `actions` override (`AssistantCoachHypothesisActions`); production passes nothing, so the
   real actions still run unchanged. C07-ON supplies deterministic simulated handlers, discloses
   the simulated nature on-page, and both Vitest and Playwright assert zero real network/Server
   Action calls occur. See `C07_PRODUCTION_INTEGRATION_GAP.md`.
9. **P1, confirmed real: C08-A's browser-level quick-add journey was not demonstrated** — only
   a display-only fixture (whose own `applyRecommendation` handler always returns failure) plus a
   separate real-DB test existed; nothing connected the two as a single observable journey.
   Investigated building the stronger evidence (new test-agent seed infrastructure + the
   `acceptance` PR label to provision a real Test slot); found a real, pre-existing blocker
   (`e2e/round-mutation.spec.ts`'s own `test.skip()` for exactly this shape, due to Vercel
   serverless timeouts since the Next.js 16 proxy migration) and a real, non-trivial cost
   (Test-slot provisioning). Put the tradeoff to the repository owner directly rather than
   deciding unilaterally; the owner chose to document the limitation. **Disclosed, not
   fabricated**: `C08_OPERATIONAL_ACCEPTANCE.md` now marks this PARTIAL, not PASS, with the exact
   reason, and no scenario's docs claim browser-level proof anywhere in the wave.
10. **Confirmed real: C08-B conflated "after RSVP" with tentative availability**, and the
    acceptance report had marked the official register requirement PASS when only the adjacent,
    real mechanism had actually been tested. **Fixed**: the official "after RSVP" requirement is
    now explicitly marked BLOCKED (no such mechanism exists in the product at all) across
    `SCENARIO_REGISTER.md`, `C08_OPERATIONAL_ACCEPTANCE.md`, `BLOCKERS.md`, and the scenario's own
    page/fixture doc comments and UI copy; the tentative-availability coverage is retained and
    relabelled as disclosed supplementary evidence only, never as RSVP-deadline proof.
11. **Confirmed real: C08-D/E's "appropriate squad display"/"participation" requirements had
    real-DB evidence but no browser-level evidence**, and the prior disposition's PASS/BLOCKED
    split did not make that evidence-tier distinction explicit enough. **Fixed**: same
    documented limitation as finding 9 applies identically; `C08_OPERATIONAL_ACCEPTANCE.md`
    rewritten with an explicit evidence-tier disclosure section so a reader cannot mistake
    real-DB proof for a demonstrated user journey.
12. **Confirmed real: two production-code comments referenced e2e spec files that were never
    created** (`e2e/gate-c-w3-today-quick-add.spec.ts`, `e2e/gate-c-w3-match-day-additions.spec.ts`
    — found only in code comments in `c08-same-day-quick-add/page.tsx` and
    `planning-open/fixtures.ts`, not in any `.md` doc or `candidate_manifest.json`, per direct
    verification before editing). **Fixed**: both references corrected to point at the real
    evidence that exists (the real-DB integration tests), with the browser-level limitation
    stated explicitly in the same comment.
13. **Requirement, addressed by this very record**: a genuinely independent review pass, not
    implementing-agent self-review, was required. This pass (8-13) is authored by a different
    party than passes 1-2; a further, separate review-agent pass over the *final* diff (after all
    of 8-13's fixes) is recorded below once complete.

All of 8-12 verified against the real code before being treated as confirmed (never accepted on
the brief's word alone) — see the relevant doc files and code comments cited above for the exact
evidence each fix relies on.

## Verification run (this branch, after all fixes above)

- `npm run typecheck` — clean.
- `npm run lint` — clean (3 pre-existing warnings in `compute-plan-integrity.ts`, unrelated to
  this branch, unchanged).
- `npx vitest run --config vitest.config.components.ts` (full suite) — 176 files / 1129 tests
  passed.
- `npm test` (full node/real-DB suite) — passed.
- New/changed test files individually re-verified after every fixture/behavior correction above.

## Review pass 4 — genuinely separate review agent (2026-11-23)

A fresh review agent, with no prior involvement in this work and no shared context with passes
1-3, independently reviewed the full diff (`git log main..HEAD`, 8 commits at the time) and the
complete doc set, re-verifying every claim against the real code rather than trusting the docs'
own account — including running the real-DB integration tests itself (21/21 passed) and tracing
the live Visual Authority Gate's actual source (`scripts/visual-authority/resolve-approval.mjs`,
`fingerprint.mjs`) rather than assuming its CI status.

**Findings: no Critical, no Major.** One Minor/disclosure item, fixed:

14. This wave's C07 seam directly edits `today-surface.tsx`/`today-context-rail.tsx`, which are
    also `componentOwners` for the already-approved Gate C W1 scenarios (merged PR #826). CI's
    live Visual Authority Gate reports `AWAITING_APPROVAL` for those W1 scenarios on this PR —
    the reviewer traced the actual gate mechanism and confirmed this is the routine "no approval
    comment on this PR yet" backlog state (the same state untouched Gate B scenarios B05-B08 are
    also in), not a new instance of issue #827's whole-file-hash fingerprint-invalidation bug.
    **Fixed**: one disclosure paragraph added to `SOURCE_RECONCILIATION.md`'s #827/#830 section
    so the owner isn't surprised by this at merge/approval time.

Every other claim this remediation made — the C07 handler-separation mechanics, the C08
evidence-tier honesty, the RSVP-mechanism absence, the stale-reference fixes, and that issue
#842 was disclosed rather than quietly implemented — was independently verified true, not merely
restated. One wording precision nit was noted (the acceptance report's per-sub-requirement PASS
labels mean "this specific sub-item passed," never "this scenario passed overall" — already
consistent with how the table is structured, just worth stating explicitly here): no top-level
C08 scenario carries an unqualified PASS verdict anywhere in this wave's docs.

**Overall verdict (review pass 4): the remediation is genuinely sound and ready for owner
review.**

## Review pass 5 — real CI (post-remediation run)

CI's capture job on the remediation commit (`0790e515`/`d7935048`) caught a real defect the
passes above, including independent review pass 4, did not: **C07-ON's `assistantCoachContext`
(passed from the plain server `on/page.tsx` down into the client `GateCW3TodayMount`) carried a
plain, non-"use server" function via its `actions` field.** A Server Component's props to a
Client Component must be serializable; a plain function cannot cross that boundary. This threw a
real React Server Components error at render time, which manifested in CI as
`locator.waitFor: Timeout 30000ms exceeded` waiting for `.touchline[data-theme="dark"]` on the
C07-ON route (the page never finished rendering) — invisible to every jsdom component test in
this wave (including pass 4's own verification), because those tests render the page directly
and never cross the real server/client serialization boundary. This is the same class of bug
`today/page.tsx`'s own existing doc comment already warns about for Server Actions — confirmed
to apply equally to a plain function wrapped in a UI-Lab-only "simulate" object.

**Fixed**: the simulated confirm/dismiss handlers are no longer constructed in the server-side
`on/fixtures.ts`. They are now constructed inside `w3-shared/today-mount.tsx` (already
`"use client"`), activated via a new plain boolean prop (`simulateAssistantCoachActions`) instead
of a function value crossing the boundary. Verified locally by starting a real `next dev` server
(Playwright itself cannot run locally in this environment, but a plain HTTP fetch can) and
confirming all 8 C07/C08 routes return `200` with the real hypothesis content rendered and no
error text, where the C07-ON route previously would have thrown. Full component suite (176/1133)
re-verified clean. Final confirmation is still the next real CI run.

## Not yet done

- A final CI run reflecting this record's own latest commit, confirming the pass-5 fix, and
  `capture-attestation.json` committed from that specific run (never fabricated locally, never
  reused from an earlier, now-superseded run).
- Owner `/visual-approve` or `/visual-reject`, and merge — neither ever performed by this agent,
  under any framing.
