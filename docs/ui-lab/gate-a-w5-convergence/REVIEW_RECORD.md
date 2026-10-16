# Gate A W5 — Review Record

**Status: `DECISION_RECORDED` (2026-10-16).** Both decisions below were resolved by the repository
owner during the final closeout — see `GATE_A_FINAL_ACCEPTANCE.md` for the complete record. This
document is preserved as the historical review trail, not rewritten after the fact; sections below
marked "(historical)" describe the state at the time this PR was first opened.

This PR carries **two separate decisions**, per `15_OWNER_APPROVAL_AND_REVIEW_SHEET.md`. Do not
conflate them.

## Decision A — W4 visual approval — **RESOLVED**

See `APPROVAL_DEPENDENCIES.md` for the full per-scenario table and `GATE_A_FINAL_ACCEPTANCE.md` for
the closeout record. All 13 scenarios across A05/A08/A10/A11 are now `APPROVED_GOLDEN`. A10 was
reviewed against its post-fix capture, as recommended below.

| Field | Value |
|---|---|
| reviewedBy | Lage Berger-Brendryen |
| reviewedAt | 2026-10-16 |
| exactPRHead | `fa8f2b371c6ef8470af4b92a4baf05a197d88a28` (the commit the approval was recorded against) |
| scenarioOrInvariant | All 13, individually presented — see `APPROVAL_DEPENDENCIES.md` |
| evidenceManifestAndCIRef | Gallery https://claude.ai/artifact/Wh65CtotLK84qgtcWvDEwj, built from CI runs `38258456189` (A05/A08/A11) and `38861930463` (A10, post-fix) |
| decision | `APPROVE_GOLDEN`, all 13 — "Approved, all of it." |
| reasoning | Direct visual review of representative captures per scenario (desktop, dark theme, primary + key interaction states) |
| requiredFix | None |
| validForDesignOnly | Yes, by definition of every prior wave's approval scope |
| productionAuthorization | **NO**, and must remain `NO` unless separately and explicitly authorized |

### (historical) Status at this PR's creation
13 scenarios across A05/A08/A10/A11, all `CANDIDATE`, `approval: null`. This PR did not set, infer,
or backdate any approval field for any W4 scenario at that time.

## Decision B — W5 convergence review (this PR's actual deliverable)

The findings below are ready for independent technical review first, then owner visual review,
per `14_IMPLEMENTATION_PHASES_AND_DELIVERABLES.md`'s Phase 5. Per-issue decision options:
`ACCEPT_CONSISTENCY` / `REVISE_REFERENCE` / `DEFER_NON_BLOCKING_PRODUCTION_GAP` / `BLOCK_GATE`.

| Issue | Evidence | Proposed decision (this PR's recommendation, not a self-approval) |
|---|---|---|
| W5-F01 — A07's approved golden shares A01's responsive squeeze defect | `CROSS_WAVE_CONSISTENCY.md` C-X07, `CONFLICT_AND_BLOCKER_REGISTER.md` | `REVISE_REFERENCE` recommended (apply A10's identical fix, recapture, record as a reviewed revision) — but this is explicitly the owner's call, not asserted here |
| W5-F02 — A10 shared the same defect | Fixed in this PR | `ACCEPT_CONSISTENCY` (already resolved, no further decision needed) |
| W5-F03 — W2 attestation file didn't back its own approval | Fixed in this PR, re-verified byte-for-byte | `ACCEPT_CONSISTENCY` (already resolved; approval itself was never in question) |
| W5-F04 — Audit script false-positive bug | Fixed via a corrected, repo-native script | `ACCEPT_CONSISTENCY` (tooling-only) |
| W5-F05 — Stale UI Lab index text | Fixed in this PR | `ACCEPT_CONSISTENCY` |
| Durable D7 storage still not attempted | `VISUAL_COVERAGE_AND_CAPTURE.md` | `DEFER_NON_BLOCKING_PRODUCTION_GAP` (unchanged since W1; needs separate owner authorization for a "Create Public Surface" action, not a design decision) |
| A11 vs. ADR-0139 conflict | `CONFLICT_AND_BLOCKER_REGISTER.md` carry-forward | `DEFER_NON_BLOCKING_PRODUCTION_GAP` (real conflict, but a Gate B/ADR-amendment decision, not blocking Gate A design review) |
| W4's 13 candidates (Decision A) | `APPROVAL_DEPENDENCIES.md` | Not a Decision B item — handled above |

## Independent technical review — round 1: `REVISE` → remediated

An independent technical review of head `6a143d1c8157a52070b670c82d1a8638851544d6` confirmed
substantial alignment with the authoritative programme and that CI/Security/UI Lab Visual Review
all passed, and returned four remediation findings (`W5-R1` P1, `W5-R2`/`W5-R3` P2, `W5-R4` P3)
before technical acceptance — see `CONFLICT_AND_BLOCKER_REGISTER.md`'s "Independent technical
review findings (round 1)" section for the full writeup of each, and `CHANGED_FILES.md` for the
exact commands/tests proving each fix. Summary:

| Finding | Fix |
|---|---|
| W5-R1 (P1) — audit completion formula could report false completion (ignored `REVISE`/`REJECT`/missing scenarios; `APPROVED_FILE_NOT_IN_ATT` was only a warning) | Rewrote as a positive requirement over an explicit 39-ID/38-entry expected-scenario registry, promoted the warning to an error, added two new structural checks (viewport/theme-pair completeness), and added a 15-scenario negative-test suite (`scripts/__tests__/audit-gate-a-golden-authority.test.ts`) |
| W5-R2 (P2) — approved-capture total was wrong (494, should be 488); W4's inventory row conflated its base commit with a nonexistent approval revision | New deterministic `scripts/generate-gate-a-authority-inventory.mjs` (read-only by default, `--write` to touch the repo) with four separated provenance fields |
| W5-R3 (P2) — UI Lab index's visible copy claimed no scenario was an approved golden | Corrected to name which families are approved vs. candidate |
| W5-R4 (P3) — two dangling references to a nonexistent `AUTOMATED_VALIDATION_AND_REGRESSION.md` | Replaced with `CHANGED_FILES.md`, where that content actually lives |

All four are `RESOLVED` as of this commit. No W1-W3 approved golden content was changed by any of
these fixes — they correct the audit tooling and this PR's own documentation, not any approval
record.

## Independent technical review — round 2: `REVISE` → remediated

A second independent technical review of round 1's fix (head
`b276590a82ab66f3ca3fbbcfd99d83ad61594391`) confirmed W5-R1 through W5-R4 substantially resolved
and that CI/Security/UI Lab Visual Review all passed, and returned one remaining P1 defect plus
two documentation/safety items — see `CONFLICT_AND_BLOCKER_REGISTER.md`'s "Independent technical
review findings (round 2)" section for the full writeup, and `CHANGED_FILES.md` for the exact
commands/tests proving each fix. Summary:

| Finding | Fix |
|---|---|
| W5-R5 (P1) — the completion formula compared aggregate counts (`totalApproved === expectedTotal`), so an unexpected approved scenario anywhere could silently compensate for a still-pending expected scenario elsewhere whenever the totals happened to match | Rewrote `allApprovedGolden` as a per-scenario-identity check (`every expected ID has its own valid APPROVED_GOLDEN record`), independent of any other entry; added a new `UNEXPECTED_SCENARIO` error for any manifest entry outside its wave's expected-scenario registry, including cross-wave misplacement; 11 new regression tests |
| Documentation: one inverted "39-entry/38-ID" reference in `AUTHORITY_INVENTORY.md` | Corrected to "38-entry/39-logical-ID"; searched the rest of the W5 doc set, no other instance found |
| UI Lab index heading implied uniform approval state | `<h1>` changed from "Gate A W0-W4 candidates" to "Gate A W0-W4 design references" (the body copy already correctly distinguished approved vs. candidate families) |
| Inventory generator only checked file-loading errors, not the full semantic audit, before writing | Generator now runs the shared `auditGateA()` and refuses to write on any integrity error, while still permitting generation for valid, explicitly pending `CANDIDATE` records |

All four are `RESOLVED` as of this commit. `node scripts/audit-gate-a-golden-authority.mjs`
against this branch: 38 manifest entries, 39 logical scenario IDs, 25 approved, 13 pending, 0
missing, 0 unexpected, 0 integrity errors, `goldenAuthorityComplete: false` (W4 pending, as
expected). No W1-W3 approved golden content, and no production code, changed.

## Owner check questions (per `15_OWNER_APPROVAL_AND_REVIEW_SHEET.md`), answered where this audit
## can answer them from source/evidence, left open where only a human visual read can answer them

| Question | This audit's finding |
|---|---|
| Does Match Details retain one stable identity through planned/live/completed? | Source-confirmed consistent (C-X01/C-X02); not independently re-screenshotted this session |
| Are A07/A09/A10 context-local operations coherent without false action states? | Source-confirmed (C-X03); A10's 54-case rejection-code test suite directly supports this |
| Is a sparse report obviously incomplete instead of misleadingly empty or complete? | Source-confirmed (`SOURCE_TRUTH_AUDIT.md`) |
| Does A04 evidence truth survive Assistant Coach and profile projection contexts? | Source-confirmed (C-X04, C-X09) |
| Are tactical pitch and profile map clearly distinct and accurately oriented? | Source-confirmed (C-X05); visual confirmation still owner's to make |
| Is OFF/ON/no-value/unavailable behavior free of misleading blank space or fabricated advice? | Source-confirmed (C-X06, C-X09) |
| Can a coach inspect evidence without selecting or applying a proposal? | Source-confirmed (`INTERACTION_STATE_AUDIT.md` item 4) |
| Does A11 coach text preserve exact source claims, and is guarded primary change honestly labelled as future simulated behavior? | Source-confirmed (`SOURCE_TRUTH_AUDIT.md`) |
| Are all key states usable on mobile and desktop, light and dark, including breakpoint transitions? | **Partially revised this session** — found and fixed one real regression (A10), found and flagged one real instance in an already-approved golden (A07) |
| Are screenshot bytes, approval hashes and source revisions traceable and recoverable? | **Found and fixed one real gap (W2)**; all others confirmed traceable and currently recoverable (`VISUAL_COVERAGE_AND_CAPTURE.md`) |

## Final posture (updated 2026-10-16)

`C6` (design authority) is now met — all 38 expected scenarios are `APPROVED_GOLDEN`. No
production work is authorized by this or any record in this programme; Gate A design-reference
approval is a distinct authority type from Gate B production implementation. See
`GATE_A_FINAL_ACCEPTANCE.md` for the full closeout declaration, including the one remaining open
item (official durable release publication, intentionally not executed without a further explicit
decision).
