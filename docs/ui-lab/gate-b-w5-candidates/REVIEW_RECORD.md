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
6. **Disclosed, not attempted — Journey C (goal reversal) as a browser test.** A real, investigated
   timing characteristic in `LiveMatchClient`'s own event-reconciliation display
   (`getRecentEvents()`/`overlayPendingCommands()`) makes a reliable "click Undo on a just-recorded
   event" Playwright test genuinely risky without local verification (blocked by this devcontainer's
   documented HMR limitation). The identical claim is instead proven deterministically in
   `b08-projection.test.ts` — see `BLOCKERS.md` for the full reasoning. Journey D (duplicate/
   correction) is explicitly scoped by the review itself to "the fixture projection level" and is
   satisfied by the same test file.

Full detail: `BLOCKERS.md`'s "Second remediation" section, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
`DATA_TRUTH_AND_FIXTURES.md`, `SOURCE_RECONCILIATION.md`, `CHANGED_FILES.md`.

## Verification performed

- Component tests: `npx vitest run --config vitest.config.components.ts
  src/app/dev/ui-lab/gate-b/b08-information-ownership` → **7 files, 66+ tests, all passing**
  (component-test config required — a bare `vitest run` silently skips `.tsx` tests in this repo).
- Real browser (Playwright) tests: `e2e/ui-lab-b08.spec.ts`, 50 tests — navigation, lifecycle-state
  continuity (including the full LIVE-to-report journey), and a 5-scenario × 8-width (320-1440px)
  overflow matrix. **50/50 passed** in this PR's own CI run (workflow run 42473958417, 28.4s) — the
  first run (workflow run 42472630228) caught 4 real bugs in the spec itself (not the underlying
  fixes — see the commit history), all corrected and re-verified green. Not runnable in this
  session's own devcontainer (the already-documented local `next dev` + Playwright HMR WebSocket
  blocker).
- `npx tsc --noEmit -p .` — zero errors.
- `eslint`/`docs:check`/`terminology:check`/`architecture:check`/`deadcode:check` — zero errors on
  every changed file (repo-wide `eslint .` shows the same 3 pre-existing, unrelated warnings in an
  untouched file, confirmed unrelated).
- B05/B06/B07 + every TabRail consumer regression check: 645 existing tests re-run unchanged, all
  still passing (confirms the shared-component changes — `safe-post-match-report-shell.tsx`'s
  `backHref`/`backHrefForStatus`/`onStatusChange`, `match-after-match-panel.tsx`'s
  `reportHrefOverride`, `tab-rail.tsx`'s overflow containment — are all non-breaking).
- Real browser capture evidence: this PR's own "Capture fixture-backed UI Lab views" CI run
  (workflow run 42473958417, the POST-remediation run) produced 72 real screenshots across all 5
  scenarios, downloaded via `gh run download` and every SHA-256 independently recomputed from the
  raw bytes against the artifact's own manifest.json — zero mismatches. `capture-attestation.json`
  holds this real, verified, post-remediation evidence (superseding the earlier pre-remediation
  attestation from workflow run 42412296463). Four key screenshots were also visually inspected
  directly in this session, confirming the remediation's own fixes: B08-LIVE's clock now reads a
  real 15:00 (not the pre-remediation false 45:00), and B08-AFTER/-REPORT-DRAFT/-REPORT-COMPLETED
  all render with zero horizontal overflow at 320px — see `capture-attestation.json`'s own
  `knownLimitations` for the complete list.

No `/visual-approve` or `/visual-reject` has been posted on this PR by any coding agent. No
promotion to `APPROVED_GOLDEN` has been attempted — `approvalStatus`/`official_golden_status`
remain `CANDIDATE`/`NOT_READY` pending the owner's own Visual Authority review (ADR-0159).

**Disposition: `READY_FOR_INDEPENDENT_REVIEW`.**
