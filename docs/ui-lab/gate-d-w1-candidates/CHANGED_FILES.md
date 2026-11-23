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

---

## Extension (2026-11-23): D07, D08, D09

Following the owner's decision resolving the authority conflicts (ADR-0160), this wave was
extended per the owner's explicit instruction to "continue the first Gate D wave." Additive to
everything above — none of the D01/D02/D04 files were modified.

### Production code

None, same as above. ADR-0160 explicitly forbids schema/service changes in this wave.

### New ADRs (separate from this implementation pass, written first)

- `docs/adr/0160-coach-approved-position-and-attribute-mutation-policy.md` — new.
- `docs/adr/0139-evolving-player-position-model.md` — "Superseded by" + History entry added, no
  rewrite of the original decision.
- `docs/adr/0092-match-evidence-engine-domain-foundation.md` — "Update (2026-11-23)" section added,
  no rewrite of the original decision.

### UI Lab (dev-only, production-disabled)

- `src/app/dev/ui-lab/gate-d/page.tsx` — updated to add D07/D08/D09 links.
- `src/app/dev/ui-lab/gate-d/d07-attribute-evolution-review/` — new: `page.tsx` (index),
  `shared/assessment-history-display.tsx` (mirrors the real `AssessmentHistoryPanel`'s rendering
  over fixture props), `shared/material-approval-review.tsx` (new directional component, no
  production equivalent), `automatic-non-material/{fixtures.ts,page.tsx,__tests__/*}`,
  `pending-material-approval/{fixtures.ts,page.tsx,__tests__/*}`.
- `src/app/dev/ui-lab/gate-d/d08-primary-position-proposal/` — new: `page.tsx` (index),
  `shared/position-proposal-review.tsx` (new directional component, reuses the real
  `exactPositionLabel()` and Gate A's `collapseTacticalToProfile()`),
  `strong-evidence/{fixtures.ts,page.tsx,__tests__/*}`,
  `conflicting-note/{fixtures.ts,page.tsx,__tests__/*}`.
- `src/app/dev/ui-lab/gate-d/d09-evidence-lineage/` — new: `page.tsx` (index),
  `shared/evidence-lineage-display.tsx` (new presentational component over real qualitative-
  evidence field shapes), `superseded-lineage/{fixtures.ts,page.tsx,__tests__/*}`.

### CI tooling

- `scripts/ui-lab-visual-review.mjs` — 5 new route registrations (D07 ×2, D08 ×2, D09 ×1), same
  established pattern as the original D01/D02/D04 registration.

### Documentation

- `docs/ui-lab/gate-d-w1-candidates/{SOURCE_RECONCILIATION,CURRENT_STATE_AUDIT,WAVE_SCOPE,BLOCKERS}.md`
  — updated with dated "Update, 2026-11-23" notes pointing to ADR-0160; original findings preserved,
  not rewritten.
- `docs/ui-lab/gate-d-w1-candidates/{SCENARIO_REGISTER,DATA_TRUTH_AND_FIXTURES,INTERACTION_AND_STATE_AUDIT,VISUAL_VS_CURRENT,CHANGED_FILES}.md`
  — extended with D07/D08/D09 sections.
- `docs/ui-lab/gate-d-w1-candidates/candidate_manifest.json` — extended with 5 new candidate
  entries; `baseCommitSha` updated to the D01/D02/D04 commit's SHA.
- `BLOCKERS.md` and `REVIEW_RECORD.md` — `BLOCKERS.md` updated in this pass (see above);
  `REVIEW_RECORD.md` to be updated after the next independent review pass.

### Judgment calls and deferrals

- D07's manual-edit/lock + attribute-level-rebase state (ADR-0160 §5) was deliberately **not**
  built in this pass — it would have required a third fixture/component pair without adding much
  beyond what the automatic/material pair already demonstrates about materiality policy, and the
  wave was already substantial. Recorded as deferred in `BLOCKERS.md`, not silently dropped.
- `AssessmentHistoryPanel`'s internal `fetch()` made it unmountable as fixture-driven props
  directly; resolved by mirroring its rendering contract (`AssessmentHistoryDisplay`), consistent
  with D02's established `EvidenceGroups` precedent rather than inventing a new strategy.
- D08/D07's review/approval surfaces are genuinely new design (no production equivalent) and are
  explicitly labeled "directional" throughout, following Gate A's own precedent for the same
  situation, rather than being presented as if they were real-component mounts like D01/D02/D04.

### Cleanup pass (extension)

`npm run typecheck` (clean), `npm run lint` (clean — same 3 pre-existing unrelated warnings),
`npx vitest run gate-d` (default config: 11 files / 11 tests passing, fixture-hash integrity),
`npm run test:components -- --run gate-d` (11 files / 38 tests passing), full
`npm run test:components` (187 files / 1171 tests passing, no regressions — up from 182/1154).
