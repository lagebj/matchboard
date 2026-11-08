# Gate B W5 — Review Record (B08)

| Scenario | Status | Notes |
|---|---|---|
| B08-BEFORE | `CANDIDATE`, `approval: null` | Planned/ready composition, real live-entry CTA into B08-LIVE. |
| B08-LIVE | `CANDIDATE`, `approval: null` | Real, unmodified `LiveMatchClient` mounted with fixture-local actions; production League/Event adapters and realtime coordinator intentionally not mounted (disclosed). Follower summary now derived from the same event ledger as the reporter (P2-9). |
| B08-AFTER | `CANDIDATE`, `approval: null` | Applies the one real ownership correction found by this wave's own audit (§3, report-status widget); now renders both draft and completed variants via `?report=` (P1-5). |
| B08-REPORT-DRAFT | `CANDIDATE`, `approval: null` | Real `SafePostMatchReportShell`/`useSafeReportLifecycle`, B08's own fixture; genuine timing-review completion blocker; now journey-aware (P1-6). |
| B08-REPORT-COMPLETED | `CANDIDATE`, `approval: null` | Same real shell, seeded `LOCKED`; Combinations tab with independently-verified evidence. |

All five: `official_golden_status: NOT_READY` (`candidate_manifest.json`). This is the final Gate B
candidate wave (B01-B07 already shipped/merged; see `docs/ui-lab/gate-b-w1/w2/w3/w4-candidates/`).

## What this wave found and did about it

A full, field-by-field information-ownership audit of the current Match Details AFTER + Post-Match
Report composition (`INFORMATION_OWNERSHIP_MATRIX.md`) found **one** real, verified redundant
duplication on current production (unchanged by this wave): `AfterMatchOverview`'s own bottom-row
"Post-match report" widget duplicates the dedicated "After match" tab's own documented
report-status/integrity ownership. B08-AFTER's own candidate composition corrects this (lightened
to a status pill + link), with the correction both directly tested and visibly disclosed
(`VISUAL_VS_CURRENT.md`) so a reviewer doesn't mistake it for a capture bug. Every other
information-ownership pair audited (8 of 9) was already correct and is reproduced unchanged.

## Remediation (independent review of PR #822, 2026-11-08)

An independent review of the merged candidate found seven real defects that directly contradicted
B08's own stated purpose — truthful information and continuity between lifecycle workspaces — plus
judged unit/component tests insufficient proof for navigation, continuity, and layout claims. All
were fixed (not merely disclosed), and real browser (Playwright) coverage was added:

1. **LIVE clock showed ~45:00 instead of 15:00** (plus a false over-duration warning) — a
   double-counted `elapsedBeforeStartMs`. Fixed; verified with deterministic fake timers against the
   real `getElapsedMs()`/`formatElapsedMs()` functions.
2. **Live-event timestamps rendered as ~0:00** — `matchSeconds` is milliseconds, not seconds
   (confirmed against `LiveMatchClient`'s own doc comment and renderer). Fixed; literal
   production-contract values now asserted, not a self-comparison.
3. **Mobile horizontal page overflow** (up to 527px at a requested 320px) — `TabRail`'s pill variant
   had no width cap. Fixed additively; verified against all four real production call sites plus
   every Gate A/B wave (102 files, 645 tests), and with a real document.scrollWidth gate added to
   the capture script itself plus a 40-test Playwright width matrix.
4. **A completed report returning to Match Details still said "incomplete."** Fixed with an
   explicit `?report=completed` variant switch, verified end-to-end in a real browser.
5. **LIVE-to-report continuity was not real** — a recorded live event had no effect on the
   subsequent Report. Fixed with a real, bounded, sessionStorage-backed journey
   (`shared/b08-journey.ts`); verified in a real browser that finishing without recording the 48'
   winner shows a real 1-1 on REPORT-DRAFT, and recording it first (via the exact real "Goal for
   us" → "Skip" sequence `e2e/live-reporting.spec.ts` already proves safe in production) shows a
   real 2-1.
6. **`MatchAfterMatchPanel`'s secondary report link resolved outside the UI Lab.** Fixed with an
   additive `reportHrefOverride` prop (default preserves the exact prior production behavior).
7. **The reporter/follower score could silently disagree.** Fixed — the follower is now derived
   from the same event ledger as the reporter; proven with a real click against the real mounted
   `LiveMatchClient`.

One documentation claim was also corrected (not a code defect): "LIVE's Finish reporting does not
auto-navigate" was stale/wrong — `handleEndSession()` already navigates via the fixture's own
`reportUrl()`.

Full detail, file-by-file: `BLOCKERS.md`'s "Remediation" section,
`TRANSITION_AND_NAVIGATION_CONTRACT.md`, `DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`.

## Second remediation (independent review of PR #822, 2026-11-08, "lifecycle data consistency")

The first remediation pass made REPORT-DRAFT journey-aware but left AFTER and REPORT-COMPLETED
reading the static reference fixture regardless — a coach could finish LIVE with one result and see
a DIFFERENT one in Match Details, and the review's own words put it plainly: "B08 currently
maintains two competing interpretations of the match." Fixed with one shared, fixture-local
projection (`shared/b08-projection.ts`) that AFTER, REPORT-DRAFT and REPORT-COMPLETED now all read
from, via a three-tier priority cascade (persisted report → finished-journey seed → reference
fixture) — full detail in `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s "shared data-consistency
cascade" section. Specifically:

1. **One shared projection, not three independently-plausible pages.** `b08-projection.ts` derives
   score, goals/assists, and the real `MatchDetailAfterData`/`MatchPresentation` shapes from a single
   source, reused by all three downstream workspaces.
2. **Goal reversal (`Undo`) now applies correctly everywhere**, mirroring production's own
   `EVENT_REVERSED` filtering algorithm exactly (`computeEffectiveLiveEvents`) — proven with literal
   expected values, including a negative test confirming the two real correction-reference
   namespaces are genuinely distinct.
3. **Reference-only narrative content can no longer leak into an interactive journey's different
   match history** — reflection, football observations, opponent observation, and combination
   evidence come back empty/null in interactive mode; the Assistant Coach panel uses the real,
   already-production-modeled `{status: "unavailable"}` state instead of fabricating an insight
   against the wrong match.
4. **AFTER no longer lets its own `?report=` URL override a real, persisted report** — the URL only
   selects a presentation state in the no-journey (pure reference) tier.
5. **A real bug was caught and fixed during this pass, before it reached anyone:** a mount-time
   `onStateChange` fire would have silently started a persisted journey on a bare page visit
   (including every CI capture); a skip-first-render guard was added to
   `safe-post-match-report-shell.tsx`. A separate, already-landed test-isolation bug (jsdom's shared
   `sessionStorage` leaking between tests in one file) was also found and fixed.
6. **Disclosed at the time, since closed — Journey C (goal reversal) as a browser test.** A real,
   investigated timing characteristic in `LiveMatchClient`'s own event-reconciliation display
   (`getRecentEvents()`/`overlayPendingCommands()`) made a reliable "click Undo on a just-recorded
   event" Playwright test genuinely risky at the time. Journey D (duplicate/correction) was
   explicitly scoped by the review itself to "the fixture projection level" and was satisfied by
   `b08-projection.test.ts`. **Both are addressed in the third remediation below** — Journey C's own
   timing risk is now closed at the write boundary, not merely avoided.

Full detail: `BLOCKERS.md`'s "Second remediation" section, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
`DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`, `CHANGED_FILES.md`.

## Third remediation (independent review of PR #822, 2026-11-08, "final data-integrity remediation")

The second remediation's shared projection fixed cross-page consistency, but four real defects
remained, plus an explicit requirement to finally verify LIVE's own Undo through a real browser
interaction:

1. **Editing the reference report directly could discard the match's canonical event history.**
   `saveB08JourneyReport()` on a reference-mode edit (no LIVE journey at all) wrote `events: []` with
   no record of why — AFTER then derived an EMPTY timeline from it. Fixed with `historyOrigin`
   (`b08-journey.ts` v3) and a single resolver, `resolveB08EffectiveHistory()`, that every page now
   calls instead of deriving from a raw, ambiguous event array; `initialLiveEvents()` had the
   identical blind spot in reverse, fixed the same way.
2. **Reference-only debrief/observation/combination content could appear in interactive reports.**
   REPORT-DRAFT/REPORT-COMPLETED were passing the fixed reference literals to
   `SafePostMatchReportShell` unconditionally, bypassing `staticAfterData`'s own already-correct
   empty narrative. Fixed: both pages now choose by the same `historyOrigin`-derived flag the rest
   of the cascade uses.
3. **Fixture-local live-event recording was not idempotent.** `recordEvent()` always generated a
   fresh id and appended a new row, with no check against an already-accepted `clientEventId` — a
   genuine retry would have silently double-counted an event. Fixed to mirror production's own real
   "dedup-safe server-side by clientEventId" contract exactly.
4. **The shared report shell still contained B05-specific data when used by B08.** Hardcoded
   `b05MinutesByParticipant`/`b05ObservationCountByParticipant` maps, a literal
   `"report-gate-b-05"` report id, a literal `"debrief-gate-b-05"` debrief id, and a B05-specific
   team note — all unconditional, for every caller. Fixed with five new optional props, all
   defaulting to B05's exact existing values (B05 unaffected); B08 passes its own real equivalents.
5. **LIVE Undo is now verified through a real browser interaction (Journey C).** Closing it required
   finding and fixing a real, previously-only-investigated risk: `recordEvent()` now normalizes an
   `EVENT_REVERSED`'s `correctsEventId` to the real target id even when submitted against a
   not-yet-confirmed Recent Events row's `clientEventId` — the same normalization a real server would
   need to perform. Journey D (a direct reference-report edit) was also added, proving defect #1's
   fix end-to-end in a real browser.

Full detail: `BLOCKERS.md`'s "Third remediation" section, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
`DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`, `INTERACTION_AND_STATE_AUDIT.md`,
`CHANGED_FILES.md`.

## Verification performed (updated for the third remediation)

- Component tests: `npx vitest run --config vitest.config.components.ts
  src/app/dev/ui-lab/gate-b/b08-information-ownership` → **7 files, 82 tests, all passing**
  (component-test config required — a bare `vitest run` silently skips `.tsx` tests in this repo).
- Fixture/projection unit tests (default vitest config, `.ts`-only files): `npx vitest run
  src/app/dev/ui-lab/gate-b/b08-information-ownership` → **5 files, 66 tests, all passing**,
  including `b08-projection.test.ts`'s new `resolveB08EffectiveHistory` describe block (4 tests,
  defect #1) and `safe-transition-controller.test.tsx`'s new idempotence matrix (8 tests, defect #3)
  plus the `EVENT_REVERSED`/`clientEventId` normalization proof (defect #5).
- Real browser (Playwright) tests: `e2e/ui-lab-b08.spec.ts`, now **53 tests** (added Journeys C and
  D on top of the second remediation's 51) — Journey C records a goal and Undoes it through the real
  mounted `LiveMatchClient`, verifying reporter/follower agreement and downstream non-resurfacing;
  Journey D edits the reference report directly (no LIVE journey) and verifies the real chronology
  survives across REPORT-DRAFT/AFTER (including its Events/Stats tabs)/REPORT-COMPLETED/reload.
  **53/53 passed** in this PR's own CI run (workflow run 42525103572, 2.0m). Getting there took
  three real, disclosed fix-and-rerun cycles this pass (workflow runs 42520115677, 42521584617,
  42523466866) — each caught one genuine bug in the new Journey C test itself (not the underlying
  product code): the LIVE follower panel's own score text uses `MatchScoreHeader`'s real colon
  format ("1 : 1"), not `MatchIdentityCard`'s hyphen format ("1 - 1") used elsewhere; the
  just-recorded goal's own Recent Events row needed to be disambiguated from the seed's own
  identically-unattributed 10' goal by its known, fixed elapsed-time label ("10:00"), not by DOM
  order (which the local-overlay-vs-reconciled timing makes unreliable) — both fixed and
  re-verified green; see the commit history and `BLOCKERS.md`. Not runnable in this session's own
  devcontainer (the already-documented local `next dev` + Playwright HMR WebSocket blocker).
- `npx tsc --noEmit -p .` — zero errors.
- `eslint`/`docs:check`/`terminology:check`/`architecture:check`/`deadcode:check` — zero errors on
  every changed file.
- Full repo-wide regression: `npx vitest run --config vitest.config.components.ts` (152 files, 981
  tests) and `npx vitest run` (588 files, 6526 tests) — both all passing, confirming the shared
  shell's five new optional props (all B05-defaulted) are non-breaking across every consumer, not
  only B08's own.
- Real browser capture evidence: this PR's own "Capture fixture-backed UI Lab views" CI run
  (workflow run 42525103572, the POST-THIRD-remediation run) produced 72 real screenshots across all
  5 scenarios, downloaded via `gh run download` and every SHA-256 independently recomputed from the
  raw bytes against the artifact's own manifest.json — zero mismatches, zero missing files.
  `capture-attestation.json` holds this real, verified evidence (superseding the second remediation's
  attestation from workflow run 42509495683). The manifest's own `sourceCommitSha` (`7ee923ca`) was
  independently confirmed, via `git fetch origin pull/822/merge`, to be GitHub's own synthetic merge
  of this PR's actual branch-tip commit (`399b86d7`, recorded as `reviewedBranchHeadSha`) into
  `main`. This pass's own fixes change history-origin provenance, idempotent event recording, and
  narrative provenance — none of which affect any of these five pages' own default, no-journey,
  no-edit appearance; no visual difference from the second remediation's own already-inspected
  reference-mode screenshots was expected or found.

No `/visual-approve` or `/visual-reject` has been posted on this PR by any coding agent. No
promotion to `APPROVED_GOLDEN` has been attempted — `approvalStatus`/`official_golden_status`
remain `CANDIDATE`/`NOT_READY` pending the owner's own Visual Authority review (ADR-0159).

**Disposition: `READY_FOR_INDEPENDENT_REVIEW`.**
