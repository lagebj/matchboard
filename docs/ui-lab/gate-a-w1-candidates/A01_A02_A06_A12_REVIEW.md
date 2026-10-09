# Gate A W0/W1 — A01 / A02 / A06 / A12 Review Record

Status of every case below is **`CANDIDATE`**. None is `APPROVED`. Only the repository owner may
change a case to `APPROVED`, and that approval must be recorded here with reviewer name, date,
and the exact capture SHA-256 it applies to (per-case rows below are placeholders until that
happens — do not infer approval from a general positive comment).

| Case | Fixture ID | Status | Contract refs | Known gaps (post PR #777 remediation, round 3) |
|---|---|---|---|---|
| A01 | `gate-a-a01-sports-first` | `CANDIDATE` | XR-S02, XR-V01, XR-I01 | None open. Round 1: fixed to an in-page `TouchlineBottomSheet`. Round 2: interaction-state capture, Escape-to-close, focus restoration. Round 3 (final correction): desktop now gets a contextual inspector beside the match (not a full-width sheet); mobile keeps the sheet with fixed contrast (`tone="utility"`); both share one `LineupList` component/fixture, exactly one ever mounts. |
| A02 | `gate-a-a02-match-lifecycle` | `CANDIDATE` | XR-S01, XR-V01, D1, D5 | Not in PR #777's scope — unchanged |
| A06 | `gate-a-a06-position-pitches` | `CANDIDATE` | XR-A03, XR-P01–P04 | Round 1 fixed the LB/LWB & RB/RWB grid collision and full 24-code coverage. Round 2 fixed the F/GK edge-clipping (margin added) and removed the unapproved "strongest of group" aggregation rule for consolidated dots (now an explicitly-labeled illustrative placeholder) — **open product question, documented not decided:** whether/how a real cross-position aggregate should ever be computed. |
| A12 | `gate-a-a12-profile-editor` | `CANDIDATE` | XR-P01–P04 | DM/AM/F → CDM/CAM/CF stored-candidate mapping is display metadata only, pending real domain migration authority (unchanged). Round 1 added the full primary/secondary/tertiary editor. Round 2 split the legacy preview into Case A "Legacy declared positions" / Case B "Recorded match exposure" (declared authority and measured evidence are no longer conflated), plus an interaction-state capture. |

See each case's `visual_vs_current/<CASE>.md` for the detailed before/after and the specific
F1–F6 directional-study findings each fix was checked against.

## How to review each case

1. Open the PR's CI artifact (`ui-lab-review-<run_id>-<attempt>`, 7-day retention) or run locally:
   `npx playwright install --with-deps chromium && next dev -p 3333 &` then
   `UI_LAB_BASE_URL=http://localhost:3333 node scripts/ui-lab-visual-review.mjs`. Captures include
   a `narrow` (320px) viewport alongside `desktop`/`mobile`, and A01/A12 each have an additional
   interaction-state capture (`...-lineup-open.png`, `...-editor-expanded.png`) — review both the
   initial and interaction-state screenshots for those two cases. For A01 specifically, confirm the
   desktop `lineup-open` captures show a contextual inspector beside the match (not a full-width
   sheet) and the mobile/narrow `lineup-open` captures show a readable, non-translucent sheet.
2. Compare each capture's SHA-256 against `capture-attestation.json` (not
   `candidate_manifest.json`, which holds stable metadata only) to confirm you're reviewing
   exactly what this PR produced, and that the attestation's `sourceCommitSha` matches the commit
   you're looking at.
3. Read the matching `visual_vs_current/<CASE>.md` for what changed and why, including the
   specific F1–F6 directional-study findings each fix was checked against.
4. Reply per case: `APPROVED`, `REVISE` (with what to change), or `BLOCKED` (with the blocker).
   `APPROVED` requires your name, the date, and which capture SHA-256 you're approving —
   recorded back into `candidate_manifest.json`'s `approval` object for that case, never inferred.

## Non-negotiables honored by this PR

- No production route, `src/domain/**`, production `src/components/**`, Prisma schema, auth, or
  deployment file touched (verified in `CHANGED_FILES.md`).
- No fabricated statistics: A02's planned state has `score: null`; A12's evidence totals are a
  pure sum of real fixture intervals, unit-tested.
- No `Date.now()` in any new fixture — `src/app/dev/ui-lab/gate-a/shared/match-identity-fixture.ts`
  uses a fixed UTC date.
- No AI mutation, no automatic primary-position promotion, no late-RSVP exception logic anywhere
  in this candidate.
- PR stays in draft; this document and `candidate_manifest.json` are the only approval record —
  nothing here is self-certified.
