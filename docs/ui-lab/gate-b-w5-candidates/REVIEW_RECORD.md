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

## Verification performed

- Component tests: `npx vitest run --config vitest.config.components.ts
  src/app/dev/ui-lab/gate-b/b08-information-ownership` → **7 files, 66+ tests, all passing**
  (component-test config required — a bare `vitest run` silently skips `.tsx` tests in this repo).
- Real browser (Playwright) tests: `e2e/ui-lab-b08.spec.ts`, 50 tests — navigation, lifecycle-state
  continuity (including the full LIVE-to-report journey), and a 5-scenario × 8-width (320-1440px)
  overflow matrix. Runs in CI only (this devcontainer's known `next dev` + Playwright HMR WebSocket
  blocker) — see this PR's own "Capture fixture-backed UI Lab views" CI run for real results.
- `npx tsc --noEmit -p .` — zero errors.
- `eslint`/`docs:check`/`terminology:check`/`architecture:check`/`deadcode:check` — zero errors on
  every changed file (repo-wide `eslint .` shows the same 3 pre-existing, unrelated warnings in an
  untouched file, confirmed unrelated).
- B05/B06/B07 + every TabRail consumer regression check: 645 existing tests re-run unchanged, all
  still passing (confirms the shared-component changes — `safe-post-match-report-shell.tsx`'s
  `backHref`/`backHrefForStatus`/`onStatusChange`, `match-after-match-panel.tsx`'s
  `reportHrefOverride`, `tab-rail.tsx`'s overflow containment — are all non-breaking).
- Real browser capture evidence: this PR's own "Capture fixture-backed UI Lab views" CI run
  produced real screenshots across all 5 scenarios, downloaded via `gh run download` and every
  SHA-256 independently recomputed from the raw bytes against the artifact's own manifest.json.
  `capture-attestation.json` holds this real, verified evidence — see that file's own
  `knownLimitations` for exactly what was additionally visually inspected, and `generatedAt`/
  `ciWorkflowRun` for the exact re-capture run this remediation's own fixes are reflected in.

No `/visual-approve` or `/visual-reject` has been posted on this PR by any coding agent. No
promotion to `APPROVED_GOLDEN` has been attempted — `approvalStatus`/`official_golden_status`
remain `CANDIDATE`/`NOT_READY` pending the owner's own Visual Authority review (ADR-0159).

**Disposition: `READY_FOR_INDEPENDENT_REVIEW`.**
