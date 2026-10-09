# Gate A W2 — A04 Review Record

## Status: `CANDIDATE`

Not approved. Pending (1) independent (ChatGPT) review of source, screenshots, data invariants,
and CI, and (2) the repository owner's explicit `APPROVED` / `REVISE` / `BLOCKED` decision based on
rendered screenshots and context-local interaction (`05_DELIVERY_AND_REVIEW_GATE.md`). No case in
this PR may be read as approved, and none is self-approved here.

## What this candidate proves

A repeatable **question → recorded fact / defensible finding → purpose-specific visual →
inspectable underlying source** grammar across six mandatory scenarios
(`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`), covering unknown, partial, sparse, and supported
measurements:

| Case | Coach question | Coverage states exercised |
|---|---|---|
| A04-S1 `partial-minutes` | Did this player actually play, or only have the chance to? | `COMPLETE` (opportunity), `NOT_RECORDED` (minutes) |
| A04-S2 `role-exposure-sparse` | Is there enough evidence yet to say suitability is changing? | `PARTIAL` (2 of 6), `NOT_RECORDED` (4 of 6) |
| A04-S3 `role-exposure-supported` | Was recorded exposure higher, lower, or unchanged? | `COMPLETE` (6 of 6) |
| A04-S4 `sparse-score-events` | What's the final score, and how complete is the event log? | `COMPLETE` (result), `PARTIAL` (event log) |
| A04-S5 `central-profile-projection` | How much CM-profile time does one match contribute? | `COMPLETE` (both intervals) |
| A04-S6 `declared-only-versus-evidenced` | Is a declaration the same as actual experience? | `COMPLETE` (both declarations), `NOT_RECORDED` (Case A exposure), `COMPLETE` (Case B evidence) |

Every displayed claim is backed by a concrete, inspectable `SourceRecord` (source ID, provenance
class, scope, exact field value, coverage, and an explicit named transformation where one exists),
opened via `SourceInspector` — a context-local desktop inline panel or mobile bottom sheet, never a
route navigation (`useMediaQuery` picks exactly one presentation, same pattern as W1's A01).

## Requirements traced

`XR-A01` (comparison over time/baselines — S2, S3), `XR-A02` (opportunity distribution — S1, S2),
`XR-A03` (position/attribute development stories — S5, S6), `XR-A04` (editorial selection/
progressive disclosure — S1, S4), `XR-V01` (measurable improvement over current product — all six;
see `visual_vs_current/A04.md`). Exact v0.5.4 documents read: `20_UI_LAB_CANDIDATE_WAVES.md`,
`05_DATA_AND_VISUALIZATION_TRUTH.md`, `02_GATE_A_FOUNDATION_DESIGN_SPEC.md`,
`13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`, `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`,
`16_POSITION_SEMANTICS_TRACEABILITY.csv`, `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`,
`23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`, `24_CONFLICT_AND_BLOCKER_REGISTER.md`.

## Current-state audit summary

See `CURRENT_STATE_AUDIT.md` for the full findings. In short: `EvidenceStory` navigates via
`detailHref` (not context-local — a dev-only `EvidenceQuestionPanel` adapter was built instead);
`PlayerParticipationStrip`/`player-match-timeline.tsx` cannot truthfully render an absent minutes
measurement (dev-only presentation built instead, never reused for the unknown-minutes state); W1's
approved `aggregateExactAppearancesByProfile`/`collapseTacticalToProfile` is reused unmodified for
S5/S6. All five of these are the "candidate-only adapters necessary" the task anticipated; no
production component was copied-and-weakened.

## Independent review round 1 (PR #778, head `56ff0402c`)

An independent technical review returned **`REVISE`**, quoted here in full for the record:

> **R1 (high):** A04-S1 opportunity claim lacks an explicit positive opportunity fact — the 5/5
> count incremented for each nonempty `opportunitySourceId`, while the source text said
> "Eligible — selectable", not an opportunity fact. **R2 (high):** A04-S6 conflates declaration
> coverage with actual-exposure coverage — Case A's single panel carried one `NOT_APPLICABLE`
> badge over two different facts, with no separate inspectable absence source. **R3 (medium):**
> source inspection is not scoped to the selected claim — every "Inspect..." button in a scenario
> opened the identical combined list, and the capture script only ever opened the first one.
> Verification gaps: add 360/430px smoke + 200% zoom/keyboard/console-error checks; strengthen
> `assertNonOverlappingIntervals` against reversed/negative intervals; verify S3's "complete"
> claim with typed coverage and a failure mode; the W1 approved manifest has 48 captures, not 32.

**All three findings and every verification gap are addressed in this round:**

- **R1 fixed:** `partial-minutes/fixtures.ts` now models eligibility (`eligibilitySourceId`) and a
  recorded opportunity (`opportunitySourceId`, optional) as two separate facts per round, each with
  matching source text. `computeOpportunityCoverage` counts only rounds with a real opportunity,
  validated against duplicate/mismatched round IDs (`assertUniqueIds`). New negative-case tests:
  an eligible-but-no-opportunity round is excluded from the numerator; a duplicate round ID throws.
- **R2 fixed:** `declared-only-versus-evidenced` now renders four distinct panels — Case A
  declaration (`COMPLETE`) / Case A actual exposure (`NOT_RECORDED`, with its own inspectable
  "recording-scope check" source proving the absence was checked, not inferred) / Case B
  declaration (`COMPLETE`) / Case B evidence (`COMPLETE`) — each with its own coverage badge.
- **R3 fixed:** S1, S4, and S6 each now use one `useSourceInspector()` instance per claim, wired to
  its own scoped `buildXSourceRecords()` function. The capture script's single "click the first
  Inspect button" action is replaced with named `openSourceInspectorByName(exact label)` per
  scoped trigger — S1 captures both opportunity and minutes sources; S4 captures both result and
  event sources; S6 captures Case A declaration and Case B evidence.
- **Verification gaps fixed:** `assertValidClosedInterval` (new) rejects a negative-start or
  non-forward interval even when it wouldn't overlap anything by start order alone;
  `assertNonOverlappingIntervals` now calls it on every interval first. S3's `CompleteMatchRoleExposure`
  now carries an explicit `coverage` field per observation, and `computeWindowComparison` validates
  every entry is `COMPLETE` and every `matchId` distinct before computing any total (new negative
  tests: one `NOT_RECORDED` observation, one duplicated `matchId`, both rejected). The capture
  script adds `a04ExtraSmokeViewports` (360px/430px) to all six A04 scenarios, an A04-scoped
  `data-ui-lab-ready` wait (`04_TEST_AND_CAPTURE_MATRIX.md`'s "explicit candidate-ready indicator"),
  and a console/page-error gate (fails for `gate-a-a04-*`, warns elsewhere). The "32" miscount is
  corrected to **48** throughout this doc set (`gate-a-*` captures only; 72 including the 4
  non-Gate-A baseline scenarios) — see `CURRENT_STATE_AUDIT.md`.
- **A 200%-zoom automated check was attempted and removed, disclosed rather than hidden:**
  implemented via Chromium's `document.documentElement.style.zoom = "2"`, it fired on pages whose
  normal screenshots show no overflow at all — the mechanism scales rendered layout without
  correspondingly shrinking `clientWidth` the way real browser zoom does (which reflows responsive
  layout), so it does not measure what it claims to. Removed rather than kept as a misleading gate;
  200% zoom legibility stays a manual-QA item. A genuine, unrelated sequential-interaction bug was
  also found and fixed while re-capturing: S1/S4/S6 chain two interactions on one page/context, and
  the first one's mobile bottom-sheet overlay was still open and intercepting clicks for the
  second — `openSourceInspectorByName` now closes any open dialog first.
- **Disclosed, not silently fixed:** `02_A04_SCOPE_AND_FIXTURE_TRUTH.md`'s conflicting-source-value
  data-truth test (#3) remains test-only (no `CONFLICT` UI state, no invented source-priority
  rule) — see `BLOCKED` below, unchanged by this round, still an open product question.

Full per-file diff is in `CHANGED_FILES.md` (rows marked "round 2"). Revised capture evidence is in
`capture-attestation.json`, re-generated against this round's commit.

## Data-truth invariant tests (beyond S1–S6 themselves)

1. `ZERO` vs `NOT_RECORDED`/`UNKNOWN`/`NOT_APPLICABLE` never both render as `0`
   (`shared/coverage.test.ts`).
2. Overlapping intervals are rejected, not silently summed — both a positive (S5's real fixture)
   and a negative (deliberately overlapping, test-only) case (`central-profile-projection/
   __tests__/fixtures.test.ts`, `shared/invariants.test.ts`). A reversed or negative-duration
   interval is rejected even when it would not overlap anything by start order alone
   (`assertValidClosedInterval`, review round 1 verification gap).
3. Conflicting source values: **`BLOCKED`** on a real UI surface — see below.
4. Retracted coach note stays historical, not active evidence (`shared/invariants.test.ts`).
5. Tentative coach statement stays tentative/attributed (`shared/invariants.test.ts` — exercised at
   the pure-function level; `HistoricalCoachNote.tentative` is never rewritten).
6. Explicit zero is legal only when recorded/verified, never inferred from absent intervals
   (`shared/coverage.test.ts`; also structurally true of `aggregateExactAppearancesByProfile`,
   which only ever emits an entry for appearances actually given to it).

## `BLOCKED` item (disclosed, not worked around with a plausible fake)

**Conflicting-source-value resolution (data-truth test #3) has no real UI surface in this
candidate.** No `CONFLICT` state exists in the approved six-value coverage vocabulary, and no
source-priority order is defined in any current domain code or ADR for resolving two sources that
genuinely disagree on the same fact. Per `07_DECISIONS_DEFERRALS_AND_BLOCKERS.md` ("Do not invent a
source-priority order if the current code/ADR does not define one. Record blocker if unresolved"),
this is implemented **test-only**: `shared/invariants.ts`'s `describeConflict` flags a disagreement
without resolving it, exercised by `shared/invariants.test.ts`. Escalated here rather than guessed
at: a future wave needs an explicit product decision on (a) whether a `CONFLICT` coverage state
should be added to the vocabulary, and (b) what source-priority rule, if any, should resolve it.

## CI and screenshot evidence

- `npx tsc --noEmit` — clean.
- `npx eslint` (full repo lint glob) — clean, 3 pre-existing unrelated warnings.
- `npm test` (both vitest configs, full repository) — 622 test files, 6599 tests, all passing.
  A04-specific: 14 test files, 83 tests (53 node-config + 30 component-config). One pre-existing,
  unrelated test (`src/lib/ai/presentation/__tests__/player-development-cycle-insight.test.ts`)
  was observed to fail once in an earlier full-suite run and pass both in isolation and in a
  subsequent clean full run — a pre-existing flake, not caused by this branch, and not reproduced
  in the final run recorded here.
- Local `next dev -p 3333` + the revised `scripts/ui-lab-visual-review.mjs` — 92 A04 screenshots
  (6 scenarios × 5 widths × 2 themes = 60 initial, + per-scenario `source-open`-family interactions
  at desktop/mobile × 2 themes = 32: S1/S4/S6 have two each (16), S3/S5 have one each (8); S2 has
  none), plus all 48 pre-existing `gate-a-*` W1 captures regenerated byte-identical to the already
  `APPROVED_GOLDEN` hashes in `docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json` — confirms
  this branch does not disturb W1. The 4 non-Gate-A `atlas-followup` baseline scenarios (24
  captures, never an approved golden) were also regenerated; `match-preparation`'s 6 captures
  legitimately differ run-to-run (its own fixture computes `kickoffAt` from `Date.now()`,
  pre-existing and unrelated to this PR — confirmed by direct source read, not a Gate A candidate).
  Full per-capture SHA-256 in `capture-attestation.json`.
- `npm run build` / full `npm run validate` — not run locally (pre-existing sandbox OOM limitation,
  reproduces on clean `main`, passes in real CI per prior Gate A PRs); CI will run them.

## Known gaps / open product questions (not decided by this candidate)

- Profile support/confidence aggregation across sided positions remains undecided (W1's own
  deferral; A04 never aggregates confidence/support, only minutes/appearance counts).
- Evidence-sufficiency/trend-confidence policy is not decided — S2's 2/6 and S3's 6/6 are
  acceptance examples, not thresholds.
- Conflicting-source-value resolution (`CONFLICT` state + priority rule) is an open product
  question, see `BLOCKED` above.
- 200% zoom legibility is a manual-QA item, not automated — see "Independent review round 1" above
  for why the automated attempt was removed rather than kept as a misleading gate.
- **W1 housekeeping check (per `00_READ_FIRST.md`):** `gh release list` returns zero releases for
  this repository — the W1 `candidate_manifest.json`'s disclosed D7 durable-storage gap (the 48
  approved PNGs preserved via GitHub Release, beyond CI's 7-day artifact window) is **still open**,
  unchanged since PR #777. Reported here, not expanded: this PR does not create that release or
  otherwise touch W1's approval records (confirmed byte-identical hashes above).

## End state

Draft PR only. Not merged, not marked `APPROVED_GOLDEN`. Awaiting independent review and the
repository owner's decision.
