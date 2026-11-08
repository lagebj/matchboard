# Gate B W5 — Visual vs. Current Production (B08)

**Updated for the W5 FOURTH remediation (independent review, 2026-11-08, "final source-of-truth
remediation").** Like prior passes, this pass's fixes (narrative provenance for a reference-origin
report, history-origin write-boundary rejection) change what a reference-origin EDIT shows, or what
happens when an incompatible LIVE recording is attempted; they do not change the five pages' own
default, no-journey, no-edit appearance. Every CI capture runs in a fresh browser context with no
`sessionStorage` journey at all, so no visual regression to the registered capture matrix is
expected from this pass, and the third remediation's own capture evidence below remains the valid
record for that matrix pending this pass's own CI re-run (see `BLOCKERS.md`/`REVIEW_RECORD.md` for
this pass's own CI status at time of writing). `e2e/ui-lab-b08.spec.ts` gained Journey F and
Journey D's extended reflection assertions this pass, see `TRANSITION_AND_NAVIGATION_CONTRACT.md`.

A fresh, POST-third-remediation capture run (workflow run 42525103572, the PR's own synthetic merge
commit `7ee923ca` over branch-tip `399b86d7`) produced 72 real screenshots, all independently
re-hashed from the raw bytes with zero mismatches and zero missing files, superseding the second
remediation's own attestation (workflow run 42509495683). As expected, no visual regression was
found — every CI capture runs in a fresh browser context with no `sessionStorage` journey at all,
so each page resolved to the exact same reference-fixture tier as before that pass. The same CI run
also executed the full, then-53-test Playwright suite (`e2e/ui-lab-b08.spec.ts` — Journeys C and D
were added that pass), all 53 passing.

A fresh, POST-second-remediation capture run (workflow run 42509495683, the PR's own
synthetic merge commit `1c80e04a` over branch-tip `d62575b2`) backs an earlier attestation
generation — 72 real screenshots, all independently re-hashed from the raw bytes with zero
mismatches and zero missing files, superseding the first remediation's own attestation (workflow
run 42473958417). As expected, no visual regression was found in that pass either — every CI
capture runs in a fresh browser context with no `sessionStorage` journey, so each page resolved to
the exact same reference-fixture tier of the shared cascade as before that pass. That CI run also
executed the full, then-51-test Playwright suite (`e2e/ui-lab-b08.spec.ts` — Journeys A/B/E were
added that pass), all 51 passing.

A fresh, POST-first-remediation capture run (workflow run 42473958417, commit d81c3800) backs the
prior attestation generation — 72 real screenshots, all independently re-hashed with zero
mismatches, superseding the earlier pre-remediation run (workflow run 42412296463). Visually
confirmed in that session: B08-LIVE's clock reads a real 15:00 (not the pre-remediation false
45:00); B08-AFTER/-REPORT-DRAFT/-REPORT-COMPLETED all render with zero horizontal overflow at 320px.
That same visual record remains valid for this pass's own (expected-identical) reference-mode
screenshots — see `capture-attestation.json`'s own `knownLimitations` for exactly what was and
wasn't re-inspected visually this pass.

Real browser screenshot evidence for B08 comes from this PR's own CI run of the "UI Lab Visual
Review" GitHub Actions workflow (`scripts/ui-lab-visual-review.mjs`, 5 scenario entries registered
this wave — `candidate_manifest.json`/`capture-attestation.json`), **not from this local session**.
Local `next dev` + Playwright cannot hydrate pages in this devcontainer (a known, pre-existing
environment constraint: the HMR WebSocket upgrade fails/retries forever, reproducing even on
untouched pages — not something this wave introduced). The W5 remediation adds a real
`document.scrollWidth` overflow gate directly in the capture script (fails the run for any Gate B
scenario that overflows its viewport) and a separate, real-browser Playwright suite
(`e2e/ui-lab-b08.spec.ts`, 50 tests) running against the same local server in the same CI job — see
`INTERACTION_AND_STATE_AUDIT.md`.

## The one intentional visual difference from live production — do not mistake for a capture bug

`after/page.tsx`'s bottom-row "Post-match report" widget is **deliberately lighter** than today's
live production `AfterMatchOverview`: it shows a status pill plus a single link only, where
production's own current widget additionally repeats the team-reflection status and a
"Continue/View" CTA that the dedicated "After match" tab already owns in full (the verified,
field-by-field duplication finding in `INFORMATION_OWNERSHIP_MATRIX.md` §3). This is a **candidate
composition correction**, not a production change — nothing in `main`'s own `AfterMatchOverview` was
touched. A reviewer comparing a B08-AFTER screenshot against today's real Match Details AFTER page
should expect this one widget to look different and smaller; every other panel on the page (Match
story, Key figures, coaching-intent review, Assistant Coach, final lineup) is the real, unmodified
production composition and should look identical.

## Everything else on all five pages is the real production composition

No other panel, tab, or widget across BEFORE/LIVE/AFTER/REPORT-DRAFT/REPORT-COMPLETED was
redesigned for this wave — see `SOURCE_RECONCILIATION.md` for the full reuse-vs-substitute ledger by
page. Any other visual difference a reviewer notices against live production is either a genuine
fixture-data difference (this is a synthetic match, not a real one) or a defect to report, not an
intended design change.

## Capture matrix as registered — matches the 72 real captures produced

| Scenario | Standard viewports × themes | Extra widths | Interaction states |
|---|---|---|---|
| B08-BEFORE | 320/390/1440 × dark/light (6) | 360/430 (+4) | — |
| B08-LIVE | 320/390/1440 × dark/light (6) | 360/430 (+4) | — |
| B08-AFTER | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | — |
| B08-REPORT-DRAFT | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | `resolved-completion-transition` (desktop+mobile × 2 themes) |
| B08-REPORT-COMPLETED | 320/390/1440 × dark/light (6) | 360/430/600/768/900 (+10) | — |

AFTER and both Report pages get the wider 600/768/900px smoke set (the same tab-rail/dense-layout
squeeze range Gate A's A01/A04 rounds already proved matters) since they carry a real tab rail;
BEFORE/LIVE do not.

Per spec §16's own guidance, the `?tab=review`-becomes-invalid-after-lock behavior and the pinned
`?tab=players` behavior are **not** registered as separate browser-capture scenarios — both are
already proven at the component-test level against the real resolver/reducer functions
(`INTERACTION_AND_STATE_AUDIT.md`), and mechanically adding a capture for an already-proven
equivalent is explicitly discouraged by the brief. The same principle applies to AFTER's new
`?report=completed` variant (W5 remediation, P1-5): its rendering is already both component-tested
(`after/__tests__/page.test.tsx`'s own describe block) and proven end-to-end in a real browser
(`e2e/ui-lab-b08.spec.ts`), so it is not separately registered as a sixth capture scenario — not an
oversight.

## Capture success is not visual approval

As with every prior Gate B wave: a clean CI capture run proves the pages render and the registered
interactions complete without throwing — it is not an owner review and carries no approval weight.
`official_golden_status` stays `NOT_READY` and `approval` stays `null` regardless of capture outcome
(`REVIEW_RECORD.md`, `candidate_manifest.json`).
