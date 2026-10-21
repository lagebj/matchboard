# Gate B W2 — Review Record

| Scenario | Status | Notes |
|---|---|---|
| B05 | `CANDIDATE` | Pending owner review. First pass: confirms the real shipped Post-Match Report composition against the register's "finish/report actions versus read-only knowledge" requirement — no fabricated gap found, no design proposal made. B2-R1: this PR's own first CI capture run found and fixed a real pre-existing bug in `RecoveredTimingCallout` (invalid HTML nesting). |
| B05-COMPLETED | `CANDIDATE` | Pending owner review. Same pass; shares B05's real match identity and debrief. |

## Phase B2-R1 — CI capture finding, fixed

This PR's first CI run of `ui-lab-visual-review.yml` failed: the draft scenario's real,
browser-rendered page produced real React console errors from invalid HTML nesting inside
`src/components/matches/recovered-timing-callout.tsx` (a genuinely pre-existing bug — B01-B04
never exercised this component). Fixed on this branch; full detail in `BLOCKERS.md`. This is the
one real production file this PR touches.

## This wave's own design-audit outcome

Read the real `PostMatchReportPageShell`/`PostMatchReportShell`/`PostMatchDebrief` composition
directly against B05's register language (see `SOURCE_RECONCILIATION.md`'s framing decision).
Outcome: the real, already-shipped composition already satisfies the register row — no invented
duplicate control, no missing disclosure, no proposed refinement. See `VISUAL_VS_CURRENT.md`.

**No `APPROVED_GOLDEN` status is claimed anywhere in this wave.** Promotion requires explicit
owner review of the exact evidence and revision — the same gate Gate A and Gate B W1 both used.

## Required before any approval

1. Owner answers `SOURCE_RECONCILIATION.md`'s framing question (confirm-via-fixture vs.
   propose-new) — open, not yet answered for this wave.
2. `.github/workflows/ui-lab-visual-review.yml` has run on this PR and produced a real
   `capture-attestation.json` — **done**: committed in this directory, **24 captures** (run
   `39593337123`, branch head `1b91b7cb6`, after the B2-R1 fix), every hash independently
   re-verified (see `BLOCKERS.md`).
3. **ADR-0159's `Visual Authority Gate` is a real, required, merge-blocking check on this PR** —
   the first Gate B wave subject to it (Stage B was activated in this same session, after
   PR #802/#804). This PR cannot merge without a real `/visual-approve <sha>` comment from the
   repository owner, regardless of CI/technical review outcome.
4. Owner reviews the resulting captures across all required viewports/themes/interaction states
   (1440×900, 390×844, 320×720 + 360/430px smoke, both themes; plus the `completed-transition`
   interaction on desktop/mobile for the draft scenario) against `VISUAL_VS_CURRENT.md`'s stated
   identical/differs breakdown.

## Technical review checklist (self-assessed by the implementer; independent review still needed)

- [x] `npm run lint` clean on all new files.
- [x] `npx tsc --noEmit` clean, project-wide.
- [x] New unit/component tests pass (`npx vitest run` + `npx vitest run --config
      vitest.config.components.ts`, both scoped to
      `src/app/dev/ui-lab/gate-b/b05-post-match-report`, and the full `npm test` suite run
      afterward with no new failures elsewhere).
- [x] No forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)
      anywhere in fixtures or rendered output (enforced by test).
- [x] No fabricated assist pairing — the report-fallback timeline builder's own real rule
      (ADR-0147 §5), not independently re-tested here (already covered by the production
      function's own tests; this wave's fixtures pass a goal list no different in shape from
      B03/B04's).
- [x] `fixtureSha256` independently recomputed from the raw records in both `fixtures.test.ts`
      files (not a copied literal — found and fixed before commit, same B1-R7 discipline Gate B
      W1 established).
- [x] `afterData.playerMinutes` (a `Map`, which `JSON.stringify` silently drops) is explicitly
      spread into `rawRecordsForHash` as entries — checked directly against the B1-R7 lesson
      rather than reproducing the same class of bug.
- [x] No production route, data loader, or schema file modified. One production component
      (`recovered-timing-callout.tsx`) got a narrow markup-only bug fix — B2-R1, see
      `BLOCKERS.md`.
- [x] `npm run build` / `npm test` (full suite) re-run locally after the B2-R1 fix — no
      regressions.
- [x] Real CI visual capture — first run failed on the B2-R1 finding; fixed, re-pushed, re-run
      passed (`39593337123`, 13m22s). `capture-attestation.json` committed with all 24 hashes
      independently re-verified.
- [ ] Independent technical review — not yet performed on this wave.
