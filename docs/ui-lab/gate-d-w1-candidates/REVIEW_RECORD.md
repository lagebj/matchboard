# Gate D W1 — Review Record

## Independent review

Performed by a fresh agent with no prior involvement in this wave's implementation (not the
implementing agent self-reviewing). The reviewer was instructed to verify every claim in this
package against primary sources rather than trust the docs' own self-report, and to classify
findings as BLOCKING / MAJOR / MINOR, with empty categories stated explicitly rather than omitted.

### Categories checked and outcome

| Category | Outcome |
|---|---|
| Source fidelity (register rows, quoted conflicts, D05 gap) | No issues found |
| ADR fidelity (ADR-0139, ADR-0154, ADR-0157) | No issues found |
| Production reuse vs. reinvention | No issues found — all cited components confirmed imported from real, unmodified production files |
| Fixture integrity (sha256 independently recomputed) | No issues found |
| RSC/server-client boundary correctness | No issues found |
| Evidence semantics discipline (no fabricated confidence, no double-counting) | No issues found |
| Authority-conflict handling (14-role vocabulary claim) | Confirmed true by independent grep — not an excuse to avoid real work |
| Governance (approval fields null, no self-approval, no direct main push) | No issues found |
| Validation (typecheck/lint/test, independently re-run) | All pass |
| Scope discipline (diff boundaries) | No issues found |

### Findings

- **BLOCKING**: none.
- **MAJOR**: none.
- **MINOR**: one — Gate D's fixture-hash tests (`fixtures.test.ts`) and render-verification tests
  (`page.test.tsx`) live under two different vitest configs (default `vitest.config.ts` vs.
  `vitest.config.components.ts`), and running only `npm run test:components -- --run gate-d`
  silently skips the 6 hash tests without failing. **Resolved** in this package: added a "Running
  all Gate D tests" section to `DATA_TRUTH_AND_FIXTURES.md` explaining both commands are required.

### Independent reviewer's overall verdict

`READY_FOR_OWNER_REVIEW`

## This agent's disposition

Accepting the independent reviewer's verdict. The one MINOR finding has been fixed (documentation
only, no code or fixture change, no re-verification of hash/typecheck/lint/test required since
nothing executable changed). No BLOCKING or MAJOR finding exists to remediate.

## Second independent review — D07/D08/D09 extension (2026-11-23)

After the first review above, the product owner resolved the two authority conflicts it had left
open (`BLOCKERS.md` §1–2) via **ADR-0160**, and instructed extending this same wave with D07, D08,
and D09. A second independent review was performed by a fresh agent (no shared context with the
implementer, and no shared context with the first review either) against this extension.

### Categories checked and outcome

| Category | Outcome |
|---|---|
| ADR-0160 fidelity and internal consistency | No issues found |
| ADR-0139/ADR-0092 history preserved, not rewritten | No issues found — confirmed via `git diff main` |
| ADR-0160 numbering (next available) | Confirmed correct |
| No production code touched (`src/lib/evidence`, `src/lib/player-development`, `prisma`, `src/app/(app)/**`) | No issues found |
| Directional-vs-real-component honesty (D07/D08) | No issues found — confirmed no existing production review/approval UI exists; simulated actions disclosed on-page and in code |
| `AssessmentHistoryDisplay` fidelity to the real `AssessmentHistoryPanel` | No issues found (one immaterial, already-acceptable difference: no 20-row slice/footer, irrelevant at fixture scale) |
| D08 profile-projection reuse (`collapseTacticalToProfile`) | Confirmed genuinely pre-existing (Gate A, PR #777, 2026-10-09) and mapping table verified correct against ADR-0160 §6 |
| D09 honesty (`supersededAt`, `ACTIVE_RUN_FILTER`) | Confirmed real and accurately described; confirmed no existing production lineage-display component |
| Fixture integrity (5 new fixtures, independent sha256 recomputation) | No issues found |
| RSC/client boundary correctness | No issues found |
| Validation (typecheck/lint/test, independently re-run) | All pass — 187 files / 1171 tests, up from 182/1154 |
| Scope/governance (11 candidates, all `approval: null`, no self-approval, no direct main push) | No issues found |
| Cross-document consistency (register, fixtures, interaction audit, visual-vs-current, changed-files) | No issues found |

### Findings

- **BLOCKING**: none.
- **MAJOR**: none.
- **MINOR**: none beyond what was already disclosed and resolved from the first review.

### Second reviewer's overall verdict

`READY_FOR_OWNER_REVIEW`

## Third independent review — post-remediation, against the owner's 10-question brief (2026-11-24)

The product owner found five acceptance-fidelity defects in the then-pushed implementation (see
`BLOCKERS.md` §8 for the full account): D01 disclosed rather than demonstrated the approved
14-role experience; D02 showed exact shares instead of profile-level consolidation; D07's
cumulative-materiality fixture violated ADR-0160 §4's own math; D08's "conflicting" note actually
supported the proposal; D09's coverage was partial. All five were fixed, a dedicated 86-test Gate D
Playwright suite was added, and — found independently during this session's own screenshot
inspection, not in the owner's brief — a sixth, self-discovered defect (D01-DIVERGING's
`currentStory` headline contradicting its own "no automatic mutation" disclosure) was also fixed.

A third independent review (fresh agent, no shared context with the implementer or either prior
review) was performed against the owner's exact 10-question verification brief.

### The 10 questions and their independent answers

| # | Question | Independent finding |
|---|---|---|
| 1 | Does D01 now show the approved 14-role profile experience? | Confirmed — `ProfileRoleSummary` genuinely uses the real, pre-existing (PR #777) `collapseTacticalToProfile`; the self-discovered `currentStory` fix verified correct, no remaining contradiction. |
| 2 | Does D02 genuinely consolidate without double counting? | Confirmed by manual arithmetic and test inspection — CB 58+25=83, CDM→DM 17, both levels sum to 100, asserted by real tests not render-only checks. |
| 3 | Does D07 enforce correct cumulative-threshold semantics? | Confirmed — baseline 6/applied 7/proposed 8 verified against ADR-0160 §4's text and `materiality-policy.ts`'s actual function output, computed independently. |
| 4 | Does D07 cover manual-edit precedence truthfully? | Confirmed — attribute-level rebase, independent unrelated-attribute progression, lock/unlock; `prisma/schema.prisma` grepped directly, confirmed no fabricated schema. |
| 5 | Does D08-CONFLICT contain genuine contradiction? | Confirmed via the reviewer's own independent football-domain judgment, not a restatement of the fix claim. |
| 6 | Does D09 preserve provenance and distinguish active/superseded? | Confirmed — `supersededAt` and `validateExtractionSemantics` traced to their real call sites and real schema; the disclosed source-text gap verified true by schema grep. |
| 7 | Are all simulated actions disclosed? | Confirmed — every interactive surface has on-page + code-comment disclosure; every handler inspected directly, none calls a real Server Action. |
| 8 | Do real browser tests demonstrate the interactions? | Confirmed by actually running the suite locally against a real dev server: 86/86 passed. |
| 9 | Does Visual Authority evidence correspond to the final commit? | Confirmed — `reviewedBranchHeadSha` matches the branch tip at the time of attestation; 78 entries = 13×6 verified; the one-commit-ahead relationship (attestation commit itself isn't screenshotted) correctly understood as the expected pattern, not staleness. |
| 10 | Does the package distinguish implemented vs. missing-in-production honestly? | Confirmed — `VISUAL_VS_CURRENT.md`'s classification table checked for internal consistency and cross-checked against `BLOCKERS.md`; no overclaim found. |

### Validation (independently re-run)

`npm run typecheck` (clean), `npm run lint` (clean, 3 pre-existing unrelated warnings),
`npx vitest run gate-d` (14 files/27 tests), `npm run test:components -- --run gate-d` (14
files/64 tests), full `npm run test:components` (190 files/1197 tests), and
`npx playwright test --project=ui-lab-gate-d` against a locally started dev server (86/86 passed)
— every number matched the documentation's own claims exactly, no discrepancy found anywhere.

### Findings

- **BLOCKING**: none. **MAJOR**: none.
- **MINOR**: one — `SCENARIO_REGISTER.md`'s per-scenario viewport columns listed only "desktop,
  mobile" when the real capture script and attestation both also capture a third, universal
  `narrow` (320×720) viewport (6 captures per scenario, not 4) — a pre-existing, repo-wide
  convention this doc simply hadn't mentioned. **Fixed** in this package (all 13 scenario rows and
  their prose now name `narrow` explicitly).

### Third reviewer's overall verdict

`READY_FOR_OWNER_REVIEW`

## What remains outside every review's scope

- Visual/design approval — not performed, not assumed, not requested from any review. The owner
  reviews the real CI captures and posts `/visual-approve` or `/visual-reject` themselves; no
  coding agent does this.
- ADR-0160's policy is a decision, not yet a production implementation. D07/D08's actual
  review/approval UI, persistence, and the 14-role projection module remain required future work —
  `VISUAL_VS_CURRENT.md`'s acceptance-classification table and all three reviews confirm this
  distinction is honestly disclosed throughout, not that the capability itself now exists.
