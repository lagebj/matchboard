# Gate A W5 — Conflict and Blocker Register

Field schema per `13_DOCUMENTATION_CONFLICT_AND_BLOCKER_REGISTER.md`: `ID, scenarioIds, owner,
source/spec, expected, observed, reproduction, impact, severity, blockingFor, allowedInDesignOnly,
resolution, decisionMaker, status, captureRefs`.

## Independent technical review findings (round 1) — all resolved

An independent technical review of this PR (head `6a143d1c8157a52070b670c82d1a8638851544d6`)
confirmed alignment with the authoritative programme and that CI/Security/UI Lab Visual Review all
passed, but found four remediation items before technical acceptance. All four are fixed in this
PR; see each entry below and `CHANGED_FILES.md` for the exact commands/tests proving it.

### W5-R1 (P1) — Authority audit could report false completion

| Field | Value |
|---|---|
| scenarioIds | All 38 (affects the completion verdict itself, not any one scenario) |
| owner | `scripts/audit-gate-a-golden-authority.mjs` |
| source/spec | W5's own literal requirement ("confirm every scenario has... a human review record") implies a positive per-scenario completion check, not an absence-of-candidates check |
| expected | `goldenAuthorityComplete` true only when every expected scenario is present, `APPROVED_GOLDEN`, with fully valid metadata and attestation-backed, hash-matching, structurally-complete capture evidence |
| observed | The formula was `totalCandidate === 0 && noErrors` — a scenario marked `REVISE`/`REJECT`, or missing from a manifest entirely, was invisible to it; `APPROVED_FILE_NOT_IN_ATT` was only a `WARNING`, so an approved golden with no locatable evidence could still read as complete |
| reproduction | Construct a fixture where every expected scenario is `REJECT`ed: the old formula reports `goldenAuthorityComplete: true` (zero `CANDIDATE` entries, zero errors) |
| impact | Could cause a reviewer to trust a false "Gate A complete" signal | 
| severity | P1 — authority-integrity defect in the audit tool itself |
| blockingFor | W5 technical acceptance |
| allowedInDesignOnly | N/A — tooling fix |
| resolution | Rewrote completion as a positive requirement over an explicit `EXPECTED_SCENARIOS` registry (`scripts/lib/gate-a-authority.mjs`): every expected ID present (`MISSING_EXPECTED_SCENARIO`, new, error), every expected entry `APPROVED_GOLDEN` with valid metadata, `APPROVED_FILE_NOT_IN_ATT` promoted to error, an unrecognized status promoted to error (`UNRECOGNIZED_STATUS`), plus two new structural checks derived from the fixture contract's own symmetry requirement (`MISSING_REQUIRED_VIEWPORT`, `MISSING_THEME_PAIR`) — both validated against real repo data with zero false positives before being enabled. Output now also carries an explicit `scopeDisclaimer` listing what a clean result does/doesn't prove. 15 negative-test scenarios (plus 2 structural-check tests) added in `scripts/__tests__/audit-gate-a-golden-authority.test.ts`, using synthetic fixture directories, never the real approved manifests |
| decisionMaker | N/A — tooling correction, no approval/design content changed |
| status | `RESOLVED` |
| captureRefs | N/A |

### W5-R2 (P2) — Incorrect approved-capture total and W4 revision provenance

| Field | Value |
|---|---|
| scenarioIds | All 38 |
| owner | `AUTHORITY_INVENTORY.md`, `authority_inventory.csv` |
| source/spec | Inventory must be derived from the committed manifests, not hand-maintained |
| expected | 488 approved captures (`sum(approval.approvedCaptures.length)` across the 25 `APPROVED_GOLDEN` entries); W4's rows carry no fabricated approval revision |
| observed | `AUTHORITY_INVENTORY.md` reported 494 (a manual, undifferentiated figure); the CSV's single `revisionSha` column held W4's historical base commit (`1a2b5095e...`) in a column a reader could mistake for an approval revision — W4 has never had one |
| reproduction | `48+92+348 = 488`, not 494; `python3 -c "import json; m=json.load(open('docs/ui-lab/gate-a-w4-candidates/candidate_manifest.json')); print(m['candidates'][0].get('approval'))"` → `None` for every W4 entry |
| impact | A reader trusting the written total would overcount approved evidence by 6 captures; the overloaded revision column risked a reader treating W4's base commit as an owner approval |
| severity | P2 |
| blockingFor | W5 technical acceptance |
| allowedInDesignOnly | N/A — documentation/tooling fix |
| resolution | New `scripts/generate-gate-a-authority-inventory.mjs` (sharing `scripts/lib/gate-a-authority.mjs` with the audit script) derives the CSV deterministically — verified byte-identical across repeated runs — with four separated provenance fields (`baseCommitSha`, `approvalRevisionSha`, `captureSourceCommitSha`, `reviewedBranchHeadSha`) instead of one overloaded column; W4's `approvalRevisionSha` is empty for all 13 rows. `AUTHORITY_INVENTORY.md` rewritten with the corrected 488/698 totals and the field-separation table. Read-only by default; `--write` required to touch the repository file |
| decisionMaker | N/A |
| status | `RESOLVED` |
| captureRefs | N/A |

### W5-R3 (P2) — UI Lab index misrepresented existing golden approvals

| Field | Value |
|---|---|
| scenarioIds | None (index page) |
| owner | `src/app/dev/ui-lab/gate-a/page.tsx` |
| source/spec | Same `13_DOCUMENTATION_CONFLICT_AND_BLOCKER_REGISTER.md` carried-forward permission to correct dev-only index text, already used for `W5-F05` |
| expected | The page's own visible copy should not contradict the fact that 8 of the 12 listed families (A01-A04, A06, A07, A09, A12) are owner-approved `APPROVED_GOLDEN` |
| observed | The visible `<p>` read "Dev-only design candidates, **not approved goldens**" for the entire list — factually wrong for 25 of the 38 manifest entries, even though the file's own JSDoc comment above it correctly described the approved waves |
| reproduction | Visit `/dev/ui-lab/gate-a` and read the subhead text, or `grep -n "not approved goldens" src/app/dev/ui-lab/gate-a/page.tsx` (pre-fix: 1 match) |
| impact | A reviewer skimming only the visible page (not the JSDoc) would wrongly believe no Gate A golden has ever been approved |
| severity | P2 |
| blockingFor | W5 technical acceptance |
| allowedInDesignOnly | Yes — dev-only route text |
| resolution | **Fixed in this PR.** Visible copy now names which families are approved vs. candidate, matching the JSDoc and `candidate_manifest.json` reality, and states explicitly that no approval here authorizes production implementation |
| decisionMaker | N/A — explicitly pre-authorized text correction |
| status | `RESOLVED` |
| captureRefs | N/A |

### W5-R4 (P3) — Documentation referenced a nonexistent validation report

| Field | Value |
|---|---|
| scenarioIds | None |
| owner | `AUTHORITY_INVENTORY.md`, `CROSS_WAVE_CONSISTENCY.md` |
| source/spec | Every file reference in a W5 deliverable should resolve to a real file |
| expected | A cited file exists at the stated path |
| observed | Two places referenced `` `AUTOMATED_VALIDATION_AND_REGRESSION.md` `` as if it were one of this PR's own deliverables under `docs/ui-lab/gate-a-w5-convergence/` — no such file was ever created there (the name was carried over from the *handoff bundle's* `12_AUTOMATED_VALIDATION_AND_REGRESSION.md` source contract, which lives outside the repo, without the `12_` prefix or bundle path) |
| reproduction | `grep -rn "AUTOMATED_VALIDATION_AND_REGRESSION" docs/ui-lab/gate-a-w5-convergence/*.md` (pre-fix: 2 matches, both dangling) |
| impact | A reader following the citation would find nothing — minor, since the actual command log/results live in `CHANGED_FILES.md` regardless |
| severity | P3 |
| blockingFor | W5 technical acceptance |
| allowedInDesignOnly | N/A — documentation-only fix |
| resolution | **Fixed in this PR.** Both references replaced with `CHANGED_FILES.md`, which is where the actual exact-command/exact-result log this PR produces actually lives |
| decisionMaker | N/A |
| status | `RESOLVED` |
| captureRefs | N/A |

## New findings from this W5 pass

### W5-F01 — A07's approved golden shares A01's already-fixed responsive-squeeze defect

| Field | Value |
|---|---|
| scenarioIds | A07-S1/S2, A07-S3, A07-S4, A07-S5, A07-S6 (all 5 `APPROVED_GOLDEN` W3 entries) |
| owner | `docs/ui-lab/gate-a-w3-candidates/*` — component: `src/app/dev/ui-lab/gate-a/a07-match-details-edit-lineup/*/page.tsx` |
| source/spec | `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` responsive inspector requirement; A01's own `A01_A02_A06_A12_REVIEW.md` round-4 remediation (owner-acknowledged fix for the identical defect) |
| expected | Two-column inspector-beside-pitch layout only engages at the `expanded` (840px) breakpoint; 600-840px stacks full-width, per A01's approved precedent |
| observed | All 5 A07 pages use `medium:flex-row` (600px) for the two-column engagement — the same threshold used to decide inspector-vs-sheet at all, reproducing the exact squeeze A01's round 4 fixed |
| reproduction | Open any A07 scenario with the lineup editor open at a viewport between 600px and 839px wide (e.g. 768px) |
| impact | Design-reference artifact only — A07 has not shipped to production, so no live user is affected; affects the credibility of the *approved golden* as a faithful responsive reference |
| severity | Review decision (not a Blocker by the bundle's own rubric — no hidden mutation, wrong entity, or permission bypass; a layout defect at a specific width range) |
| blockingFor | Re-confirming A07's golden at full confidence; does not block Gate A audit completion or Gate B handoff preparation |
| allowedInDesignOnly | Yes |
| resolution | **Not applied in this PR.** A07 is `APPROVED_GOLDEN` — per every prior wave's own non-negotiable, an approved golden's component/capture set is not silently revised. Proposed resolution: apply the identical fix A10 received in this PR, recapture, and record as a reviewed revision bump — but only on explicit owner instruction |
| decisionMaker | Repository owner (Lage Berger-Brendryen) |
| status | `OWNER_DECISION_REQUIRED` |
| captureRefs | `ui-lab-review-38287815867-1` (run `38287815867`, commit `6faf8d3d2f754ce0aca3c533e63f7af75b55fd16`) — `gate-a-w3-a07-assign-reserve-success-squeeze-{600,768,900}-{dark,light}-editor-open.png` (and the other 4 A07 scenarios' equivalents) visually confirm the defect is still present, unfixed |

### W5-F02 — A10's identical defect (now fixed, unapproved family)

| Field | Value |
|---|---|
| scenarioIds | A10-review-alternative-success, A10-stale-proposal-blocked, A10-disabled-or-failed |
| owner | `src/app/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/{*/page.tsx, shared/lineup-proposal-editor.tsx}` |
| source/spec | Same as W5-F01 |
| expected | Same as W5-F01 |
| observed | Same defect as W5-F01, present before this PR |
| reproduction | Same as W5-F01, pre-fix |
| impact | Design-reference artifact only; A10 has no production owner yet either |
| severity | Review decision |
| blockingFor | None — fixed in this PR |
| allowedInDesignOnly | Yes |
| resolution | **Fixed in this PR.** `LineupProposalInspector` now accepts a `className` prop; all three A10 pages use `expanded:flex-row`/`expanded:w-[480px] expanded:shrink-0`/`className="expanded:flex-1"`, matching A01's approved pattern exactly. `tsc`, lint, and both Gate A vitest suites pass unchanged |
| decisionMaker | N/A — narrow dev-only fix on an unapproved candidate, in scope per this PR's own mandate |
| status | `RESOLVED` |
| captureRefs | `ui-lab-review-38287815867-1` (run `38287815867`, commit `6faf8d3d2f754ce0aca3c533e63f7af75b55fd16`) — `gate-a-w4-a10-review-alternative-success-squeeze-{600,768,900}-{dark,light}-editor-open.png` (and the other 2 A10 scenarios' equivalents) visually confirm the fix: full-width stacked layout, no squeeze, at the identical width A07 still fails |

### W5-F03 — W2's committed capture-attestation.json did not back its own approved hashes

| Field | Value |
|---|---|
| scenarioIds | A04-S1 through A04-S6 (all 6) |
| owner | `docs/ui-lab/gate-a-w2-candidates/capture-attestation.json` |
| source/spec | `07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md`'s approval-record requirement; W5's own literal "machine manifest" completeness check |
| expected | Committed attestation file's per-file SHA-256 matches `candidate_manifest.json`'s `approval.approvedCaptures` for every approved file |
| observed | All 92 approved files' hashes mismatched the committed attestation file (which held a stale, local, pre-approval round-2 capture, not the CI-verified round-3 capture the approval was actually recorded against) |
| reproduction | `node scripts/audit-gate-a-golden-authority.mjs` on `main` before this PR: 92 `HASH_MISMATCH_WITH_ATTESTATION` errors |
| impact | Durable-record integrity gap: the approval was never wrong (independently re-verified against the still-valid CI artifact), but the repo's own committed evidence could not prove it without reaching outside git to a temporary CI artifact |
| severity | Important (evidence-reproducibility gap, not a design or correctness defect) |
| blockingFor | W5 review (C5 "Evidence reproducible") |
| allowedInDesignOnly | N/A — documentation-only fix |
| resolution | **Fixed in this PR.** Replaced with the CI artifact's own 92-entry attestation; re-verified zero mismatches against `candidate_manifest.json` and the corrected audit script |
| decisionMaker | N/A — documentation correction restoring consistency with an unchanged, already-owner-approved record |
| status | `RESOLVED` |
| captureRefs | `ui-lab-review-38040296558-1` (run `38040296558`) |

### W5-F04 — `scripts/audit_gate_a.py`'s `revisionSha` check was a false-positive bug

| Field | Value |
|---|---|
| scenarioIds | All 25 approved entries (W1-W3) |
| owner | Handoff bundle's `scripts/audit_gate_a.py` (not a repo file) |
| source/spec | N/A — tooling defect, not a programme-contract violation |
| expected | Validate `approval.revisionSha` as a git commit SHA (40 hex chars, the format every wave actually uses) |
| observed | Script validated it against a 64-hex SHA-256 pattern, flagging every single approved entry as `INCOMPLETE_APPROVAL` |
| reproduction | `python3 <bundle>/scripts/audit_gate_a.py .` — 25 `INCOMPLETE_APPROVAL` errors, zero of which reflect a real gap |
| impact | Would have produced a false "golden authority incomplete" signal for W1-W3 if trusted as-is |
| severity | Tooling defect (not a product/design finding) |
| blockingFor | Nothing, once identified |
| allowedInDesignOnly | N/A |
| resolution | Ported to `scripts/audit-gate-a-golden-authority.mjs` (repo-convention Node/ESM) with the pattern corrected; original Python script not committed to the repo |
| decisionMaker | N/A |
| status | `RESOLVED` |
| captureRefs | N/A |

### W5-F05 — UI Lab index page had stale W0/W1-only header text and a dangling file reference

| Field | Value |
|---|---|
| scenarioIds | None (index page, not a scenario) |
| owner | `src/app/dev/ui-lab/gate-a/page.tsx` |
| source/spec | `13_DOCUMENTATION_CONFLICT_AND_BLOCKER_REGISTER.md`'s own carried-forward item: "Current UI Lab index route header/description may describe only W0/W1... Dev-only text can be corrected in a narrowly audited PR" |
| expected | Header/JSDoc reflect the actual W0-W4 scope and reference the real review-doc filenames |
| observed | `<h1>` read "Gate A W0/W1 candidates" while the page lists all 12 A01-A12 families including W4's; JSDoc referenced `docs/ui-lab/gate-a-w4-candidates/CANDIDATE_REVIEW.md`, which does not exist (the real file is `A05_A08_A10_A11_REVIEW.md`) |
| reproduction | `grep -rn "CANDIDATE_REVIEW.md" src/app/dev/ui-lab/gate-a/page.tsx` (pre-fix: 1 match to a non-existent file) |
| impact | Cosmetic/documentation drift only, dev-only route |
| severity | Polish |
| blockingFor | Nothing |
| allowedInDesignOnly | Yes — explicitly pre-authorized by the bundle's own text above |
| resolution | **Fixed in this PR.** Header and JSDoc corrected; no behavior change |
| decisionMaker | N/A — explicitly pre-authorized |
| status | `RESOLVED` |
| captureRefs | N/A |

## Mandatory carry-forward items (per `13_DOCUMENTATION_CONFLICT_AND_BLOCKER_REGISTER.md`'s own list — re-verified this session, not copied blind)

| Item | Status this session | Blocks |
|---|---|---|
| W4 owner golden approvals missing | Unchanged — still 0/13, re-confirmed | Final Gate A design-authority completion (`APPROVAL_DEPENDENCIES.md`) |
| Durable screenshot PNG storage (D7, GitHub Release) not implemented | Unchanged — `gh release list` still returns zero releases, re-confirmed this session; all 4 cited CI artifacts remain valid right now (`VISUAL_COVERAGE_AND_CAPTURE.md`) | Long-term capture retrievability, not Gate A audit completion |
| A10 structured proposal / optimistic-concurrency server validation absent in production | Unchanged — `assignPlayerToSlot` (`lineup-actions.ts`) still has no revision field, re-confirmed by source read this session | Gate B production implementation, not this PR |
| A11 guarded primary-position review vs. ADR-0139 automatic promotion | Unchanged, real policy conflict — `docs/adr/0139-evolving-player-position-model.md` is `Accepted` and still auto-promotes without coach approval, re-confirmed by source read this session | Any real A11 implementation (Gate B+), not W5 |
| A10 League/Event parity unverified (only League fixture built) | Unchanged | Gate B scope decision for Event-context equivalence |
| W3's RSVP-deadline auto-decline is illustrative, not shipped | Unchanged, re-confirmed: `AvailabilityStatus`/`PlannedAbsenceReason` remain manually coach-selected, no deadline computation exists in source | Gate B product-policy decision |
| ADR-0151's `Status: Proposed` field is stale vs. shipped code | Unchanged (W3-BLK-06); out of this PR's file scope — recommend a separate narrow documentation-alignment issue, not bundled here | None (documentation-only) |

## Resolution controls honored

No item above with a real release-blocking truth or interaction defect (W5-F01/F02) was dismissed
as cosmetic. No approved W1-W3 reference was silently overwritten — W5-F01 (A07) is explicitly left
to the owner; W5-F03 (W2 attestation) replaces unapproved supporting evidence, not the approval
itself, with content independently re-verified byte-for-byte against the same CI run the approval
was already recorded against.
