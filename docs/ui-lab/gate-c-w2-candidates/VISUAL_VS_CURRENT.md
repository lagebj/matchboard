# Gate C W2 — Visual vs. Current Production Comparison

All three candidates reuse the Touchline Design Atlas composition Round Board already has (exception-first status strip, contextual rail, match lanes, inspector/sheet, optional allocation matrix) — **no candidate in this wave is a visual redesign.** What changed, across four remediation passes, is data wiring, a small number of interaction corrections, and (in the fourth pass) one navigation destination's URL and label text — never the layout, never the visual language, never a new composition.

Four categories are used consistently below, per the brief's own classification:

- **Existing production design, confirmed by fixture evidence** — the candidate proves a pre-existing visual/behavioral fact is real; nothing changed.
- **Production behavior corrected during remediation** — a genuine defect in logic/data wiring was fixed; the visual composition itself did not change, only what it now correctly shows or permits.
- **Actual visual presentation changed** — new text, a new tile, a new link: something a coach would see differently. (This wave has exactly two: C04's new coverage tile, and the C06 Lineup link's label/destination.)
- **Original acceptance question not demonstrated** — disclosed as a gap, not silently dropped.

A passing component or Playwright test is **behavioral validation**, not visual approval — none of the evidence below should be read as an owner sign-off. Visual Authority approval is a separate, owner-only action (ADR-0159) and has not been requested for any of these three candidates.

## C04 — Planning open, unresolved player decision

1. **Original acceptance question** (register, verbatim): "Opportunity distribution with eligible denominator near actionable round work" (XR-A02).
2. **Existing visual composition**: exception-first status strip, attention list, match lanes, inspector/sheet composition, valid/override-required destination distinction — all pre-existing Touchline Atlas composition, confirmed unchanged by this candidate.
3. **Actual production changes introduced by W2**: a new "Eligible players with an opportunity" tile on `RoundStatusStrip`, fed by `RoundPlanIntegrity.coverage` for the first time — this data was computed in production before this wave but never read by any UI. This is the one genuine new visual element C04 introduces.
4. **Candidate's demonstrated state**: the tile renders the real coverage numerator/denominator, distinct from the pre-existing "Opportunities planned" (squad-placement count) tile; an unresolved player's attention item reaches a valid Resolve action.
5. **Evidence**: `src/app/dev/ui-lab/gate-c/c04-planning-open/__tests__/page.test.tsx` (6 component tests across 4 fixture variants: zero eligible, all assigned, several missing, primary); `e2e/ui-lab-gate-c.spec.ts`'s C04 desktop + mobile Playwright tests; `docs/ui-lab/gate-c-w2-candidates/capture-attestation.json`'s `gate-c-w2-c04-planning-open` captures.
6. **Deviation from the intended experience**: none identified. The coverage denominator's own naming nuance (not availability-filtered despite the name) is disclosed in `OPPORTUNITY_COVERAGE_SEMANTICS.md`, not a deviation in this candidate's own presentation.
7. **Ready for owner visual review?** Yes, as a `CANDIDATE` — technically complete; owner approval not requested or implied.

## C05 — Planning closed, historical warnings

1. **Original acceptance question** (register, verbatim): "Read-only meaning, no false Resolve action."
2. **Existing visual composition**: closed banner, per-match `isFinalized` gating of remove/move/repair/add on player chips, live-boundary-not-persisted-status gating — all pre-existing, confirmed unchanged.
3. **Actual production changes introduced by W2** (behavior corrections, not visual redesign — the banner/inspector/lane composition itself is unchanged, only what they correctly show or permit):
   - Closed destinations excluded from the suggestion list (previously offered and committable); `closedNotice` explains why, including proactively when the *selected player's own* match is closed.
   - Resolve gated on a real per-match `resolvable` flag, re-checked against the warning's own owning match independently of the player's current assignment (two remediation passes — see `CLOSED_STATE_RULES.md`'s full decision matrix).
   - The mixed-boundary banner now distinguishes "some matches closed" from "all matches closed" instead of one all-or-nothing message.
   - A rejected or errored mutation leaves the inspector/sheet open, preserves the selection, and shows the real reason — never a silent close implying success.
   - Match-specific Resolve now reaches a genuine correction workflow (directs the coach at the Available/unassigned list, not an already-assigned player who can never fill a shortage) — third remediation pass, with mobile focus correctly scoped to the visible composition.
4. **Candidate's demonstrated state**: a closed match's historical warning is readable, has no executable Resolve; an open match's unresolved item reaches a real correction (select an unassigned candidate → commit); mixed-boundary language is accurate; a denied commit preserves context.
5. **Evidence**: `c05-planning-closed/__tests__/page.test.tsx` (12 component tests); `round-board.test.tsx`'s dedicated describe blocks for each fix; `round-board-production-adapter.test.ts`'s resolvability matrix; `e2e/ui-lab-gate-c.spec.ts`'s C05 desktop + mobile tests (closed/open Resolve, Move picker, the full commit/rejection sequence); `capture-attestation.json`'s `gate-c-w2-c05-*` captures (170 screenshots across the primary, open-match-warning, and open-match-warning/denied routes).
6. **Deviation from the intended experience**: none in presentation. The UI Lab fixture harness's `warnings` prop is a frozen snapshot that never recomputes after a mutation (disclosed in `DATA_TRUTH_AND_FIXTURES.md`) — test evidence for a successful commit asserts the real squad-count/available-list update and explicitly does not claim the original warning text disappears, since this fixture limitation (not a production defect) would make that claim false.
7. **Ready for owner visual review?** Yes, as a `CANDIDATE` — technically complete across four remediation passes; owner approval not requested or implied.

## C06 — Dense allocation, position-precision disclosure

1. **Original acceptance question** (register, verbatim): "Match assignment retains 24-slot precision while player summaries/inspectors use 14 general roles" (XR-P02).
2. **Existing visual composition**: the player×match allocation matrix, mobile assignment sheet, shared assignment command across matrix/board/sheet — all pre-existing, now exercised at genuine density (54 players, 4 matches) rather than a small illustrative fixture. This is **existing production design, confirmed by fixture evidence**, not a new capability.
3. **Actual production changes introduced by W2**:
   - A navigation link from the inspector to the player's current match's real Lineup/Formation editor — the one place C06 adds a genuinely new, shipped (not fixture-only) piece of UI. Fourth remediation pass corrected this link's destination to the canonical organisation-scoped route (`/o/{orgSlug}/matches/{matchId}`, not the legacy unscoped `/matches/{matchId}`) and its label from "View exact position in Lineup" to "Open Lineup" — the original label overclaimed that an exact position necessarily already exists, which Round Board has no way to know.
4. **Candidate's demonstrated state — split into two independently-dispositioned concerns** (fourth remediation pass; see `POSITION_VOCABULARY_AND_PRECISION.md`'s full decision record):
   - **C06-A (dense allocation)** — demonstrated: dense matrix readability, mobile assignment workflow, explicit successful and denied outcomes, correct per-match planning boundaries.
   - **C06-B (24-slot vs. 14-role precision)** — **not demonstrated inside Round Board**, and the corrected Lineup link does not change that: it is correct navigation to the feature that *does* own this data, not proof that Round Board itself answers the question. The inspector continues to show `Player.primaryPosition` exactly as production already did (free text), never an implied or fabricated exact-position value.
5. **Evidence**: `c06-dense-allocation/__tests__/page.test.tsx` (6 component tests, including the corrected link-href/label test); `round-board.test.tsx`'s 5 new Lineup-link tests (canonical URL, organisation retention, cross-organisation distinction, no-link-for-unassigned, desktop/mobile parity); `e2e/ui-lab-gate-c.spec.ts`'s C06 tests including the new real-browser navigation test (asserts the exact href and that it reaches the real `/signin` auth boundary); `capture-attestation.json`'s `gate-c-w2-c06-dense-allocation*` captures.
6. **Deviation from the intended experience**: the owner should read C06-A and C06-B as separate acceptance decisions, not one blanket "C06: complete" status — collapsing them would misrepresent what this candidate actually proves.
7. **Ready for owner visual review?** C06-A: yes, as a `CANDIDATE`. C06-B: not applicable — there is no demonstrated capability for the owner to visually review; the correct action is the decision record in `POSITION_VOCABULARY_AND_PRECISION.md`, not a visual approval/rejection.

## What stayed visually identical

`RoundStatusStrip`'s four pre-existing tiles kept their values and tone logic; only labels for two were clarified for accuracy ("Opportunities planned" already existed; "Coverage issues" was relabeled "Squads below minimum" to stop it reading as if it were the new eligible-coverage measure — it was always squad-below-minimum-match-count, never anything about distinct players). `PlayerAssignmentInspector`/`Sheet`'s suggestion cards, the allocation matrix's cell/row/column rendering, and every match lane's chip anatomy are byte-for-byte what production already rendered. The desktop grid's own column widths, breakpoints, and the pre-existing ~600-1200px layout gap (issue #830) are untouched by any pass of this wave — see `BLOCKERS_AND_KNOWN_LIMITATIONS.md`.
