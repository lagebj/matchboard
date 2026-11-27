# Gate E W2 — Review Record (E02)

## Status

**This file contains the implementer's own self-audit only. It is NOT an independent review.** A
separate, context-independent technical review is expected after this PR is opened; its findings
belong in a new section below, written when that review has actually happened. Nothing here should
be read as a PASS granted by anyone other than the implementer.

## Verification actually run in the implementation session

| Command | Result |
|---|---|
| `npm test` (both Vitest configs, full suite) | node: 632 files / 6843 tests passed; components: 201 files / 1272 tests passed; exit 0 |
| `npx vitest run src/app/dev/ui-lab/gate-e` (after the last formatter change) | 105 passed |
| `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-e src/components/events src/components/touchline "src/app/(app)/events"` | 18 files / 130 tests passed |
| `npm run validate -- --fast` | every step passed except `typecheck`, which hit a V8 heap OOM (BLK-E02-07) |
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | exit 0 |
| `npx eslint src/app/dev/ui-lab/gate-e e2e/ui-lab-gate-e.spec.ts scripts/ui-lab-visual-review.mjs` | clean |
| Gate E Playwright (`--project=ui-lab-gate-e`) | not run locally (BLK-E02-06). **CI run 46018113731 attempt 1 (head `696681c1`): 42 passed** (20 E01 + 22 E02); B08 164, Gate C 146 passed, Gate D step success in the same run |
| UI Lab capture (`scripts/ui-lab-visual-review.mjs`) | not run locally. **CI run 46018113731: success, 24 E02 captures**; artifact downloaded, 24/24 hashes recomputed from PNG bytes and matched, widths match viewports (`capture-attestation.json`) |
| `npm run build` | not run locally (known sandbox OOM); CI checks on head `696681c1` were green except the expected `Visual Authority Gate` (AWAITING_APPROVAL) |

## Finding from inspecting the real captures

Inspecting the CI screenshots found one visual defect the jsdom/Playwright assertions did not
catch: in the unmodified production `ScorebookMatchRow`, scheduled rows' kickoff time overlaps the
"Scheduled" label at every width, and on 390/320px the opponent name truncates ("Nordbye…").
Recorded as BLK-E02-08 (issue #852). It is a shared-component defect outside this wave's scope, but
it weakens E02's mobile opponent readability, so the owner should see it before approving.

## Implementer self-audit against the 24 review questions

| # | Question | Self-assessment | Evidence / caveat |
|---|---|---|---|
| 1 | E02 implemented per the official row? | Yes | Row quoted verbatim in `SOURCE_RECONCILIATION.md` §2; three children of E02 only |
| 2 | XR-T01/S01/V02 read and applied? | Yes, with one gap | Quoted in §3; XR-V02's cross-route journey only partly demonstrable (BLK-E02-02) |
| 3 | States sufficient for multi-match progression? | Yes | MIXED covers result/cancelled/missing/draft/live/next/later across two squads |
| 4 | Every match in the correct Event/squad? | Yes | Integrity assertions 1–2; foreign-id and stray-record tests |
| 5 | Match identities stable/unique? | Yes | Assertions 3, 13; cross-fixture id test; same-opponent tests |
| 6 | Next meaningful match identifiable? | Yes | Assertion 12; NEXT kicker; per-squad "Next kickoff" |
| 7 | Completed vs played-unreported distinguished? | Yes | REPORT MISSING kicker vs result; never inferred from clock |
| 8 | DRAFT/REPORTED/LOCKED interpreted correctly? | Yes, per ADR-0001/0003 | REPORTED treated as completed result — a reviewer may challenge this reading |
| 9 | Live from canonical evidence? | Yes | Assertion 11; session record → real resolver |
| 10 | Cancellations correct? | Yes | Assertion 8; reason shown; never NEXT/LATER |
| 11 | Selection preserves Event context? | Yes (directional) | Playwright identity tests (CI) and component tests |
| 12 | Production destinations verified, not invented? | Yes | Routes checked on disk; link-inventory tests |
| 13 | Canonical presentation primitives reused? | Yes | Provenance table in `VISUAL_VS_CURRENT.md`; Oslo override of two presentation fields disclosed |
| 14 | Directional behaviour disclosed? | Yes | `VISUAL_VS_CURRENT.md`, identity contract, manifest note |
| 15 | Fixtures temporally/numerically consistent? | Yes | 17 assertions × 3 fixtures |
| 16 | Desktop uses representative production width? | Yes | `max-w-[96rem]` container; CI Playwright width test passed; desktop captures 1440px wide |
| 17 | Mobile dark usable? | Mostly — one defect | CI mobile-dark and overflow tests passed; captures show scheduled-row time/label overlap and opponent truncation from the shared `ScorebookMatchRow` (BLK-E02-08, #852) |
| 18 | Browser tests verify identity continuity? | Yes | E02 identity group passed in CI run 46018113731 |
| 19 | Real Server Actions excluded? | Yes | no action imports; `next-action` header test passed in CI |
| 20 | Screenshots consistent with final code? | Yes | run on head `696681c1`; later commits change only docs/attestation |
| 21 | Capture hashes independently verified? | Yes, by the implementer | 24/24 recomputed from downloaded PNG bytes; an independent reviewer should re-check |
| 22 | Gate E W1 / Match Presentation tests stable? | Yes | full Vitest suite green; all 20 E01 Playwright tests passed in CI |
| 23 | Docs avoid claiming unimplemented production functionality? | Intended yes | Reviewer should check "directional" labelling |
| 24 | Earlier approved goldens unaffected? | Yes | No shared component or earlier candidate file changed; only the shared Gate E index/spec gained E02 entries |

## Known weaknesses a reviewer should look at first

- The projection is a second implementation of the timeline's lifecycle mapping (by necessity —
  the production function is private and wrong for E02). Drift risk is recorded as BLK-E02-01/04.
- `kickoffDate`/`kickoffTime` on the real presentation object are overwritten with Oslo-pinned values.
- REPORTED-as-completed is an interpretation of ADR-0001/0003; `EventMatchesTab` still shows it as
  "Reported" without a Complete action.
- The finalised banner's last sentence differs from production copy (Unfinalize is not rendered).
- BLK-E02-08: scheduled-row overlap/truncation in the shared `ScorebookMatchRow`, visible in the
  UPCOMING and MIXED captures.

## Implementer disposition

`READY_FOR_INDEPENDENT_REVIEW`. CI is green apart from the expected Visual Authority Gate; captures
are attested. Not marked ready for owner visual review by the implementer because the captures show
BLK-E02-08, which the owner and reviewer should weigh first (accept as a disclosed shared-component
defect tracked in #852, or require it fixed before approval).
