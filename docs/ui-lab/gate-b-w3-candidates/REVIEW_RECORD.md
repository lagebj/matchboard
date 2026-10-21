# B06 — Review record

## Retrospective remediation (B3-R1 through B3-R7)

A follow-up technical review found and fixed seven issues in the original candidates (capture
coverage silently incomplete; a cross-match link to B05; an invalid Guest-Player evidence
assignment; two backwards fixture clocks; engineering commentary in coach-facing copy; invalid
per-match combination-evidence fields; a documentation error describing `revalidatePath()` as
navigation) — see `BLOCKERS.md` and `SOURCE_RECONCILIATION.md` for the full detail. The table
below reflects the corrected state; no approval has ever been recorded for any B06 scenario, so
there is no historical approval to preserve here (contrast B05/W2).

| Scenario | Status | Notes |
|---|---|---|
| B06-LEAGUE-BEFORE | CANDIDATE | Confirms shipped baseline |
| B06-LEAGUE-AFTER | CANDIDATE | Confirms shipped baseline; no longer links to the unrelated B05 candidate (B3-R2); links to the real League Match Details navigation page instead (B3-R5) |
| B06-EVENT-BEFORE | CANDIDATE | Design proposal — no production route exists |
| B06-EVENT-AFTER | CANDIDATE | Confirms the real shared `PostMatchReportShell`; page itself is a proposal; football observation reassigned off the Guest Player (B3-R3) |

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
- [ ] Independent technical review — not yet performed on this wave (now including the
  retrospective remediation below).
- [x] Visual Authority Gate — evaluated against this PR's final revision prior to the
  remediation (`1c185cc01f8a6ee46f958792e0b04e8105f86b05`); reports the expected
  `AWAITING_APPROVAL`/`fail` state pending the owner's own review and `/visual-approve` — this is
  correct, not a defect. Will re-evaluate against the remediated revision once pushed.

## Technical review checklist — B3-R1 through B3-R7 remediation (self-assessed; independent review still needed)

- [x] B3-R1: capture coverage is now a hard CI failure if any registered scenario produces zero
  captures.
- [x] B3-R2: no B06 page links to B05 or any other unrelated match's candidate.
- [x] B3-R3: no football observation is assigned to a Guest Player (verified by test against the
  real `b06EventParticipants` fixture).
- [x] B3-R4: both AFTER candidates' reference times are after their own kickoff/completion, never
  before (verified by test).
- [x] B3-R5: every Before/After page links to and from a real, fixture-backed navigation page for
  its own origin, not only `CompareNav`.
- [x] B3-R6: no filename, function name, or documentation reference appears in any rendered
  coach-facing text (verified by direct re-read of every page's JSX).
- [x] B3-R7: Event · After's combination evidence follows the same real per-match rules as B05's
  own B2-R4 fix (verified by test).
- [x] `npx tsc --noEmit`, `npx eslint`, both Vitest suites (node + components) pass for the full
  `gate-b/` tree, with no regressions.
- [ ] Independent technical review of the remediation — not yet performed.
