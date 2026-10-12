# Gate A W5 — Interaction and State-Machine Coherence Audit

Per `07_INTERACTION_AND_STATE_MACHINE_COHERENCE.md`. Method: source/test reading across W3 (A03/
A07/A09) and W4 (A05/A08/A10/A11), plus the targeted breakpoint-source comparison that produced
this audit's one real finding. No live browser session was available (see `CROSS_WAVE_
CONSISTENCY.md`'s header note) — items needing a live render beyond existing CI captures are
marked `NOT_TESTED`.

## 1. Context-local scope

**PASS.** A07/A10's lineup actions stay inside their Match Details-shaped page shell (never a
route change — confirmed: no scenario's test file exercises `next/navigation`'s router, per
`A03_A07_A09_REVIEW.md`'s "Data-truth invariant tests" item 2, and A10 reuses the identical
pattern). A09's quick action stays within its Today-shaped context. A05/A08/A11 use `SAME_VIEW`
throughout (no dialog). No `SEPARATE_WORKSPACE`/`NEW_PAGE` navigation exists anywhere in A01-A12.

## 2. Responsive inspector/sheet width

**`REVISE` → fixed for the unapproved instance.** See `CROSS_WAVE_CONSISTENCY.md` C-X07 for the
full writeup: A07 (approved) and A10 (candidate, now fixed) both reused a `medium:flex-row` (600px)
two-column engagement that collides with the same-threshold inspector-vs-sheet decision — the exact
defect A01's own round-4 remediation already found and fixed via a decoupled `expanded` (840px)
breakpoint. A09 has no two-column layout at any width and is unaffected.

**Explicit breakpoint check at 768px: `CONFIRMED` with real CI screenshots.** This local sandbox
cannot run Playwright directly, so `scripts/ui-lab-visual-review.mjs` was extended with 600/768/900px
capture widths for A07's and A10's scenarios and pushed to this PR's branch (CI run `38287815867`,
artifact `ui-lab-review-38287815867-1`). The resulting screenshots, inspected directly:
`gate-a-w3-a07-assign-reserve-success-squeeze-768-dark-editor-open.png` shows the match-content
column squeezed to an unreadable sliver at 768px (the defect, still present — A07 untouched);
`gate-a-w4-a10-review-alternative-success-squeeze-768-dark-editor-open.png` shows both the match
content and the inspector rendering full-width, stacked, fully readable at the identical width (the
fix, confirmed working). A09's single `max-w-[480px]` column was not separately re-screenshotted at
these widths since it structurally cannot change shape (no row/column breakpoint exists in its
markup at all — confirmed by source read, not just by absence of a capture). The full
320-1440px sweep beyond 600/768/900 was not re-captured in this session; those three widths bound
the exact squeeze range (600 = inspector turns on, 840 = row layout engages) and are sufficient to
confirm both the defect and the fix.

## 3. Focus restoration, pending guards, dirty-close

**PASS.** A07/A09's `useDirtyCloseGuard` cannot close or offer discard while `status === "PENDING"`
(`A03_A07_A09_REVIEW.md` item 9, both as a pure-hook invariant and via real Close/Escape
interactions on representative pages). A10 reuses the identical hook unmodified (confirmed:
`a10-assistant-coach-structured-action/*/page.tsx` imports `useDirtyCloseGuard` from the same
`../../shared/fixture-operation` A07 imports from — same module, not a parallel reimplementation).
A10's round-1 finding R3 (Discard unavailable while PENDING, centralized in
`deriveOperationControlPolicy`) and R4 ("already applied" derived from the authoritative pitch
projection, not a component-local boolean) are both still present in current source. Focus
restoration to the opening trigger on close/Escape is implemented identically in A01 (`
lineupTriggerRef`), A07/A09/A10 (`triggerRef`) — same pattern, confirmed by source read across all
three families.

## 4. A10 evidence inspection cannot mutate

**PASS.** `<details>`/`<summary>` evidence disclosure is a sibling control, never nested inside the
"Select proposal" button (round-2 finding N2, confirmed still fixed in current source). Proposal
preview names both the slot and the actual proposed player by name (round-2 finding N3). `ASSIGN_
PLAYER_TO_LINEUP_SLOT` is empty-slot-only, enforced by `TARGET_SLOT_OCCUPIED` (round-3 finding F1)
— occupied-slot replacement is explicitly rejected, not silently accepted. Stale/malformed/blocked
proposals render no Select/Apply row at all (`applicability: "STALE"` blocks structurally before
any submit, confirmed in `stale-proposal-blocked/fixtures.ts`).

## 5. Post-SUCCESS authoritative projection changes exactly once

**PASS.** A07's pitch assignment count goes 6→7 only after a genuine `resolvePending()` call
following `SUCCESS` (`A03_A07_A09_REVIEW.md` item 5). A10 reuses the same `useFixtureOperation.
authoritative` state for its pitch re-render (confirmed: `matchW3PlanningPitchAssignments(op.
authoritative)`, identical call shape to A07's). Reopening A10 after `SUCCESS` shows "Already
applied (simulated)" derived from that same authoritative state, never a freshly-actionable
proposal (round-1 finding R4).

## 6. A11 review outcomes

**PASS.** `useProfileChangeReview` models a real authoritative `declaredPrimary` projection; Accept
genuinely changes it exactly once (idempotent against a repeated click), Reject/Defer leave it
provably unchanged, and the outcome message is read from that same state rather than a canned
string (independent-review finding R5, confirmed present in current `shared/profile-change-review-
card.tsx`). No `PENDING` step exists for A11 (by design — the source document describes a direct
decision, not a server round-trip, per `ACTION_OWNERSHIP.md`).

## 7. A03 integrity signals / A09 RSVP edge cases

**PASS, with pre-existing disclosed limitations unchanged.** A03's permitted-action and
"Review plan" controls only toggle an inline disclosure panel — no mutation exists to misrepresent
as a next action (`ACTION_OWNERSHIP.md` A03 row). A09-S3's RSVP-deadline-block fixture remains
explicitly `SYNTHETIC_LABELED`/illustrative (W3-BLK-01, unresolved — Matchboard has no automated
RSVP-deadline mechanism in source today; this is a disclosed product-policy gap, not a W5 finding).

## Severity classification of this audit's one finding

Per the bundle's own rubric (`07_INTERACTION_AND_STATE_MACHINE_COHERENCE.md` "Severity"): the
A07/A10 breakpoint squeeze is a **layout defect at a specific width range, not a hidden mutating
action, wrong entity/slot, implicit write, or permission bypass** — so it does not meet the
"Blocker" bar on its own technical severity. It is classified here as a **Review decision** for A07
specifically (because fixing it would touch an already-`APPROVED_GOLDEN` component and capture set,
which per every prior wave's own non-negotiable requires explicit owner authorization, not an
unreviewed clean-up — see `CONFLICT_AND_BLOCKER_REGISTER.md` `W5-F01`) and already resolved,
no-decision-needed for A10 (unapproved, narrow dev-only fix, in scope by this PR's own mandate).
