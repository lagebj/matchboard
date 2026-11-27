# Gate E W2 — Review Record (E02)

## Status

The sections down to "Implementer disposition (first revision)" are the implementer's own
self-audit, written before any independent review, and are kept as written apart from the
corrected Playwright counts. An independent review has since happened; its findings and their
resolution are in "Independent review" at the end. Nothing here is owner approval.

## Verification actually run in the implementation session

| Command | Result |
|---|---|
| `npm test` (both Vitest configs, full suite) | node: 632 files / 6843 tests passed; components: 201 files / 1272 tests passed; exit 0 |
| `npx vitest run src/app/dev/ui-lab/gate-e` (after the last formatter change) | 105 passed |
| `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-e src/components/events src/components/touchline "src/app/(app)/events"` | 18 files / 130 tests passed |
| `npm run validate -- --fast` | every step passed except `typecheck`, which hit a V8 heap OOM (BLK-E02-07) |
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | exit 0 |
| `npx eslint src/app/dev/ui-lab/gate-e e2e/ui-lab-gate-e.spec.ts scripts/ui-lab-visual-review.mjs` | clean |
| Gate E Playwright (`--project=ui-lab-gate-e`) | not run locally (BLK-E02-06). **CI run 46018113731 attempt 1 (head `696681c1`): 42 passed** (20 E01 + 22 E02); same run: B08 54, Gate C 164, Gate D 146 passed (corrected — the first revision of this row mislabelled these counts, independent review m4) |
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

## Implementer disposition (first revision)

`READY_FOR_INDEPENDENT_REVIEW`. CI is green apart from the expected Visual Authority Gate; captures
are attested. Not marked ready for owner visual review by the implementer because the captures show
BLK-E02-08, which the owner and reviewer should weigh first (accept as a disclosed shared-component
defect tracked in #852, or require it fixed before approval).

## Independent review

A fresh, context-independent reviewer (separate worktree, no prior context) audited this PR at head
`9d199096`. Verdict: no BLOCKING findings; scope, byte-identical production files, live-state
derivation, REPORTED semantics, outbound links, selection code, desktop width, Server Action
exclusion, all 24 capture hashes (recomputed independently from both CI runs) and E01/B08/Gate C/
Gate D regression status were confirmed. Findings and resolution:

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| M1 | MAJOR | XR-S01 ("planned/live/completed versions of one fixture remain recognizably the same object") was not demonstrated: the three fixtures were unrelated schedules and a test enforced that no id was shared; SOURCE_RECONCILIATION §7 overclaimed "applied as written" | **Fixed.** One shared Event-day schedule (`shared/event-day-schedule.ts`) observed at 08:00/11:30/18:00; fixtures bumped to v2 and re-hashed. New tests: identity fields identical across fixtures, recorded facts only accumulate, continuity match `gate-e-w2-e02-m06` planning_open → live → done. Playwright XR-S01 group checks its selected context in each state; every capture run now selects it in all three states. §7 rewritten (and self-audit rows 2/5 above are superseded by this). |
| M2 | MAJOR | Below 600px the shared row ellipsizes names ("Fjel…"), so Blå/Rød are indistinguishable at 320px; the identity contract claimed squads were named "at every width" | **Fixed** without touching the shared row: a UI-Lab-only "Squad v Opponent" line under each row below 600px, wrapping instead of truncating. Playwright asserts at 390 and 320px that all nine lines are visible, not overflowing, not ellipsized, and correct; a desktop test asserts the line is hidden ≥600px. Contract text corrected. |
| M3 | MAJOR | BLK-E02-08: shared `ScorebookMatchRow` scheduled-time lane overlaps "Scheduled"; opponent squeezed ≤390px | **Left as-is for the owner** (shared Touchline component, issue #852). Owner decides: fix first, or approve with the defect scoped out. |
| m1 | minor | Selected panel showed "draft score 1–0, not final" while docs claimed DRAFT shows nothing (ADR-0001 rejects preliminary draft scores) | **Fixed** — panel shows "Draft — not final, no result shown"; component test asserts no draft score text. |
| m2 | minor | Shared row prints "FT" on report-missing/draft rows, contradicting "completion never inferred from the clock" | **Disclosed** in TEMPORAL_AND_LIFECYCLE_AUDIT.md as a shared-grammar quirk (not fixed, same family as BLK-E02-08). |
| m4 | minor | Playwright counts mislabelled (B08/Gate C/Gate D) | **Fixed** — B08 54, Gate C 164, Gate D 146, Gate E 42 (verified from the CI job log). |

Local verification after remediation: Gate E node tests 109 passed; Gate E component tests 28
passed; ESLint clean; `tsc --noEmit` (4 GB heap) exit 0. CI and capture results for the remediated
head are recorded below and in `capture-attestation.json`.

### CI evidence for the remediated head

CI capture run 46040100407 (attempt 1) on head `53dd5a0b`: Gate E Playwright **48 passed** (20
unchanged E01 + 28 E02, including the new 390/320px truncation tests and the XR-S01 continuity
group); B08 54, Gate C 164, Gate D 146 passed. 36 E02 captures (3 states × 6 initial + 6
`continuity-match-selected`); artifact `ui-lab-review-46040100407-1` downloaded and 36/36 sha256
recomputed from the PNG bytes, matching the run manifest — `capture-attestation.json` now attests
this run and records the superseded v1 run.

Screenshots inspected directly: mixed-progression narrow-dark (320px — every row shows
"Fjellsiden Blå/Rød v Opponent" in full under the truncated shared row), upcoming desktop-dark
continuity-selected (m06 Scheduled, "Start live reporting"), completed mobile-dark
continuity-selected (m06 2–1, "Completed — report locked", no live-reporting entry). BLK-E02-08's
overlap is still visible on scheduled rows, as expected.

## Disposition after review round 1 (superseded by review round 2 below)

`READY_FOR_OWNER_VISUAL_REVIEW` — with one explicit owner decision pending: **BLK-E02-08 /
issue #852** (shared `ScorebookMatchRow` scheduled-row time/label overlap and name truncation).
Either require the shared-component fix before approving these goldens, or approve them with that
defect scoped out. No approval has been posted or assumed.

## Review round 2 (E02-R1 – E02-R6)

A further review round raised six findings. Per finding: original defect, correction, evidence,
remaining risk, authority, disposition.

| ID | Severity | Defect | Correction in this PR | Evidence | Remaining risk / authority | Disposition |
|---|---|---|---|---|---|---|
| E02-R1 | MAJOR | Shared `ScorebookMatchRow`: scheduled kickoff time in the 2.75rem score lane overlaps "Scheduled" at every width (= BLK-E02-08, #852) | None — shared production component | Visible in every scheduled row of the CI captures | Unfixed; shared-component change not authorized (`BLOCKERS.md`) | **Open — owner decision** |
| E02-R2 | MAJOR | Shared row ellipsizes squad/opponent names below 600px | None in the shared row; the UI-Lab identity line (round 1 M2) mitigates it inside E02 only | 320/390px captures; Playwright truncation tests on the identity line | Canonical row still truncates on every other surface; not authorized | **Open — owner decision** |
| E02-R3 (#853) | MAJOR | `matchPresentationPhase()` maps `played`/`report_incomplete` to `final`, so the row prints unqualified "FT" without a confirmed result | None — shared presentation contract | REPORT MISSING / REPORT DRAFT rows in MIXED captures show "FT" | Affects ~10 consumers; needs a contract decision; not authorized | **Open — owner decision** |
| E02-R4 | MINOR | Identity line sat outside the row's link (tapping it did nothing) | One UI-Lab `Link` per match item wrapping the link-less shared row, identity line, caption and "Selected" label (`event-day-timeline-section.tsx`); shared row unchanged | Component test (one link per item, identity line inside, zero nested controls, correct `match` href); Playwright at 390/320px (identity-line tap, row tap, Enter, focus to context, Back-to-event-day focus return, browser Back, Event heading unchanged) | None known | **Fixed** (CI result below) |
| E02-R5 | MINOR | PR description still described fixture-v1 numbers | PR body rewritten from the v2 fixtures, numbers cross-checked against `shared/event-day-schedule.ts`, the three fixture files and the projection tests | PR #850 body | None | **Fixed** |
| E02-R6 | Docs | XR-V02 overstated | Verified = context preservation inside the directional candidate; Not verified = production Event Match Detail → Live Reporting → return journey (no such route, BLK-E02-02). Stated in the identity contract, VISUAL_VS_CURRENT, BLOCKERS, SOURCE_RECONCILIATION §7, here and the PR body | — | — | **Fixed** |

Round-1 M3 (BLK-E02-08) is not rewritten as resolved: it is the same defect as E02-R1, still open.

### Track B (shared Match Presentation fix)

Authorization determination: **not authorized**. The bundle-root `02_AUTHORITY_SCOPE_AND_APPROVALS.md`
forbids production `src/components/**` changes without separate explicit permission and prescribes
`BLOCKED`; ADR-0159 gates such changes but does not authorize them; the repo allows one open PR at a
time. No shared-component code was written and no second PR was opened. The decision write-up is
in `BLOCKERS.md` "Review round 2".

### Local verification for round 2

Gate E component tests 29 passed (including the new R4 structure test); Gate E node tests 109
passed; ESLint clean; `tsc --noEmit` (4 GB heap) exit 0. Fixture records were not changed, so
fixture versions and hashes stay at v2.

## Final disposition (after review round 2)

**`BLOCKED_BY_SOURCE_OR_AUTHORITY`** — for the three open MAJOR shared-component defects E02-R1,
E02-R2 and E02-R3 only. All E02-owned work (Track A, round-1 M1/M2 and minors) is complete and the
candidates are reviewable. An owner decision lifts the block: (A) authorize a separate shared
Match Presentation PR, or (B) explicitly approve the E02 candidates with R1–R3 excluded as known
defects tracked in #852 (R1/R2) and #853 (R3). The implementer cannot take decision B. No approval has been posted
or assumed.
