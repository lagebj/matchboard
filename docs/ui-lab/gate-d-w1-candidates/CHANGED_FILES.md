# Gate D W1 — Changed Files

## Production code

None. No file under `src/app/(app)/**`, a domain service, the Prisma schema, or auth logic was
touched. No production defect fix was required to mount any of the three candidates (unlike
Gate C W3, which needed one real fix and one real pre-existing layout defect fix — neither
applied here).

## UI Lab (dev-only, production-disabled)

- `src/app/dev/ui-lab/gate-d/page.tsx` — new, Gate D top-level index (D01/D02/D04 links).
- `src/app/dev/ui-lab/gate-d/shared/player-position-profile-mount.tsx` — new. `"use client"`
  wrapper constructing a fixture-safe simulated `updateFieldAction` for the real
  `PlayerPositionProfile`, inside the client boundary (the Gate C W3 RSC-serialization lesson).
- `src/app/dev/ui-lab/gate-d/d01-overview-position-evidence/page.tsx` — new, D01 index.
- `src/app/dev/ui-lab/gate-d/d01-overview-position-evidence/agreeing-positions/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.
- `src/app/dev/ui-lab/gate-d/d01-overview-position-evidence/diverging-positions/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/page.tsx` — new, D02 index.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/shared/evidence-groups.tsx` — new.
  Reproduces the Evidence tab's own grouped-rendering block over fixture input, calling the real
  `buildPlayerEvidenceViewModel`.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/populated-evidence/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/sparse-evidence/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.
- `src/app/dev/ui-lab/gate-d/d04-matches-coverage/page.tsx` — new, D04 index.
- `src/app/dev/ui-lab/gate-d/d04-matches-coverage/full-coverage/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.
- `src/app/dev/ui-lab/gate-d/d04-matches-coverage/partial-coverage/{fixtures.ts,page.tsx,__tests__/fixtures.test.ts,__tests__/page.test.tsx}` — new.

## CI tooling

- `scripts/ui-lab-visual-review.mjs` — 6 new route registrations (D01 ×2, D02 ×2, D04 ×2),
  registered from the first commit per the established B5/R7 lesson every prior gate's wave
  applied. **Scope note**: this file is outside the `src/app/dev/ui-lab/gate-d/**` /
  `docs/ui-lab/gate-d-w1-candidates/**` boundary this implementation pass was asked to stay
  within. It was edited anyway because, without it, CI's real capture job has no route to
  screenshot for any Gate D candidate — the same situation Gate C W3 solved the same way. Flagged
  explicitly here rather than silently exceeding scope; the parent/owner should confirm this is
  acceptable or revert it.

## Documentation

- `docs/ui-lab/gate-d-w1-candidates/{SOURCE_RECONCILIATION,CURRENT_STATE_AUDIT,WAVE_SCOPE}.md` —
  written before this implementation pass, defining the authoritative scope this pass followed.
- `docs/ui-lab/gate-d-w1-candidates/{SCENARIO_REGISTER,DATA_TRUTH_AND_FIXTURES,INTERACTION_AND_STATE_AUDIT,VISUAL_VS_CURRENT,CHANGED_FILES}.md` — new, this implementation pass.
- `docs/ui-lab/gate-d-w1-candidates/candidate_manifest.json` — new, this implementation pass.
- `capture-attestation.json` is intentionally **not** included — it requires a real CI capture
  run, which has not happened yet for this branch.
- `BLOCKERS.md` and `REVIEW_RECORD.md` are intentionally **not** included — out of this
  implementation pass's assigned scope; the parent/owner should add them (the newly-discovered
  ADR-0154 position-vocabulary conflict, disclosed in `VISUAL_VS_CURRENT.md`, needs to land in
  `BLOCKERS.md` alongside the already-recorded ADR-0139 conflict).

## Version

PATCH bump applied (`0.169.14` → `0.169.15`) via `npm run version:patch`, after this
implementation pass. Per `docs/VERSIONING.md`: "Tooling or infrastructure changes that affect
build, test, deploy, or security should normally receive at least a PATCH increment" — the
`scripts/ui-lab-visual-review.mjs` route registrations are exactly such a change, even though the
UI Lab routes themselves are dev-only and non-production-facing.

## Cleanup pass

`npm run typecheck` (clean), `npm run lint` (clean — pre-existing 3 unrelated warnings in
`src/lib/selection/compute-plan-integrity.ts` only), `npm run test:components` (full suite: 182
files / 1154 tests passed, no regressions). No dead code or unused imports introduced.
