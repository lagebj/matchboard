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
| A04-S6 `declared-only-versus-evidenced` | Is a declaration the same as actual experience? | `NOT_APPLICABLE` (Case A), `COMPLETE` (Case B) |

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

## Data-truth invariant tests (beyond S1–S6 themselves)

1. `ZERO` vs `NOT_RECORDED`/`UNKNOWN`/`NOT_APPLICABLE` never both render as `0`
   (`shared/coverage.test.ts`).
2. Overlapping intervals are rejected, not silently summed — both a positive (S5's real fixture)
   and a negative (deliberately overlapping, test-only) case (`central-profile-projection/
   __tests__/fixtures.test.ts`, `shared/invariants.test.ts`).
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
- `npm test` (both vitest configs, full repository) — 622 test files, 6577 tests, all passing.
  A04-specific: 14 test files, 61 tests (36 node-config + 25 component-config).
- Local `next dev -p 3333` + `scripts/ui-lab-visual-review.mjs` — 56 A04 screenshots (6 scenarios ×
  3 widths × 2 themes = 36 initial, + 5 scenarios × 2 widths × 2 themes `source-open` interaction =
  20), plus all 72 pre-existing baseline/W1 captures regenerated byte-identical to the already
  `APPROVED_GOLDEN` hashes in `docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json` — confirms
  this branch does not disturb W1. Full per-capture SHA-256 in `capture-attestation.json`.
- `npm run build` / full `npm run validate` — not run locally (pre-existing sandbox OOM limitation,
  reproduces on clean `main`, passes in real CI per prior Gate A PRs); CI will run them.

## Known gaps / open product questions (not decided by this candidate)

- Profile support/confidence aggregation across sided positions remains undecided (W1's own
  deferral; A04 never aggregates confidence/support, only minutes/appearance counts).
- Evidence-sufficiency/trend-confidence policy is not decided — S2's 2/6 and S3's 6/6 are
  acceptance examples, not thresholds.
- Conflicting-source-value resolution (`CONFLICT` state + priority rule) is an open product
  question, see `BLOCKED` above.
- **W1 housekeeping check (per `00_READ_FIRST.md`):** `gh release list` returns zero releases for
  this repository — the W1 `candidate_manifest.json`'s disclosed D7 durable-storage gap (the 48
  approved PNGs preserved via GitHub Release, beyond CI's 7-day artifact window) is **still open**,
  unchanged since PR #777. Reported here, not expanded: this PR does not create that release or
  otherwise touch W1's approval records (confirmed byte-identical hashes above).

## End state

Draft PR only. Not merged, not marked `APPROVED_GOLDEN`. Awaiting independent review and the
repository owner's decision.
