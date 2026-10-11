# Gate A W3 — A03/A07/A09 Review Record

## Status: `PENDING` (candidate submitted for independent technical review and owner visual approval — neither has occurred yet)

All 16 scenario IDs (A03-S1..S4, A07-S1..S6, A09-S1..S6) are `CANDIDATE` in
`candidate_manifest.json`. No `approval` object exists on any entry. This PR is a draft and will
remain draft and unmerged until the repository owner explicitly approves specific scenario
IDs/fixture revisions/source SHA/capture hashes, per `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`.
Passing CI and passing local tests are not approval.

## What this candidate proves

| Case | Coach question | States exercised |
|---|---|---|
| A03-S1 `open-decision` | Can I see the exact decision, action, consequence, and reason for an unfilled slot? | Actionable, inspectable reason |
| A03-S2 `closed-plan-review` | Is a closed plan honestly read-only, with no fabricated exception? | Read-only, zero mutating controls |
| A03-S3 `permission-denied` | Does a denied actor see a reason without leaking squad detail? | Denied, minimal context |
| A03-S4 `integrity-signal` | Does a Round Board signal point back to the match without a second resolver? | Signal, no resolver |
| A07-S1/S2 `assign-reserve-success` | Can I edit the lineup in place and see a real save moment? | Open, draft, preview, pending, `SUCCESS` |
| A07-S3 `assign-reserve-denied` | Does a denial preserve my draft and the real lineup? | `PERMISSION_DENIED` |
| A07-S4 `server-conflict` | Does a conflict show me the mismatch without auto-merging? | `CONFLICT` |
| A07-S5 `planning-closed-after-opening` | Does a closed boundary refuse a save I started before it closed? | `PLANNING_CLOSED` |
| A07-S6 `dirty-draft-close` | Can I close without silently losing an unsaved edit? | Dirty-close guard |
| A09-S1 `add-eligible-player-success` | Can I add a player from Today without visiting Match Details? | Open, draft, preview, pending, `SUCCESS` |
| A09-S2 `add-player-denied` | Is a denied candidate visibly blocked with a reason? | Blocked at entry |
| A09-S3 `add-player-rsvp-blocked` | Is a no-response-after-deadline candidate honestly blocked? | Blocked at entry (illustrative policy — see `BLOCKERS.md` #1) |
| A09-S4 `add-player-planning-closed` | Does planning-closed leave the count unchanged? | `PLANNING_CLOSED`, count unchanged |
| A09-S5 `add-player-conflict` | Does a stale add show "already a participant" without duplicating? | `CONFLICT`, count unchanged |
| A09-S6 `match-day-addition` | Is a match-day addition's operational count kept separate from the planned count? | `SUCCESS`, dual-counter separation |

Every save-flow scenario (A07-S1/S2–S6, A09-S1/S4/S5/S6) is driven by one shared, typed fixture-
response port (`gate-a/shared/fixture-operation.ts`'s `useFixtureOperation`): a predeclared
`FixtureOperationOutcome` constant from that scenario's own `fixtures.ts`/`view-model.ts`, never a
locally-computed permission result. Only a resolved `SUCCESS` ever changes the authoritative
in-memory projection (pitch assignments for A07, counts for A09) — every other outcome leaves it
untouched and preserves the draft, verified by test for every scenario that reaches a terminal
state.

## Requirements traced

`XR-I01`/`XR-I02` (context-local interaction — A07, A09), `XR-S01`/`XR-S02` (stable match identity,
object-first composition — A03, A07), `XR-A02` (opportunity/distribution with denominator — A03-
S4, A09-S6's dual counters), `XR-V01`/`XR-V02` (measurable improvement, route-level coherence — all
sixteen; see `visual_vs_current/{A03,A07,A09}.md`). Exact v0.5.4 documents read: this handoff
bundle's `00_READ_FIRST.md` through `08_OWNER_REVIEW_SHEET.md` and all of `source_contracts/`
(`01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md`, `02_GATE_A_FOUNDATION_DESIGN_SPEC.md`,
`03_WORKSPACE_OWNERSHIP_AND_MATCH_LIFECYCLE.md`,
`06_QUICK_ACTIONS_AND_RESPONSIVE_INTERACTIONS.md`, `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`,
`17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`, `20_UI_LAB_CANDIDATE_WAVES.md`,
`21_FIXTURE_CAPTURE_AND_AUTHORITY.md`, `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`,
`24_CONFLICT_AND_BLOCKER_REGISTER.md`, `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`).

## Current-state audit summary

See `CURRENT_STATE_AUDIT.md` for the full findings. In short: `MatchTacticsPanel` is self-fetching
and not fixture-injectable (dev-only `lineup-slot-editor.tsx` built from the real
`TouchlinePlanningPitch` instead); `AddPlayerDialog` pre-filters candidates with no excluded-
reasons list (Round Board's `PlayerAssignmentInspector`/`Sheet` reasons-carrying shape used
instead); Matchboard has no RSVP concept or revision/concurrency field in source today (both
disclosed as illustrative, see `BLOCKERS.md`); `assertLeagueMatchHelperEligible`'s real narrow
scope (ADR-0077) is mirrored in A09-S6's copy without being invoked; ADR-0151's `Status: Proposed`
field is stale relative to shipped code (disclosed, not fixed here — out of this PR's file scope).

## Data-truth invariant tests (beyond the sixteen scenarios themselves)

1. Every fixture's `fixtureSha256` is independently recomputed from its own `rawRecordsForHash` in
   its own test file, never copied back as the expectation (same pattern as A04).
2. Match-context invariant: no scenario's tests exercise `next/navigation`'s router at all — every
   interaction is asserted to stay on the same mounted component tree (`shared/__tests__/mock-
   viewport.ts`-backed render, no route change asserted or possible).
3. Exact tactical slot/player mapping: `gate-a/shared/__tests__/match-w3-fixture.test.ts` asserts
   no duplicate slot IDs, no duplicate player assignments, and that the bench reserve never
   appears on the pitch even after the pending starter is placed.
4. State-machine proof: `gate-a/shared/__tests__/fixture-operation.test.tsx` asserts a resolved
   `SUCCESS` is the only outcome that changes authoritative state; every other outcome leaves it
   untouched and preserves the draft; a double submit while `PENDING` is a no-op (the second
   outcome never takes effect).
5. A07's state machine is proven on a real pitch: the assignment count goes 6→7 and the new
   assignment's `playerId` matches the pending starter only after a genuine `resolvePending()` call
   following a `SUCCESS` outcome — never earlier.
6. A09-S6's dual-counter separation is asserted as two distinct text nodes, not inferred from one
   combined string.
7. Exactly one dialog open per page at any time (trivial here — each scenario page only ever
   mounts one editor instance), focus restoration to the trigger on close/Escape, and the dirty-
   draft close guard (A07-S6, and A09-S1 reusing the same pattern) is asserted to block an
   immediate close only when a draft exists.

## `BLOCKED` / `CANDIDATE`-only items (disclosed, not worked around with a plausible fake)

See `BLOCKERS.md` for the full register (7 items). None of them is resolved by weakening a
requirement; each is either an explicit scope boundary (simulated save flow, illustrative RSVP/
conflict fixtures) or a disclosed environment limitation (local capture).

## CI and screenshot evidence

- `npx tsc --noEmit -p tsconfig.json` — clean, 0 errors (full project).
- `npx eslint src/app/dev/ui-lab/gate-a` — clean, 0 output.
- `npx vitest run src/app/dev/ui-lab/gate-a` (node config) — 27 files, 131 tests, all passing.
- `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-a` (component
  config) — 26 files, **140 tests**, all passing (includes 3 new `<StrictMode>` regression tests
  for the bug below, independently verified to fail against the pre-fix implementation).
- `npm run build` / full `npm run validate` — not run locally (pre-existing sandbox limitation,
  reproduces on clean `main`, passes in real CI per prior Gate A PRs); CI's `Build` and `Tests`
  jobs both passed on the final commit.
- **Local browser capture could not be run to completion in this session's sandbox** (devcontainer
  HMR WebSocket upgrade failure starves React hydration; reproduces on an untouched W1 page; see
  `CURRENT_STATE_AUDIT.md`). **CI's "UI Lab Visual Review" workflow succeeded** (run `38085816627`,
  6m44s, against commit `bd0442ce1`) and is the real evidence source — `capture-attestation.json`
  is committed, covering 332 screenshots across all 15 physical scenario pages (16 scenario IDs) at
  5 viewport widths and both themes.
  - This took three commits, not two: the FIRST CI capture run (against `7677aeddd`) surfaced a
    real capture-script timing gap (fixed in `f43e1f0e9`), and the retry then surfaced a real
    **application** bug — `resolvePending()` permanently stuck at `PENDING` under React Strict
    Mode, from an impure `setState` updater that mutated a ref as a side effect (fixed in
    `bd0442ce1`; full root-cause writeup in `CURRENT_STATE_AUDIT.md` item 5). Both fixes were
    re-verified against a clean CI capture run before this attestation was trusted: every one of
    the 332 captures' resolve-step screenshots was checked programmatically to have a genuinely
    different hash from its own pending screenshot (zero exceptions), and the A07-S1/S2 "saved"
    screenshot was additionally inspected directly — it correctly shows Tobias placed at RCM with
    a "Saved (simulated)" banner.

## Known gaps / open product questions (not decided by this candidate)

- Whether/how to implement an automated RSVP-deadline-decline rule for planned selection
  (`BLOCKERS.md` #1).
- Whether a `CONFLICT`/optimistic-concurrency revision field should be added to
  `MatchLineupAssignment` and an equivalent Today/roster-add action (`BLOCKERS.md` #3).
- How a same-tab in-place editor should interact with real browser history (`BLOCKERS.md` #4).
- ADR-0151's `Status: Proposed` vs. shipped-code mismatch (`BLOCKERS.md` #6) — recommend a
  separate, narrowly-scoped documentation-alignment issue, not bundled into this PR.
- Durable off-git screenshot preservation via GitHub Release remains outstanding from W1/W2
  (`BLOCKERS.md` #7) — unchanged status, not attempted here.

## End state

All sixteen A03/A07/A09 scenario IDs are `CANDIDATE` as of this PR's first commit. **This PR is a
draft and will remain unmerged** until: (1) this PR's CI produces real capture evidence and a
follow-up commit adds `capture-attestation.json` referencing it; (2) an independent technical
review inspects source, tests, CI, and capture hashes; (3) the repository owner explicitly approves
specific scenario IDs against an exact revision — none of which has happened yet. No merge, no
release, no W4, no production implementation is authorized by this record.
