# Gate A W2 — A04 Changed Files

All paths are new unless marked "modified". Every path is UI-Lab-only, test, or review
documentation. Nothing under `src/domain/**`, production `src/components/**`, production routes,
Prisma schema, auth, or deployment config is touched. W1's four candidate directories
(`a01-sports-first/`, `a02-match-lifecycle/`, `a06-position-pitches/`, `a12-profile-editor/`) and
`docs/ui-lab/gate-a-w1-candidates/**` are not in this list — they are unmodified.

| Path | Type | UI-Lab-only? | Imported by production? | Promotion-to-production requirement |
|---|---|---|---|---|
| `src/app/dev/ui-lab/gate-a/page.tsx` | **modified** | yes | no | Added one new link to the A04 index — no other change |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/page.tsx` | new | yes | no | N/A — dev index route listing the 6 scenarios |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/coverage.ts` | new | yes | no | A real six-state coverage vocabulary would need its own ADR + domain migration before any production import |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/coverage-badge.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/evidence-question-panel.tsx` | new | yes | no | A production `EvidenceStory` variant with a context-local inspect callback (instead of `detailHref`) would need its own component-contract decision and visual-approval gate |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/source-inspector.tsx` | new | yes | no | Same as above — a generic read-only source drilldown is not currently a production component |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/source-record-list.tsx` | new | yes | no | Same as above |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/use-source-inspector.ts` | new | yes | no | N/A — open/close/focus-restoration state hook |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/invariants.ts` | new | yes | no | N/A — pure data-truth helpers (overlap rejection, retraction, conflict flagging) |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/__tests__/coverage.test.ts` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/__tests__/invariants.test.ts` | new | yes | no | N/A — test |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/shared/__tests__/mock-viewport.ts` | new | yes | no | N/A — shared test helper (`useMediaQuery` mock), not itself a test file |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/partial-minutes/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S1 — opportunity vs actual-minutes. Dev-only fixture/presentation; no production evidence-aggregation change |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/partial-minutes/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-sparse/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S2 — 2-of-6 sparse role exposure, no trend inference |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-sparse/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-supported/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S3 — prior-3/latest-3 descriptive comparison over 6 complete observations |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-supported/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/sparse-score-events/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S4 — canonical 6–4 result vs one individually logged event, independent source classes |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/sparse-score-events/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/central-profile-projection/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S5 — reuses W1's approved `aggregateExactAppearancesByProfile`; LCM 20m + RCM 10m → CM 30m/1 match |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/central-profile-projection/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests, including the negative overlap-rejection case |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced/{fixtures.ts,view-model.ts,page.tsx}` | new | yes | no | A04-S6 — declared profile vs actual evidence, two cases, no auto-promotion (ADR-0139 gate preserved) |
| `src/app/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced/__tests__/{fixtures.test.ts,page.test.tsx}` | new | yes | no | N/A — tests |
| `scripts/ui-lab-visual-review.mjs` | **modified** | yes | no (CI/local script only) | Added the shared `openFirstSourceInspector` interaction function, the optional backward-compatible `scenario.interactionViewports` filter, and 6 new A04 scenario entries. Every existing scenario's behavior is unchanged (re-verified: all 32 W1 screenshot hashes identical to the approved record) |
| `docs/ui-lab/gate-a-w2-candidates/*` | new | n/a (docs) | no | Review/evidence documentation for this PR, including `capture-attestation.json` (committed after the first commit, referencing its real SHA, same pattern as W1) |
