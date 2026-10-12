# Gate A W5 — Cross-Wave Consistency Audit

Supplementary diligence beyond the literal W5 contract — see `SOURCE_RECONCILIATION.md` for why
this exists and what authority it does/doesn't carry. Starting index: `reference/
consistency_matrix.csv` (copied from the handoff bundle, `finding_status` column replaced below
with this session's actual findings). Method: direct source reading (components, fixtures, test
files) and the four waves' own `*_REVIEW.md`/`ACTION_OWNERSHIP.md` records (themselves built from
source reading, cross-checked rather than re-derived from scratch where they already answer the
question) plus targeted `grep`/diff checks. **No live browser session was available in this
sandbox** (devcontainer HMR WebSocket upgrade starves Playwright/`next dev` hydration — reproduces
on an untouched W1 page, same limitation W3's own session recorded in `CURRENT_STATE_AUDIT.md`);
items that would require live viewport rendering beyond what CI's own captures already prove are
marked `NOT_TESTED`, not assumed passing.

## C-X01 — Identity and match hierarchy

**PASS, where comparable; correctly not claimed where not.** W3 and W4 deliberately share one
fixture identity (`match-w3-01`, `player-w3-tobias`, `player-w3-sindre` — `ACTION_OWNERSHIP.md` for
both waves states this explicitly as "reused for fixture continuity, not a new invented player").
A07, A09, A10 all render the same match reference/round label format from the same `shared/
match-w3-fixture.ts`. W1 (A01/A02/A06/A12) and W2 (A04) correctly use their own separate fixture
identities and never claim cross-fixture equality with W3/W4 — consistent with the bundle's own
instruction not to falsely assert it. **Finding:** none. `NOT_TESTED` beyond source/fixture-level
comparison: no live render was available to visually confirm identical header chrome pixel-for-
pixel across A02/A03/A07 at the same viewport; the shared `OperationalMatchCard`/match-reference
string construction makes a divergence unlikely but this is inference from source, not direct
observation.

## C-X02 — Lifecycle follows authority

**PASS.** A03's four scenarios, A07's six, and A02's lifecycle states are all built against the
same real `isMatchPlanningEditable`/`isPlanningBoundaryClosed` (`src/lib/selection/planning-
boundary.ts`) as their disclosed "canonical owner, not invoked" reference (`ACTION_OWNERSHIP.md`
W3, A03 row). None of A02/A03/A04/A07 invents an event timeline from a score; A04-S4's "6-4, one
recorded event" is the one deliberate test of this exact invariant and is unchanged by this PR.

## C-X03 — One action language

**PASS.** A03 (read-only), A07/A09 (`OPEN`/draft/`PENDING`/`SUCCESS`/`PERMISSION_DENIED`/
`CONFLICT`/`PLANNING_CLOSED`), and A10 (same vocabulary plus `STALE`/applicability-gated, which is
a genuinely different semantic — a proposal can be blocked *before* any draft exists, unlike A07/
A09's confirm-time denial) are distinct where the underlying operations are genuinely distinct, and
share the same vocabulary and the same `useFixtureOperation`/`useDirtyCloseGuard` hooks where the
semantics actually match. No invented universal state machine. A10 additionally introduces
`TARGET_SLOT_OCCUPIED`/`EVIDENCE_TARGET_MISMATCH`/`DUPLICATE_ASSIGNMENT` as A07 has no equivalent
need for them (A07 never validates a proposal against live pitch occupancy — it only ever targets
the one pre-identified empty slot the scenario fixture is built around).

## C-X04 — No false source certainty

**PASS, with one open design question carried forward (not a regression).** A04's `NOT_RECORDED`
vs `0` discipline (`shared/coverage.test.ts`) is reused unmodified by W1's approved
`aggregateExactAppearancesByProfile`/`collapseTacticalToProfile` for A06/A12 (A04_REVIEW.md
"Current-state audit summary"). A11's extraction scenario imports the real `qualitative-evidence-
extraction-contract.ts` schema directly for shape fidelity (the only W4 file that imports a
production module directly — `ACTION_OWNERSHIP.md` A11 row) rather than re-declaring its own
vocabulary. A10's evidence sources carry `slotId`/subject/scope and are rejected, not silently
accepted, when mismatched (round-3 finding F2, already fixed pre-W5). The one carried-forward open
question, unchanged by W5: A04's `BLOCKED` conflicting-source-value state (`A04_REVIEW.md`) has no
real UI surface anywhere in A05-A12 either — correctly left unresolved rather than invented.

## C-X05 — Position semantics

**PASS.** A06's flat 3×6 profile map and the tactical 5×6 pitch remain visually and
architecturally distinct (`CandidateTacticalPositionMap` is a presentation override that delegates
every non-adjusted cell straight to the real `primaryDisplayCellFor`, verified by W1's own test
suite asserting equality). A12's 14-role picker vs. A06/A10's 24-exact-code grid stay separate
vocabularies; A11's `ACTION_OWNERSHIP.md` explicitly chose `player-w3-sindre` specifically *because*
his real W3 story (recorded LCM tactical minutes) is the exact "sided tactical evidence feeding an
unsided CM profile role" case `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` describes — a
deliberate, documented cross-wave semantic link, not a collapse. A10's `RCM` tactical slot is never
conflated with a profile-map coarse region (A10 never touches the profile map at all; it operates
purely on `TouchlinePlanningPitch`/exact tactical slots, same as A07).

## C-X06 — Assistant Coach activation

**PASS.** A05 and A08 share one `ActivationHarness` and the same hypothesis card/no-pattern notice
(`ACTION_OWNERSHIP.md` A08 row: "A08 reuses the exact same hypothesis card and no-pattern notice as
A05"), with A08's own tests adding a DOM-level assertion A05's do not need (absence of the
`assistant-coach-slot` region entirely when OFF, vs. A05's "disabled" state which still shows an
honest notice in a different information context — Player Detail vs. a parity harness). Both are
built against the same verified real owner (`isAiCapabilityEnabled`), not invoked, consistent with
every other W4 scenario's "simulated, not a live call" labelling. A10's evidence inspection is
provably non-mutating (`<details>`/`<summary>`, independent sibling control, never nested inside
the select button — round-2 finding N2, already fixed).

## C-X07 — Context-local interaction

**`REVISE` — one confirmed, reproducible cross-wave regression found and fixed for the unapproved
family; one confirmed instance left for owner decision because it lives in an already-approved
golden.**

A01's round-4 remediation (`A01_A02_A06_A12_REVIEW.md`, owner-acknowledged) found and fixed a real
layout defect: the inspector-vs-sheet *component* choice uses Touchline's `medium` breakpoint
(`--breakpoint-medium: 600px`, `src/app/globals.css`), but engaging a *two-column row* layout at
that same 600px threshold leaves almost no room for the inspector between ~600-840px with a fixed-
width match column. A01's fix decouples the two decisions: the row layout only engages at the wider
`expanded` breakpoint (840px); between 600-840px the inspector still renders (not the sheet) but
stacks full-width below the match content.

**This exact defect is present, unfixed, in A07's five pages and was present in A10's three pages**
— both reuse the identical `max-w-[920px] ... medium:flex-row medium:items-start` container
pattern A01 had before its own fix, confirmed by direct source comparison:

```
$ grep -rn "medium:flex-row" src/app/dev/ui-lab/gate-a/a07-match-details-edit-lineup/*/page.tsx
  (5 matches — all 5 A07 scenario pages)
$ grep -rn "medium:flex-row" src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/*/page.tsx
  (3 matches, before this PR's fix — now 0)
```

**Reproduction (pre-fix):** open any A07 or (previously) A10 scenario page at a desktop-class
viewport between 600px and 839px wide with the inspector open (e.g. 768px, one of the required
smoke widths per `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`). The match content and the inspector
are forced into a two-column row at a width neither has room for, reproducing the identical squeeze
A01's own round-4 remediation screenshot-verified and fixed. A09 is unaffected — it never engages a
two-column layout at any width (`max-w-[480px]` single column throughout), so there is no
equivalent defect there.

**Resolution, scoped by approval status:**
- **A10 (3 scenarios, still `CANDIDATE`, not yet owner-approved): fixed in this PR.**
  `shared/lineup-proposal-editor.tsx`'s `LineupProposalInspector` now accepts an optional
  `className` (merged via `cn()`, same pattern A01's `LineupContextualInspector` already uses);
  all three A10 pages now use `expanded:flex-row expanded:items-start` for the container,
  `expanded:w-[480px] expanded:shrink-0` for the left column, and pass `className="expanded:flex-1"`
  to the inspector — the identical fix A01 already has, applied consistently rather than
  reinterpreted. `npx tsc --noEmit`, the Gate A node and component vitest suites (231 + 227 tests),
  and `npx eslint src/app/dev/ui-lab/gate-a` all pass after this change (see `AUTOMATED_
  VALIDATION_AND_REGRESSION.md`). This is a layout-only change — no fixture, data, or interaction-
  state-machine file was touched, so no `fixtureVersion` bump was warranted or made.
- **A07 (5 scenarios, `APPROVED_GOLDEN` since 2026-10-11): left untouched. `OWNER_DECISION_
  REQUIRED`, logged in `CONFLICT_AND_BLOCKER_REGISTER.md` as finding `W5-F01`.** Per every prior
  wave's own non-negotiable ("Prior-approved golden changes require owner authorization, not an
  unreviewed clean-up"), this PR does not silently patch an approved golden's component or
  recapture its evidence. The owner needs to decide whether this is `REVISE_REFERENCE` (apply the
  same fix, recapture, and record it as a new approved revision) or `DEFER_NON_BLOCKING_PRODUCTION_
  GAP` (A07 never shipped to production, so the squeeze only affects the design-reference artifact
  itself, not a live user) — see `REVIEW_RECORD.md`.

**Verification: confirmed with real CI screenshots, not left as an inference chain.** This
session's local sandbox cannot run Playwright/`next dev` directly (devcontainer HMR WebSocket
upgrade failure), so `scripts/ui-lab-visual-review.mjs` was extended to add the exact 600/768/900px
widths to A07's and A10's own capture scenarios (`inspectorSqueezeSmokeViewports`, same dimensions
as A01's existing `tablet-600/768/900`) and pushed to this PR's branch, triggering a real CI capture
run. The resulting screenshots confirm both halves of this finding directly:

- `gate-a-w3-a07-assign-reserve-success-squeeze-768-dark-editor-open.png` (CI run `38287815867`,
  artifact `ui-lab-review-38287815867-1`, commit `6faf8d3d2f754ce0aca3c533e63f7af75b55fd16`):
  at 768px, the match-content column is squeezed to a sliver of truncated, unreadable text
  (`AO7`, `Mat`, `Deta`...) while the inspector occupies nearly the full width — the exact defect
  described above, now visually confirmed, not inferred.
- `gate-a-w4-a10-review-alternative-success-squeeze-768-dark-editor-open.png` (same run/artifact):
  at the identical 768px width, the match content and the review inspector both render full-width,
  stacked, fully readable — confirming the fix works exactly as intended, matching A01's own
  approved behavior at the same width.

Both images were inspected directly in this session (not just hash-diffed). See `VISUAL_COVERAGE_
AND_CAPTURE.md` for the full capture inventory this added.

## C-X08 — Comparable semantics across themes

`NOT_TESTED` beyond what each wave's own CI captures already cover (every approved/candidate
scenario is captured in both `dark` and `light` at every viewport, per `authority_inventory.csv`'s
capture counts). No independent side-by-side theme-parity re-inspection was performed in this
session beyond re-reading each wave's own review docs, which report no theme-specific finding.
Status/provenance badges throughout (verified by source read of `SourceInspector`, `A04`'s coverage
badges, A10/A11's outcome banners) use text/icon labels, not color alone, by construction — this is
a structural property of the shared components, not a per-theme check that could silently regress.

## C-X09 — No false "more data" claims

**PASS.** A04-S4's 6-4/one-recorded-event case is unchanged. A10/A11's "(simulated)"/"Fixture-only
simulated review · No server called · Production authorization not verified" captions are present
on every interactive A10/A11 page (confirmed by source grep: `data-testid="fixture-simulation-
caption"` in `lineup-proposal-editor.tsx`, equivalent literal captions in A05/A08/A11). No A10/A11
scenario fabricates xG, possession, or a performance grade anywhere in its fixture data (confirmed:
`fixtures.ts` files for all 13 W4 scenarios contain no such fields).

## C-X10 — Group/tenancy boundaries

**PASS for what a UI Lab can prove; correctly not overclaimed for what it can't.** A10's `shared/
__tests__/lineup-proposal-contract.test.ts` (54 cases per `ACTION_OWNERSHIP.md`) includes explicit
cross-group/cross-match fixture-rejection cases. No W4 fixture exposes another tenant's data. This
remains, correctly, a UI-Lab-only proof — real server-side authorization is an explicit Gate B
prerequisite, not something this wave claims to have verified (see `PRODUCTION_OWNER_AND_GATE_B_
HANDOFF.md`).

## Summary

| Invariant | Status | Blocking? |
|---|---|---|
| C-X01 Identity | PASS | No |
| C-X02 Lifecycle | PASS | No |
| C-X03 Action grammar | PASS | No |
| C-X04 Evidence provenance | PASS (1 pre-existing open question, not a W5 regression) | No |
| C-X05 Position semantics | PASS | No |
| C-X06 Assistant Coach gating | PASS | No |
| C-X07 Responsive interaction | **REVISE** — A10 fixed in this PR; A07 flagged `OWNER_DECISION_REQUIRED` (`W5-F01`) | A07 instance only — blocks re-confirming A07's golden at full confidence, not Gate A audit completion |
| C-X08 Theme parity | NOT_TESTED beyond existing CI captures | No new finding |
| C-X09 No fabrication | PASS | No |
| C-X10 Tenancy | PASS (UI-Lab-provable scope only) | No |
