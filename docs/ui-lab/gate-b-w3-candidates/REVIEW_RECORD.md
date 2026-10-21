# B06 — Review record

| Scenario | Status | Notes |
|---|---|---|
| B06-LEAGUE-BEFORE | CANDIDATE | Confirms shipped baseline |
| B06-LEAGUE-AFTER | CANDIDATE | Confirms shipped baseline; links to the real B05 candidate |
| B06-EVENT-BEFORE | CANDIDATE | Design proposal — no production route exists |
| B06-EVENT-AFTER | CANDIDATE | Confirms the real shared `PostMatchReportShell`; page itself is a proposal |

## This wave's own design-audit outcome

No duplicate-information violation found (contrast B01's Phase 2 design-audit correction, which
removed a `DecisionBanner` restating `MatchPreparationWidget`'s own output). B06's two
`DecisionBanner`s (Event · Before, Event · After) each state a fact no other component on the
page states — the "not a production route" disclosure and the "Event-scoped return destination"
finding, respectively.

## Approval — not yet recorded

Every candidate's `candidate_manifest.json` entry has `status: "CANDIDATE"` and `approval:
null`. No `/visual-review deploy` has been requested, no live preview has been reviewed, and no
`/visual-approve`/`/visual-reject` comment exists on this PR yet.

## What is required before approval (per ADR-0159 / the working-session doc)

1. Push this branch, open the PR.
2. Let `ci-checks.yml` and `security.yml` go green.
3. Independent technical review of this PR.
4. Let `ui-lab-visual-review.yml` produce real capture evidence; add `capture-attestation.json`
   in a follow-up commit (see BLOCKERS.md). **Done** — run 39637600700, 40 captures, committed.
5. Request a live preview only if actually needed, via `/visual-review deploy` — a deliberate,
   explicit request, not automatic.
6. The repository owner reviews the rendered output and comments `/visual-approve <sha>` or
   `/visual-reject <sha>` themselves — never this agent, under any framing.
7. Promote approved evidence to a golden record via the existing
   `scripts/visual-authority/promote-to-golden.mjs` script, reusing Gate A's established
   `approval` schema.
8. Merge only once the `Visual Authority Gate` required status check reports `success`.

## Technical review checklist (self-assessed by this wave's author, not a substitute for
independent review)

- [x] `npm run lint` passes on every file this PR touches (verified against CI's real `Lint` job,
  which also runs `terminology:check`/`docs:check` — see BLOCKERS.md's terminology fix).
- [x] `npx tsc --noEmit` passes project-wide.
- [x] Both real test suites pass project-wide: the node-only suite (`vitest run`, 6346 tests) and
  the component suite (`vitest run --config vitest.config.components.ts`, 824 tests) — CI's
  `Tests` job runs both, matching `npm test`; a bare `npx vitest run` alone silently skips every
  `.test.tsx` file and is not sufficient evidence by itself (caught this the hard way — see
  BLOCKERS.md).
- [x] `npm run terminology:check` passes.
- [x] No fake editability — every interactive-looking control either really works (a `next/link`
  to a real route), is plain disclosure text, or resolves to an honest, logged failure.
- [x] No cross-organisation/cross-squad data leakage in any fixture.
- [x] No fabricated measures (possession/xG/shots/cards/rating/Player of the Match) — enforced by
  each scenario's own `fixtures.test.ts`.
- [x] `npm run build` — not run locally (this sandbox OOMs on `next build` even on a clean `main`
  checkout, pre-existing/environment-specific); verified via CI's real `Build` job instead, which
  passed.
- [x] Real CI capture evidence exists and every scenario renders correctly against a real
  Next.js server (`Capture fixture-backed UI Lab views` job, run 39637600700) — this is also what
  caught the one real bug in this wave's own new code (a missing `"use client"` directive),
  invisible to both local test suites.
- [ ] Independent technical review — not yet performed on this wave.
- [x] Visual Authority Gate — evaluated against this PR's final revision
  (`1c185cc01f8a6ee46f958792e0b04e8105f86b05`); reports the expected `AWAITING_APPROVAL`/`fail`
  state pending the owner's own review and `/visual-approve` — this is correct, not a defect.
