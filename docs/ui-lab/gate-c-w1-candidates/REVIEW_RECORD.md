# Gate C W1 — Review Record

## Disposition

`READY_FOR_INDEPENDENT_REVIEW`

## Summary

Eight candidates (C01, C02, six C03 phase/source combinations) mount the real, unmodified
production `TodaySurface`/`TodayMatchday` against fixtures built against real production type
contracts. `CURRENT_STATE_AUDIT.md` classifies every underlying Today behavior
`CONFIRMS_SHIPPED_BASELINE` — this wave is a documentation-and-capture exercise for already-
correct production behavior, not a redesign. No production Today file is changed.

No official Gate C wave-ordering document exists in the handoff bundle (`SOURCE_RECONCILIATION.md`);
this wave's scope (C01-C03) is self-assigned per the brief's own fallback instruction. C07
(Assistant Coach fallback) and C04-C06/C08 (Round Board) are explicitly deferred, with reasons,
in `BLOCKERS.md`.

## Validation

- `npm run typecheck` — clean.
- `npm run lint` — clean (3 pre-existing, unrelated warnings in `compute-plan-integrity.ts`).
- `npm test` (Vitest node + component suites) — 592+162 files, 6564+1011 tests, all passing,
  including 10 new Gate C test files / 21 new tests.
- `npm run build` — not completed locally (OOMs in this sandbox on a clean `main` too, a
  pre-existing sandbox memory limitation unrelated to this change; CI's `ci-checks.yml` build
  job is the authoritative result).
- `e2e/ui-lab-gate-c.spec.ts` — 55/55 passing locally against a local `next dev` server on the
  `ui-lab-gate-c` Playwright project, exactly mirroring how CI's `ui-lab-visual-review.yml` runs
  it.
- `node scripts/ui-lab-visual-review.mjs` — run locally against the same local server to confirm
  the eight new Gate C scenarios capture cleanly end-to-end (readiness gate, overflow gate,
  console-error gate) before pushing; see this file's own capture-run note below once the local
  run completes.

## Capture evidence

Real Chromium capture evidence is produced by CI (`ui-lab-visual-review.yml`'s `capture` job)
against this branch's head commit. `capture-attestation.json` is added in a follow-up commit on
this same branch once that CI run completes, per this repository's established two-commit
attestation convention (implementation commit → CI produces real captures → attestation commit
referencing the real run URL and independently re-verified hashes) — it is not fabricated ahead
of that run.

## Visual Authority Gate

Per ADR-0159 (as amended by PR #825): this PR does not post `/visual-approve` or
`/visual-reject`. The owner reviews the rendered CI capture evidence and the real routes under
`/dev/ui-lab/gate-c/` directly, then comments their own approval/rejection on the PR, optionally
scoped with `scenarios: GATE-C-W1-C01, GATE-C-W1-C02, ...`. `candidate_manifest.json`'s
`approval: null` is not evidence of no approval — the PR's own `Visual Authority Gate` check and
`npm run visual-authority:status -- --gate C` (once that gate id is recognized) are the
authoritative source for the real effective state.

**This PR's `Visual Authority Gate` check currently reports `INVALID`, not
`AWAITING_APPROVAL`** — but for a reason unrelated to Gate C: evaluating it surfaced a
pre-existing fingerprint-staleness defect affecting Gate B's already-approved B01/B01-AFTER/
B02/B03/B04 (see `BLOCKERS.md` and
[issue #827](https://github.com/lagebj/matchboard/issues/827)). This PR does not touch any of
those scenarios' files; the drift predates this branch. Once the owner posts a fresh
`/visual-approve` scoped to those five scenarios (clearing the pre-existing INVALID state) and
separately approves Gate C's own eight scenarios once CI's real captures are in, this check
reports `APPROVED`.

## Known limitations

- Tactics readiness is fixed at `UNKNOWN` in every C03 fixture (see `BLOCKERS.md`) —
  `resolveTodayMatchdayAction()`'s `MISSING_TACTICS` branch is not exercised by this wave's
  capture coverage, though the function itself is unchanged, already-tested production code.
- C07, C04-C06, and C08 are not part of this wave (see `BLOCKERS.md`).
