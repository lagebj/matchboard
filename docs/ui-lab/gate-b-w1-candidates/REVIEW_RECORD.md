# Gate B W1 — Review Record

| Scenario | Status | Notes |
|---|---|---|
| B01 | `CANDIDATE` | Pending owner review. |
| B02 | `CANDIDATE` | Pending owner review. |
| B03 | `CANDIDATE` | Pending owner review. |
| B04 | `CANDIDATE` | Pending owner review. |

**No `APPROVED_GOLDEN` status is claimed anywhere in this wave.** Promotion to `APPROVED_GOLDEN`
requires explicit owner review of the exact evidence and revision — the same gate Gate A used
(see `docs/ui-lab/gate-a-w3-candidates/candidate_manifest.json` for the precedent `approval`
schema this wave's manifest will adopt once/if approval happens).

## Required before any approval

1. Owner answers `SOURCE_RECONCILIATION.md`'s framing question (confirm-via-fixture vs.
   propose-new).
2. `.github/workflows/ui-lab-visual-review.yml` runs on this PR and produces a real
   `capture-attestation.json` (not committed yet — see `BLOCKERS.md`).
3. Owner reviews the resulting captures across all required viewports/themes/interaction states
   (1440×900, 390×844, 360px/430px smoke, plus 600/768/900px squeeze widths for B01 only) against
   `VISUAL_VS_CURRENT.md`'s stated identical/differs breakdown.

## Technical review checklist (self-assessed by the implementer; independent review still needed)

- [x] `npm run lint` clean on all new files.
- [x] `npx tsc --noEmit` clean, project-wide.
- [x] All new tests pass (`npm test`-equivalent: default + components vitest configs, scoped to
      `src/app/dev/ui-lab/gate-b`, run alone — not concurrently with any other suite).
- [x] No forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)
      anywhere in fixtures or rendered output (enforced by test).
- [x] No fabricated assist pairing (enforced by test).
- [x] No production route, component, data loader, or schema file modified.
- [ ] `npm run build` — not run locally (known pre-existing OOM in this sandbox; relies on CI).
- [ ] Real CI visual capture — pending this PR's own workflow run.
