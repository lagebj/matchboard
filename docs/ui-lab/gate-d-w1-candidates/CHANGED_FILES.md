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
  **Superseded by the 2026-11-24 remediation below** — this state was built after all.
- `AssessmentHistoryPanel`'s internal `fetch()` made it unmountable as fixture-driven props
  directly; resolved by mirroring its rendering contract (`AssessmentHistoryDisplay`), consistent
  with D02's established `EvidenceGroups` precedent rather than inventing a new strategy.
- D08/D07's review/approval surfaces are genuinely new design (no production equivalent) and are
  explicitly labeled "directional" throughout, following Gate A's own precedent for the same
  situation, rather than being presented as if they were real-component mounts like D01/D02/D04.

---

## Remediation (2026-11-24): owner review findings

An owner review of the pushed PR found five acceptance-fidelity defects (two P1, two P2, plus
browser-test and capture-evidence gaps). Fixed across three parallel, file-disjoint passes.

### Production code

None, same as every prior pass. No schema, service, or `src/app/(app)/**` file touched.

### UI Lab — D01/D02 (profile-level presentation)

- `src/app/dev/ui-lab/gate-d/d01-overview-position-evidence/shared/profile-role-summary.tsx` —
  new. Directional `ProfileRoleSummary`, reuses `collapseTacticalToProfile`. Mounted alongside
  (not replacing) the existing real 24-code production components.
- `d01-overview-position-evidence/{agreeing-positions,diverging-positions}/{fixtures.ts,page.tsx,__tests__/page.test.tsx}`
  — updated: `fixtureVersion` 1→2, `ProfileRoleSummary` mounted, new assertions.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/shared/position-profile-consolidation.ts`
  — new. Real `consolidateExactSharesByProfile()`, the actual 24-to-14 aggregation D02 required.
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/shared/consolidated-position-evidence.tsx`
  — new. Two-level presentation (profile-level primary, exact-level `<details>` drill-down).
- `src/app/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/__tests__/profile-consolidation.test.tsx`
  — new, 7 tests (mapping correctness, both totals=100%, no duplication, sparse/single-code edge,
  absent-vs-recorded-zero, drill-down accessibility).
- `d02-evidence-dot-consolidation/shared/evidence-groups.tsx`,
  `{populated-evidence,sparse-evidence}/fixtures.ts` — updated: `fixtureVersion` 1→2, POSITION
  group now routes through the new consolidation.

### UI Lab — D07 (materiality math, manual-edit/rebase state)

- `d07-attribute-evolution-review/pending-material-approval/fixtures.ts` — corrected: baseline 6 /
  current-applied 7 / proposed 8 (was baseline 6 / proposed 9, three uncontrolled automatic steps).
  `fixtureVersion` 1→2.
- `d07-attribute-evolution-review/shared/material-approval-review.tsx` — updated: the proposal type
  now separates `currentAppliedValue` from `proposedValue` explicitly, so a pending proposal can
  never be misread as already applied.
- `d07-attribute-evolution-review/shared/materiality-policy.ts` — new. Pure, independently-tested
  module (`cumulativeDelta`, `requiresCoachApproval`, `isAutomaticallyEligibleByDistance`,
  `canResumeAutomationAfterManualEdit`) backing both D07 states' numbers with real test coverage
  instead of inspection alone.
- `d07-attribute-evolution-review/shared/__tests__/materiality-policy.test.ts` — new.
- `d07-attribute-evolution-review/shared/attribute-rebase-panel.tsx` — new. Directional state
  machine for ADR-0160 §5 (the previously-deferred manual-edit/lock/attribute-rebase state).
- `d07-attribute-evolution-review/manual-edit-rebase/{fixtures.ts,page.tsx,__tests__/*}` — new.
- `d07-attribute-evolution-review/{automatic-non-material,pending-material-approval}/__tests__/page.test.tsx`,
  `page.tsx` (D07 index) — updated for the corrected values and new state link.

### UI Lab — D08 (genuine conflict fixture)

- `d08-primary-position-proposal/conflicting-note/fixtures.ts` — corrected: the coach note now
  reports a recurring defensive concern directly relevant to the proposed role, instead of
  restating support for it. `fixtureVersion` 1→2.

### UI Lab — D09 (full lineage coverage)

- `d09-evidence-lineage/shared/evidence-lineage-display.tsx` — updated: added simulated,
  interactive Edit/Retract (reproducing `recordDeterministicExtraction()`'s real resubmission/
  retraction semantics locally — edit supersedes-and-adds, retract supersedes-with-nothing-added).
- `d09-evidence-lineage/superseded-lineage/page.tsx`, `__tests__/page.test.tsx` — updated with
  Edit/Retract assertions.
- `d09-evidence-lineage/shared/rejected-extraction-display.tsx` — new. Demonstrates the real
  `validateExtractionSemantics` rejection behavior.
- `d09-evidence-lineage/ambiguous-reference-rejected/{fixtures.ts,page.tsx,__tests__/*}` — new.
- `d09-evidence-lineage/page.tsx` — updated, new route link.

### CI tooling

- `scripts/ui-lab-visual-review.mjs` — 2 new route registrations (`gate-d-w1-d07-manual-edit-rebase`,
  `gate-d-w1-d09-ambiguous-reference-rejected`), batched centrally after all three remediation
  passes landed, same established pattern.

### Documentation

- D01/D02/D07/D08/D09 sections of `SCENARIO_REGISTER.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `VISUAL_VS_CURRENT.md`, `INTERACTION_AND_STATE_AUDIT.md`, `CURRENT_STATE_AUDIT.md`, `WAVE_SCOPE.md`
  — extended with dated 2026-11-24 remediation notes; original findings preserved, not rewritten.
- `VISUAL_VS_CURRENT.md` — new "Acceptance classification" section (PASS/PARTIAL/BLOCKED/FAIL per
  scenario, design/production/operational distinguished, per the owner's remediation brief §11).
- `candidate_manifest.json` — `fixtureVersion` bumped for every corrected fixture (D01×2, D02×2,
  D07-MATERIAL, D08-CONFLICT); two new entries (`GATE-D-W1-D07-REBASE`, `GATE-D-W1-D09-AMBIGUOUS`);
  `knownGaps` updated per scenario; top-level `note` extended. 13 candidates total.
- `BLOCKERS.md`, `REVIEW_RECORD.md`, this file — updated centrally after the three remediation
  passes (see below / their own files).

### Judgment calls

- D09: a dedicated byte-identical "original source text" field does not exist in the real schema;
  this was disclosed as a gap rather than fabricated (see `DATA_TRUTH_AND_FIXTURES.md`).
  "Source-wording preservation" is demonstrated at the structured-observation-statement level.
- D09: a separate standalone "retraction" scenario was considered and rejected as redundant with
  `GATE-D-W1-D09-LINEAGE`'s own interactive Retract control.
- No new `capture-attestation.json` is produced by this remediation pass alone — a fresh CI capture
  run against the remediation commit is still required (see `BLOCKERS.md`).

### Self-discovered fix (2026-11-24, during capture-screenshot inspection)

- `d01-overview-position-evidence/diverging-positions/fixtures.ts` — `currentStory` changed from a
  real production `POSITION_EVOLUTION`-sourced headline (which only applies after a position
  change has already been written, contradicting this candidate's own "no automatic mutation"
  disclosure) to an `OPPORTUNITY`-sourced one making no claim about the primary position.
  `fixtureVersion` 2→3, `fixtureSha256` recomputed.
- `d01-overview-position-evidence/diverging-positions/__tests__/page.test.tsx` — updated assertion
  to match, plus a negative assertion that the old contradictory headline no longer renders.
- Not in the owner's remediation brief — found only by looking at the actual CI-captured
  screenshot, exactly the kind of check §10 asked for.

### Cleanup pass (remediation)

`npm run typecheck` (clean), `npm run lint` (clean — same 3 pre-existing unrelated warnings),
`npx vitest run gate-d` (default config: 14 files / 27 tests), `npm run test:components -- --run gate-d`
(14 files / 64 tests — 91 Gate D tests total), full `npm run test:components` (190 files / 1197
tests passing, no regressions — up from 187/1171).

### Cleanup pass (extension)

`npm run typecheck` (clean), `npm run lint` (clean — same 3 pre-existing unrelated warnings),
`npx vitest run gate-d` (default config: 11 files / 11 tests passing, fixture-hash integrity),
`npm run test:components -- --run gate-d` (11 files / 38 tests passing), full
`npm run test:components` (187 files / 1171 tests passing, no regressions — up from 182/1154).

---

## Second remediation pass (2026-11-25): attribute-domain, baseline-semantics, D09-wording fixes

### Production code

None. No file under `src/app/(app)/**`, a domain service, or the Prisma schema was touched. This
pass only imports a real production *type* (`RatingAttributeKey` from
`src/lib/ratings/player-rating.ts`) into UI Lab code — it does not modify that file.

### UI Lab (dev-only, production-disabled)

- `src/app/dev/ui-lab/gate-d/d07-attribute-evolution-review/shared/attribute-rebase-panel.tsx` —
  `AttributeRebaseRow.attributeKey` retyped `string` → `RatingAttributeKey` (imported); split
  `baselineValue`/`baselineSource: "...AUTOMATIC"` into `coachBaselineValue` (always
  coach-authoritative) and a new `currentAppliedValue`; `baselineSource` no longer accepts
  `"AUTOMATIC"`; rendering updated to show both values distinctly (new `applied-{attributeKey}`
  testid, shown only when the two values differ).
- `d07-attribute-evolution-review/manual-edit-rebase/fixtures.ts` — `finishing`/`workRate`
  replaced with `oneVOneAttacking`/`effort` (real `RatingAttributeKey` values, real production
  labels); `speed` row corrected to demonstrate `coachBaselineValue: 6` / `currentAppliedValue: 7`
  instead of an invalid `baselineSource: "AUTOMATIC"`. `fixtureVersion` 1→2, `fixtureSha256`
  recomputed.
- `d07-attribute-evolution-review/manual-edit-rebase/__tests__/page.test.tsx` — updated testids
  (`finishing`→`oneVOneAttacking`, `workRate`→`effort`) and added an assertion for the new
  `applied-speed` value and its accompanying baseline-unchanged copy.
- `d09-evidence-lineage/shared/evidence-lineage-display.tsx` — on-page description corrected from
  "The coach's original wording is preserved" to "Previous extracted observation wording is
  retained when a newer extraction supersedes it. The original coach-submitted source is not shown
  here."
- `d09-evidence-lineage/superseded-lineage/fixtures.ts` — `fixtureVersion` 1→2 (rendering changed
  via the shared display component; entry data and `fixtureSha256` unchanged — documented why in
  the header comment).

### Tests / browser suite

- `e2e/ui-lab-gate-d.spec.ts` — updated the manual-edit-rebase test block's testids
  (`workRate`→`effort`) and added an `applied-speed` assertion. Test count unchanged (86).

### Documentation

- `DATA_TRUTH_AND_FIXTURES.md`, `SCENARIO_REGISTER.md`, `BLOCKERS.md` (this file's own §11–§12) —
  dated 2026-11-25 correction notes added; original findings preserved, not rewritten.
- `candidate_manifest.json` — `GATE-D-W1-D07-REBASE` (`fixtureVersion` 1→2, `knownGaps` corrected
  to name both fixed defects and the Unlock-only interactivity distinction) and
  `GATE-D-W1-D09-LINEAGE` (`fixtureVersion` 1→2, `knownGaps` corrected) updated;
  `GATE-D-W1-D02-SPARSE`'s `knownGaps` corrected from describing the *populated* fixture's
  percentages to describing the actual sparse (single-code, insufficient-evidence) scenario.

### Judgment calls

- Reused the real production attribute-label strings from
  `src/components/players/player-attributes-panel.tsx`'s local `RATING_LABELS` map ("1v1 Att.",
  "Effort") rather than inventing new label wording or exporting/importing that local const —
  consistent with how "Passing"/"Speed" were already hardcoded to match production convention in
  this same fixture.
- Did not touch `GATE-D-W1-D08-STRONG`/`-CONFLICT`'s existing `collapseTacticalToProfile` reuse or
  any D01/D02/D04/D08 file — this pass's four findings were scoped entirely to D07, D09, and two
  manifest entries.

### Validation (this pass)

`npm run typecheck` (clean, via `NODE_OPTIONS="--max-old-space-size=6144"` — transient sandbox OOM
on the plain command, known pre-existing issue, not a real failure), `npm run lint` (clean, same 3
pre-existing unrelated warnings), `npx vitest run gate-d` (14 files / 27 tests),
`npm run test:components -- --run gate-d` (14 files / 64 tests), `npx playwright test
--project=ui-lab-gate-d --list` (86 tests listed, spec parses correctly — a live local browser run
was attempted but blocked by this sandbox's background-process handling; the authoritative
live-browser verification is the real CI run this pass's commit triggers, checked before
finalizing). Full `npm run test:components` regression run: 190 files / 1197 tests passing, no regressions.
