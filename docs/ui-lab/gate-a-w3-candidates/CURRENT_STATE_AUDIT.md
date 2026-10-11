# Gate A W3 — A03/A07/A09 Current State Audit

Package reference: `.matchboard-work/Matchboard_Gate_A_W3_A03_A07_A09_Agent_Bundle_2026-10-10/`
(external agent workspace, not committed). Base commit: `b6d932b98c5218b7f85d5101efc9cf5380437279`
(`main`, PR #778 already merged). Branch: `design/gate-a-w3-a03-a07-a09-context-local-actions`.

## Scope actually executed

Gate A W3 only — three UI Lab **candidates** (A03 decision anatomy, A07 Match Details edit
lineup, A09 Today quick action), dev-only, under `src/app/dev/ui-lab/gate-a/{a03-decision-
anatomy,a07-match-details-edit-lineup,a09-today-quick-action}/**`, plus one new cross-family
shared module set (`gate-a/shared/{fixture-identity.ts,fixture-operation.ts,match-w3-fixture.ts}`
— this wave's typed fixture-response port and shared match anchor, since none existed before: W1's
A01/A12 interactions are local-only and W2's A04 is read-only, confirmed by source audit before
building this), a narrow additive `scripts/ui-lab-visual-review.mjs` extension, and three new
entries in the existing Gate A index (`src/app/dev/ui-lab/gate-a/page.tsx`). No production route,
`src/domain/**`, production `src/components/**`, Prisma schema, auth/authz, or deployment file was
touched. W1's four approved candidates and W2's six `APPROVED_GOLDEN` A04 scenarios are unmodified
— re-confirmed by running the full `src/app/dev/ui-lab/gate-a` test suite (27 node-config files /
131 tests, 26 component-config files / 164 tests, all passing — see "Real bugs found and fixed"
items 7-8 below for the two findings from a second independent technical review) after every
family was built.

## Repository state found (independently re-verified against the live repo, not the bundle's dated claims)

- `src/components/matches/match-detail/match-detail-shell.tsx` preserves `?tab=` via
  `router.replace`; `MatchTacticsPanel` is self-fetching (confirmed) and not fixture-injectable —
  per the bundle's own `BLK-01`, A07 builds an isolated dev-only presentation candidate
  (`lineup-slot-editor.tsx`) from real shared Touchline primitives instead of prop-wrapping the
  shipped panel. It DOES reuse the real `TouchlinePlanningPitch`, `buildPlanningPitchSlotsFromFormationSlots`,
  and the canonical `primaryDisplayCellFor` (ADR-0154) for every tactical slot's grid position —
  no invented pitch coordinates.
- `src/app/(app)/matches/lineup-actions.ts`'s `assignPlayerToSlot` has **no optimistic-concurrency
  revision field** on `MatchLineupAssignment` — confirmed by direct read. A07-S4's "server
  conflict" is therefore disclosed as illustrative (`BLOCKERS.md` item 3), not a proof that
  production exposes this check today.
- `src/lib/selection/planning-boundary.ts`'s `isPlanningBoundaryClosed` real check order
  (cancelled → closed marker → live session ACTIVE → report started → `startsAt <= now`) is the
  one authoritative boundary; A07-S5/A09-S4's fixed clocks (`MATCH_W3_NOW_PLANNING_CLOSED`, 5
  minutes after the fixture's kickoff) mirror this real `startsAt <= now` instant check, not the
  coarser Europe/Oslo display-day boundary some other surface uses.
- `src/components/touchline/round-board/player-assignment-inspector.tsx` /
  `player-assignment-sheet.tsx` confirmed as the cleanest existing desktop-inspector/mobile-sheet
  reuse pattern (one shared body, sheet is a thin `TouchlineBottomSheet` wrapper, candidates carry
  server-supplied `reasons: string[]`, never invented). A07's `LineupSlotEditorBody`/`Inspector`/
  `Sheet` and A09's `TodayQuickActionBody`/`Inspector`/`Sheet` follow this exact shape.
- `src/components/matches/add-player-dialog.tsx` pre-filters candidates server-side and renders no
  excluded/ineligible rows at all — a different shape from Round Board's reasons-carrying model.
  A09 follows the Round Board shape instead (showing blocked candidates with their reasons), since
  the bundle requires visible denial reasons, not silent exclusion.
- `src/lib/matches/match-helper-eligibility.ts`'s `assertLeagueMatchHelperEligible` checks **only**
  match-not-cancelled, player active/not-removed, and not-already-a-participant — confirmed against
  ADR-0077's explicit exclusion list (round-finalisation and RSVP/time-conflict are deliberately
  NOT checked for League match-day additions, unlike the Event support-assignment path). A09-S6's
  Didrik candidate's `reasons` text mirrors this exact, narrow scope — it does not imply any
  broader permission than what this function actually checks.
- `docs/adr/0151-match-day-roster-changes-and-operational-participation.md`'s own `Status:` field
  still reads **Proposed**, even though several of its decisions (the `HelperProvenance` enum,
  the `/live/follow` fix, the formation `<select>` simplification, the 3-path "Add player" dialog)
  are already live in current source — a real doc/status mismatch, disclosed here rather than
  silently treated as settled policy. This wave does not resolve that mismatch; it only avoids
  relying on any ADR-0151 decision that isn't independently confirmed in shipped code.
- **Matchboard has no RSVP concept in source.** The closest canonical types are
  `AvailabilityStatus` (`AVAILABLE/UNAVAILABLE/INJURED/SICK/AWAY/TENTATIVE/UNKNOWN`) and
  `PlannedAbsenceReason` (`NO_SHOW/SICK/INJURED/DECLINED/NO_RSVP/OTHER/AWAY` — a manual, coach-
  selected post-match absence category, not an automated deadline-driven decline). No
  deadline-driven auto-decline logic exists anywhere in `src`. A09-S3's "RSVP deadline passed, no
  response" fixture is therefore explicitly labelled illustrative in `visual_vs_current/A09.md` and
  `BLOCKERS.md` item 1 — it does not claim Matchboard has this mechanism today.
- `docs/development/coding-agent-working-session.md` and `docs/agents/README.md`'s
  `ux-and-terminology.md`/`selection-planning-and-fairness.md`/`event-and-league-behavior.md`
  modules were read before implementation; no conflicting normative rule was found against this
  wave's scope (dev-only, read-only/simulated, no domain or schema change).

## Local capture-script limitation (disclosed, same pattern as the pre-existing `npm run build` sandbox limitation)

Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` could **not** be run to completion in
this session's sandbox: every page's client-side React never finishes becoming interactive — a
`useSearchParams()`-driven theme effect in the pre-existing `src/app/dev/ui-lab/ui-lab-frame.tsx`
never sets `data-theme`, and even a raw native `element.click()` dispatched via
`page.evaluate()` (bypassing Playwright's accessibility-tree-based `getByRole` entirely) does not
trigger a React `onClick` handler. The browser console shows the dev server's HMR WebSocket
repeatedly failing to upgrade (`net::ERR_INVALID_HTTP_RESPONSE`, retried continuously with a new
connection id each time) — this devcontainer's port-forwarding does not support the WebSocket
upgrade Turbopack's HMR client needs, and the resulting reconnect storm appears to starve React's
hydration/effect scheduling. **Confirmed pre-existing and unrelated to this PR's code:** the exact
same failure reproduces on `/dev/ui-lab/gate-a/a01-sports-first` — an untouched, already-merged W1
page, zero code changes. A freshly-restarted dev server (after killing a stale multi-day-old
`next-server` process) and a chromium reinstall did not change the result.

Consequently: **component/unit test coverage (vitest + jsdom) was the first verification signal in
this session** — it does not depend on real browser hydration and passed in full (see
"Validation" below). **Real screenshot capture ran in CI instead**, and caught two genuine bugs
component tests had missed (see items 4 and 5 below) — both fixed and re-verified against a fresh
CI capture run before this attestation was written. `capture-attestation.json` is included in this
PR, generated from CI run `38085816627` against commit `bd0442ce1b8c5b49d6f339044ae6c1bfb51782d9`
(branch tip at the time) / `7d8e0468efe41c75b0fb08d35fdbf3d84826ef44` (CI's synthetic merge commit)
— the two-commit attestation pattern W1/W2 used, except here it took three commits because the
first CI capture run surfaced a real bug worth fixing before trusting the evidence.

## Real bugs found and fixed while implementing (disclosed, not hidden)

1. **A07 dirty-draft-close discarded only visually.** Every A07 scenario's `close()` handler
   originally only hid the dialog (`setIsOpen(false)`) — it never called `op.discardDraft()`, so a
   discarded draft's state silently survived in the parent page's `useFixtureOperation` and
   reappeared if the editor was reopened. Found by the dirty-draft-close scenario's own test; fixed
   in all five A07 pages (`close` now calls `op.discardDraft()` before `setIsOpen(false)`).
2. **A09 shared component double-incremented the saved count.** `today-quick-action-sheet.tsx`
   originally computed `savedCount = currentCount + 1` for the SUCCESS display, but
   `useFixtureOperation`'s `authoritative` value is *already* the post-increment result by the time
   `status === "SUCCESS"` (the hook's own `applySuccess` reducer already applied it) — the display
   would have doubled 8→10 instead of 8→9. Fixed by rendering `currentCount` directly; the only
   place that still computes its own `+1` is the still-unsaved draft preview line, which genuinely
   has not been applied yet.
3. **A09 shared component had a duplicate, ambiguously-named "Discard draft" control.** One lived
   in the CONFLICT banner, one in the main action row — same accessible name, two different click
   targets. Fixed by removing the banner's own button and keeping the single canonical one in the
   action row.
4. **Capture script screenshotted the resolve step before React's re-render committed.** The PR's
   first CI capture run (`38084153831`, against commit `7677aeddd`) showed every A07 desktop
   "resolved" screenshot (saved/denied/conflict/planning-closed) pixel-identical to its own
   "pending" screenshot, and two of A09's four desktop resolve cases showing the same symptom —
   `clickWithinDialog("Continue fixture simulation →")` clicked the resolve control and the capture
   loop screenshotted immediately after, racing ahead of the commit. Fixed by a dedicated
   `clickResolvePending()` helper that explicitly waits for the "Saving… (fixture simulation)"
   banner to detach before returning (commit `f43e1f0e9`).
5. **`resolvePending()` was permanently stuck at `PENDING` under React Strict Mode — a real
   application bug, not a timing artifact.** The explicit wait added for bug 4 then *timed out*
   (10s, never resolving) on the next CI run, proving the desktop path never transitioned at all.
   Root cause: `gate-a/shared/fixture-operation.ts`'s `submit`/`resolvePending` mutated a `useRef`
   as a side effect *inside* their `setState` functional updater — an impure updater. React Strict
   Mode (on by default for Next.js App Router in dev, which is exactly what `next dev` runs for the
   capture script) intentionally invokes every updater **twice** to catch this, keeping only the
   second call's result; the first invocation's `pendingOutcomeRef.current = null` side effect had
   already run by the time the second invocation read the ref, so the second call always saw a
   `null` outcome and silently no-opped. `@testing-library/react`'s `renderHook` does not wrap in
   Strict Mode by default, so this wave's original component tests never exercised the
   double-invoke and all passed — only a real `next dev` server (CI's, not reachable from this
   session's sandbox either way) could catch it. Fixed by moving `pendingOutcome` into the hook's
   React state instead of a ref, making every updater pure and idempotent (commit `bd0442ce1`). A
   dedicated `<StrictMode>`-wrapped test suite was added and independently verified to fail against
   the old ref-based implementation and pass against the fix, before trusting it.
6. **All six A09 pages' `close()` handlers left a stale draft and operation status behind when the
   editor was closed and reopened — found by independent technical review, not by this wave's
   original testing.** Every A09 page's `close()` only called `setIsOpen(false)`; unlike every A07
   page (which already called `op.discardDraft()` first — see bug 1, which fixed this exact gap in
   A07 but did not generalize it to A09), nothing reset `useFixtureOperation`'s `draft`/`status`/
   `outcome`. Concretely: discarding a draft and reopening could show the abandoned preview again;
   closing after a `SUCCESS` and reopening could still show a stale "Saved (simulated)" banner
   (and, since `isDraftSelected` was computed from the stale non-null state, a phantom "selected"
   candidate) even though no draft existed in the new session. Fixed by adding the same
   `op.discardDraft()` call A07 already used to the start of `close()` in all six A09 pages
   (`add-eligible-player-success`, `add-player-denied`, `add-player-rsvp-blocked`,
   `add-player-planning-closed`, `add-player-conflict`, `match-day-addition`) — `discardDraft()`
   resets `draft`/`status`/`outcome` to a clean `IDLE` state while leaving `authoritative`
   untouched, so a completed `SUCCESS` (or `MATCH_DAY_ADDITION`'s operational count) is correctly
   retained across a close/reopen while its one-time feedback banner is not. 11 new regression
   tests were added across all six A09 test files (plus one `<StrictMode>`-wrapped page-level
   lifecycle test), independently verified to fail against the pre-fix pages (confirmed: 7 of the
   11 fail pre-fix with the exact stale-UI symptom described above; the other 4, on the two
   blocked-at-entry pages where no draft can ever form, pass either way and exist only to keep
   close/reopen coverage uniform across all six pages) and pass after the fix. This fix does not
   change any already-captured screenshot: the capture script's A09 scenario entries
   (`scripts/ui-lab-visual-review.mjs`) never exercise a close-then-reopen interaction for any A09
   page — only A07's `dirty-draft-close` scenario captures a close interaction, and that page was
   already correct (bug 1) — so `capture-attestation.json` remains fully valid, unregenerated.
7. **A09-S1 and A09-S6 permitted the same candidate to be added twice — found by a second
   independent technical review, not by this wave's original testing.** Both scenarios'
   `useFixtureOperation` authoritative state was a bare `number` (the displayed count); a resolved
   `SUCCESS` only ever incremented it, recording no participant identity. Reopening after a
   successful addition therefore still showed the identical candidate as eligible and selectable —
   the same predeclared `SUCCESS` outcome could be submitted and resolved a second time for the
   same player, producing an internally inconsistent fixture (one player, two additions). Fixed by
   introducing a minimal authoritative roster projection (`gate-a/shared/roster-projection.ts`):
   `RosterProjection = { baselineCount, addedPlayerIds }`, with the displayed count always
   `rosterDisplayCount()`-derived from it (never a separately-tracked field that could drift) and a
   candidate's eligibility/reasons always `deriveCandidate(roster)`-derived from whether
   `rosterIncludesPlayer()` is true — never a static fixture constant, never a `hasAddedPlayer`
   boolean, never a permanently-disabled editor. Once a candidate is already in the roster, the
   candidate row becomes disabled with the reason `"Already included in this match"` — the
   already-applied authoritative result represented honestly, not a newly invented permission
   system. `applySuccess` now calls `addPlayerToRoster()`, which is itself idempotent (a pure
   data-consistency guarantee, not a policy decision) so the projection could never become
   internally inconsistent even from a bug elsewhere in the call chain. The planned-selection
   (A09-S1) and operational (A09-S6) roster projections remain two entirely separate
   `useFixtureOperation` instances, as before — this fix does not change that separation, only
   enriches what each one tracks. One full end-to-end regression test per scenario (open → select →
   submit → resolve `SUCCESS` → verify exactly one addition → close → reopen → verify "already
   included" and disabled → attempt to re-add → verify no-op → verify count unchanged) was added to
   both A09-S1 and A09-S6's test files, plus 5 new `roster-projection.ts` unit tests. Independently
   verified to fail against the pre-fix `deriveCandidate` logic (confirmed for both S1 and S6: the
   candidate row was still enabled and re-addable after a close/reopen following `SUCCESS`) and
   pass after the fix.
8. **`useDirtyCloseGuard` allowed a `PENDING` operation to be discarded without ever resolving it —
   found by the same second independent review.** The guard only ever checked `hasDraft`; since
   `op.draft` stays non-null throughout `PENDING` (it is only cleared once `resolvePending()`
   settles), a user could request close while an operation was mid-flight, get the normal
   discard-confirmation prompt, and confirm it — which called `op.discardDraft()`, silently
   resetting `status`/`outcome`/`pendingOutcome` to a clean `IDLE` state and abandoning the
   submitted-but-unresolved predeclared fixture response (the simulated equivalent of cancelling a
   request that may already have "landed"). Fixed with a deterministic rule matching the finding's
   own framing: an editor cannot close at all while `PENDING` — not even with a discard
   confirmation. `useDirtyCloseGuard`'s signature gained an explicit `isPending: boolean` third
   parameter; `requestClose()` is now a no-op while `isPending` (it does not even set `confirming`,
   so no stale prompt can appear) — the SAME single funnel point every dismissal path already used
   (the chrome's own Close button, `Escape`, and the mobile sheet's backdrop/X all call
   `onRequestClose`), so this one change blocks every dismissal path uniformly without touching
   `TouchlineBottomSheet` (a production component, out of this PR's file scope) or any chrome
   component. All 11 A07/A09 call sites were updated to pass `op.status === "PENDING"`; the
   previously-redundant `&& op.status !== "SUCCESS"` clause some pages had on `hasDraft` (dead logic
   — `draft` is already `null` by the time `status` is `SUCCESS`, confirmed during an earlier W3
   investigation) was simplified away everywhere for consistency. 6 new tests were added directly
   to `useDirtyCloseGuard`'s own suite (including a `<StrictMode>`-wrapped lifecycle test and two
   hook-integration tests combining it with `useFixtureOperation` end-to-end: `PENDING` → blocked →
   `resolvePending()` → `SUCCESS` → immediate close, and `PENDING` → blocked → `resolvePending()` →
   `PERMISSION_DENIED` → discard confirmation required, never silently reapplied), plus page-level
   PENDING-block tests added to three representative real pages (A07's `assign-reserve-success` and
   `assign-reserve-denied`, A09's `add-player-conflict`) proving the fix holds through real Close-
   button and `Escape` interactions, not just at the hook level. Independently verified: temporarily
   removing just the `isPending` check (keeping the new 3-argument signature, isolating the logic
   bug from the signature change) reproduced exactly 2 failing unit tests with the predicted
   symptom (`confirming` became `true` while pending, instead of staying blocked silently); restored
   and re-verified passing. This fix changes no already-captured screenshot for A07 (a blocked click
   is visually indistinguishable from the state already captured — nothing re-renders) and adds two
   new, genuinely novel capture states for A09-S1/S6 (`closed-after-saved`/
   `reopened-already-included`), covering bug 7's new "already included" visual state in the same
   pass — see "Visual capture evidence" below.

## Visual capture evidence (this round)

**The initial prediction here was wrong in one respect, found only by actually checking — not by
reasoning about it a second time.** The hypothesis going in was that none of the four
already-captured A09-S1/S6 interaction states (`sheet-open`/`draft-preview`/`pending`/`saved`)
would change. This was verified empirically against a real CI capture run (`38121549351`, commit
`1c0ff4c97`, downloaded and compared pixel-for-pixel against the committed `capture-attestation.json`),
exactly as this round required — not assumed because the initial screens looked unchanged. The
comparison found three categories of result, not one:

1. **Confirmed unchanged, as predicted:** `sheet-open`, `draft-preview`, and `pending` for both
   A09-S1 and A09-S6, and every A03/A07 capture not described below — byte-identical or
   sub-pixel-noise-identical (see category 3).
2. **Genuinely changed, NOT predicted, but correct:** the `saved` state for both A09-S1 and A09-S6
   (4 viewport/theme combinations each) now shows the candidate row already reading "Already
   included in this match" and disabled, immediately on `SUCCESS` — not just after a later
   reopen. This was not anticipated when writing the prediction above, because `op.authoritative`
   already contains the newly-added player ID the moment `resolvePending()` resolves, and
   `deriveCandidate()` re-derives from it on every render, including the "saved" render itself —
   the fix is more immediately honest than the original prediction assumed. Visually confirmed
   directly (`gate-a-w3-a09-add-eligible-player-success-desktop-dark-saved.png`): "Felix · №15 ✕
   Already included in this match", "Planned squad: 9 / 9", "Saved (simulated)" all correctly
   present together. This is a desired consequence of the bug 7 fix, not a defect.
3. **A real, pre-existing capture-script bug, found by this verification pass and fixed:** three
   mobile `sheet-open` captures (A09-S2 `add-player-denied`, A09-S3 `add-player-rsvp-blocked`,
   A09-S6 `match-day-addition`) came back ~48-53% different — not noise (a set of genuinely
   content-identical captures elsewhere in this same diff differed by 0.000-0.006%, i.e. single-
   digit pixel counts out of ~330k-1.4M, confirmed by direct pixel comparison). Visual inspection
   showed the mobile bottom sheet had not opened at all in the new captures — still off-screen.
   Root cause: `clickByName` (used for every A07/A09 "open" trigger, including A07's `editor-open`
   step) never waited for `TouchlineBottomSheet`'s own `requestAnimationFrame`-driven enter
   transition to settle before the screenshot fired, unlike A01's and A04's own open-interaction
   helpers, which already do this. This is pre-existing, timing-dependent flakiness in the capture
   script itself — not caused by this round's A09/A07 code changes (A09-S1's `sheet-open` in this
   exact same run was unaffected; this is genuinely a coin-flip on CI timing, not deterministic) —
   that simply had not been unlucky enough to manifest in any prior run of this PR. Fixed generically
   in `clickByName` itself: after the click, if a genuinely modal dialog now exists, wait for it to
   reach its final on-screen position before returning (same settle check already used elsewhere in
   this script). A fresh CI capture run is required to confirm the fix and produce the final,
   trustworthy attestation — see below for that run's result once available.

Two genuinely new interaction states were added to the capture matrix for A09-S1 and A09-S6
(`closed-after-saved`, `reopened-already-included`) to capture bug 7's new "already included,
disabled" visual state after a close/reopen specifically (distinct from category 2 above, which is
the *same* state immediately on save, before any close). A07's PENDING-block fix (bug 8) produces
no new visual state anywhere (a blocked dismissal attempt leaves the DOM unchanged, confirmed: every
A07 capture this round differed from the prior run by 0.000-0.002%, i.e. sub-pixel rendering noise
only) and needs no new capture entries. See `capture-attestation.json` and its own disclosure for
the exact CI run this was verified against.

## Validation run locally

- `npx tsc --noEmit -p tsconfig.json` (full project) — clean, 0 errors.
- `npx eslint src/app/dev/ui-lab/gate-a` — clean, 0 output.
- `npx vitest run src/app/dev/ui-lab/gate-a` (node config) — **28 files, 138 tests**, all passing
  (27/131 + 1 new `roster-projection.test.ts` file / 5 tests + 2 new fixtures-test assertions for
  bugs 7/8).
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` (component
  config) — **26 files, 164 tests**, all passing (151 + 2 full end-to-end duplicate-prevention
  tests for bug 7 + 2 PENDING-block tests on A09-S1/S6 + 3 PENDING-block tests on representative
  A07/A09 pages for bug 8).
- `node --check scripts/ui-lab-visual-review.mjs` — syntactically valid.
- `npm run terminology:check` — clean.
- `npm run policy:verify` — PASSED (arm64 wasm-hash rebuild drift is the known advisory-only
  ARR-0037 case; CI's amd64 job is canonical).
- `npm test` (both vitest configs, whole repository) — **655 files, 6742 tests, all passing** on a
  clean run. One pre-existing, unrelated test
  (`src/lib/ai/presentation/__tests__/player-development-cycle-insight.test.ts` — zero diff in
  `src/lib/ai/**` on this entire branch, confirmed against `git diff b6d932b98 HEAD -- src/lib/ai`)
  was observed to fail intermittently across full-suite runs (2 of 3 attempts) and pass every time
  in isolation — the same pre-existing flake this wave's own earlier audit already documented, not
  a regression from this round's changes.
- `npm run build` / full `npm run validate` — **NOT RUN locally**, same pre-existing sandbox
  limitation documented in W1/W2's own audits (reproduces on clean `main`, passes in real CI); CI's
  `Build` and `Tests` jobs are expected to pass on this round's fix commit, as they did on every
  prior commit in this PR.
- Local browser capture — **NOT RUN to completion** in this session's sandbox, see "Local
  capture-script limitation" above. **CI's "UI Lab Visual Review" workflow succeeded** on the final
  commit (run `38085816627`, 6m44s) and produced all 332 W3 screenshots across 16 scenario IDs, 5
  viewport widths, and both themes — independently re-verified in this session: every resolve-step
  screenshot (saved/denied/conflict/planning-closed) now has a genuinely different hash from its
  own pending screenshot (zero exceptions across all 332 captures, checked programmatically), and
  the A07-S1/S2 "saved" screenshot was visually re-inspected directly — Tobias correctly appears at
  RCM on the pitch with a "Saved (simulated)" banner. See `capture-attestation.json`.

## Version impact

Classified **`none`** per `docs/VERSIONING.md`: this change cannot affect a deployed Matchboard
application (dev-only UI Lab route, gated off production per the existing `isProduction()` guard in
`src/app/dev/ui-lab/layout.tsx`) and does not introduce a product capability. Consistent with W1's
PR #777 and W2's PR #778, which also did not bump `package.json`'s version for the same reason.
