# Gate B W1 — Review Record

| Scenario | Status | Notes |
|---|---|---|
| B01 | `CANDIDATE` | Pending owner review. Phase 2: invented duplicate `DecisionBanner` found and removed. Phase 3 (B1-R2/R3/R4): lineup-replacement bug fixed, insight evidence reclassified/re-backed, same-match AFTER companion added. |
| B02 | `CANDIDATE` | Pending owner review. Phase 2: same `DecisionBanner` duplication found and removed. |
| B03 | `CANDIDATE` | Pending owner review. Phase 2: reclassified `CONFIRMS_SHIPPED_BASELINE` → `PROPOSED_REFINEMENT`. Phase 3 (B1-R5): reconciliation note rewritten to remove implementation commentary. |
| B04 | `CANDIDATE` | Pending owner review. Phase 2: re-audited, confirmed. Phase 3 (B1-R3): insight evidence model rebuilt with a genuine second-match source and a real evidence-inspection composition. |

## Phase 3 — independent technical review remediation

An independent technical review (reviewing head `f71bfc628`) raised five findings — B1-R1 through
B1-R5, two P1 and one P1 plus two P2 — all fixed on this branch. See `BLOCKERS.md` for the full
summary and `VISUAL_VS_CURRENT.md` for per-scenario detail. This was a correction pass on the
existing candidates, not a new design proposal.

## Phase 2 — design-audit outcome (owner-requested genuine exploration)

The owner asked this wave to pursue real design exploration for decision 1, assess real value for
decision 2 (fixture-injectability), and asked for advice on decision 3 (Event/League parity). See
`SOURCE_RECONCILIATION.md` for the full writeup. Outcome: two real issues found and fixed in the
existing candidates (B01/B02 duplicate banner), one genuine refinement proposed (B03's Match Flow
reconciliation note), one scenario re-confirmed rather than assumed (B04), decision 2 recommended
deferred (not needed by either finding), decision 3 grounded in `docs/agents/event-and-league-behavior.md`
+ ADR-0011 (real gap, not an intentional boundary) in `BLOCKERS.md`.

**No `APPROVED_GOLDEN` status is claimed anywhere in this wave.** Promotion to `APPROVED_GOLDEN`
requires explicit owner review of the exact evidence and revision — the same gate Gate A used
(see `docs/ui-lab/gate-a-w3-candidates/candidate_manifest.json` for the precedent `approval`
schema this wave's manifest will adopt once/if approval happens).

## Required before any approval

1. Owner answers `SOURCE_RECONCILIATION.md`'s framing question (confirm-via-fixture vs.
   propose-new) — resolved by the owner in Phase 2 as genuine exploration; see that file.
2. `.github/workflows/ui-lab-visual-review.yml` has run on this PR and produced a real
   `capture-attestation.json` — **done**: committed in this directory, 96 captures, run
   `39386349849`, every hash independently re-verified (see `BLOCKERS.md`).
3. Owner reviews the resulting captures across all required viewports/themes/interaction states
   (1440×900, 390×844, 360px/430px smoke, plus 600/768/900px squeeze widths for B01 only) against
   `VISUAL_VS_CURRENT.md`'s stated identical/differs breakdown. Still outstanding — captures exist
   and are attested, but no human has reviewed them yet.

## Technical review checklist (self-assessed by the implementer; independent review still needed)

- [x] `npm run lint` clean on all new files.
- [x] `npx tsc --noEmit` clean, project-wide.
- [x] All new tests pass (`npm test`-equivalent: default + components vitest configs, scoped to
      `src/app/dev/ui-lab/gate-b`, run alone — not concurrently with any other suite).
- [x] No forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)
      anywhere in fixtures or rendered output (enforced by test).
- [x] No fabricated assist pairing (enforced by test).
- [x] No production route, component, data loader, or schema file modified.
- [x] `npm run build` — not run locally (known pre-existing OOM in this sandbox), but CI's own
      `Build` job passed on this branch head.
- [x] Real CI visual capture — passed (`Capture fixture-backed UI Lab views`, run `39386349849`,
      11m15s); `capture-attestation.json` committed with all 96 hashes independently re-verified.
