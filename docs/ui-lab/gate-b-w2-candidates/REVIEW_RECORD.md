# Gate B W2 — Review Record

| Scenario | Status | Notes |
|---|---|---|
| B05 | `CANDIDATE` / `APPROVED_GOLDEN` | **Approved.** Real owner review of the live Test-slot deploy (test.matchboard.football), resolved via `/visual-approve b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`, 2026-10-21. PR #805 merged. First pass: confirms the real shipped Post-Match Report composition against the register's "finish/report actions versus read-only knowledge" requirement — no fabricated gap found, no design proposal made. B2-R1: this PR's own first CI capture run found and fixed a real pre-existing bug in `RecoveredTimingCallout` (invalid HTML nesting). |
| B05-COMPLETED | `CANDIDATE` / `APPROVED_GOLDEN` | **Approved** — same approval event as B05 (one PR, one `/visual-approve` comment covers both scenarios). Shares B05's real match identity and debrief. |

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

## Approval — recorded

Both scenarios' `candidate_manifest.json` entries now carry a real `approval` block
(`state: "APPROVED"`, `scope: "APPROVED_GOLDEN — design reference only; NOT production
implementation authorization"`, `approvedBy: "lagebj"`, `revisionSha:
"b9a95c9dbf4289a2727a15bd73375a4dc6381e2e"`), written by `scripts/visual-authority/
promote-to-golden.mjs` in a follow-up commit after the real approval, using the exact schema Gate
A and Gate B W1 both established. `approvedCaptures` for both entries are copied from, and match
exactly, the committed `capture-attestation.json`'s own independently-re-verified hashes — no new
hash was invented at promotion time. `releaseStatus` remains `PENDING` (no durable GitHub Release
attempted yet), same as every other un-released Gate A/B wave.

## What was required before approval (all satisfied)

1. Owner review of `SOURCE_RECONCILIATION.md`'s framing question (confirm-via-fixture vs.
   propose-new) — resolved via the real `/visual-approve`.
2. `.github/workflows/ui-lab-visual-review.yml` ran on this PR and produced a real
   `capture-attestation.json` — **done**: committed in this directory, **24 captures** (run
   `39593337123`, branch head `1b91b7cb6`, after the B2-R1 fix), every hash independently
   re-verified (see `BLOCKERS.md`).
3. **ADR-0159's `Visual Authority Gate`** — the first Gate B wave subject to it as a real,
   required, merge-blocking check (Stage B activated earlier in this same session). The first
   `/visual-review deploy` request was itself declined by a real circularity bug, fixed in #806
   (merged first); the second request succeeded and was then independently clobbered by
   `test-db-migrate.yml`'s own (deliberate, documented) baseline-reclaim on an unrelated `main`
   push, requiring a third, uncontested deploy before the owner could actually review it live.
4. Owner reviewed the live Test-slot deploy at test.matchboard.football against
   `VISUAL_VS_CURRENT.md`'s stated identical/differs breakdown and resolved
   `/visual-approve b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`.

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
