# Gate A W5 — Source Reconciliation

**Status: `SOURCE_VERIFIED` — recovered, read directly, and quoted verbatim below. The normative
W5 definition is narrower than this bundle's own working plan; the normative text wins (per
`02_AUTHORITATIVE_SOURCE_RECONCILIATION.md`'s own precedence rule and `00_READ_FIRST.md`'s
disclosure that its cross-wave consistency framing is "established planning direction, not a
fabricated quotation" from the literal programme files).**

## Recovery path actually used

Per the W5 handoff bundle's own instruction ("Read `docs/ui-lab/gate-a-w4-candidates/
CONTRACT_RECONCILIATION.md` on current `main`"), that file was read first. It records that W4's
agent located the real `programme_v054/` documents at:

- `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/`
- a duplicate subset at `.matchboard-work/Matchboard_Gate_A_W3_A03_A07_A09_Agent_Bundle_2026-10-10/source_contracts/`

Both were independently re-read in this W5 session. `20_UI_LAB_CANDIDATE_WAVES.md` and
`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` are byte-identical between the two locations (`diff`
confirmed, SHA-256 `1661bea20e42e45aa1faff43eb9b4f5128198cbfdaf418338f2970ab2f7d135f` and
`98a12fd1a9ba7f5917f3ee79dfc87a0a6532d6a4540265aa718109302f1f6cc2` respectively) — this is the
same authority chain W1-W4 built against, not a new or substitute source.

## The literal normative W5 definition (verbatim quotation)

`programme_v054/20_UI_LAB_CANDIDATE_WAVES.md`, "Gate order" section, W5 line (quoted in full, not
paraphrased):

> **W5 / Review package and durability**: confirm every scenario has baseline comparison, a
> written three-part contract, machine manifest, screenshots and human review record. Test
> approval-only asset packaging and release storage/retrieval capabilities before using releases
> as durable truth. **Do not publish an official approved release without explicit human
> approval.**

That is the entire normative W5 paragraph. `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` has no rows with
`capture_wave=W5` — W5 is not a content wave with its own golden IDs (unlike W1-W4); it is a
closeout/durability check over the golden IDs W1-W4 already defined (A01-A12 for Gate A; B01-E08
remain future-gate IDs out of this PR's scope entirely).

## This bundle's W5 scope is broader than the literal text, and says so itself

The implementation bundle's own `00_READ_FIRST.md` discloses: "the literal W5 subsection ... [is]
**not verified in this authoring environment** ... This bundle's W5 consistency pass is the
established planning direction, **not a fabricated quotation**." Its `02_AUTHORITATIVE_SOURCE_
RECONCILIATION.md` adds: "its precise normative list must be copied from the source and must not
be invented if different." Having now copied the source directly, the difference is:

| | Literal `20_UI_LAB_CANDIDATE_WAVES.md` W5 line | This bundle's W5 plan (docs `04`-`18`) |
|---|---|---|
| Core ask | Confirm the 3-part contract/manifest/screenshots/review record exists per scenario; test durable asset-storage feasibility; no auto-release | All of that, **plus** ten new cross-wave semantic invariants (`C-X01`-`C-X10`: identity, lifecycle, action grammar, evidence truth, position semantics, Assistant Coach gating, responsive interaction, theme parity, no-fabrication, tenancy) spanning every A01-A12 family |
| Where it comes from | `20_UI_LAB_CANDIDATE_WAVES.md` itself | Not textually present in `20_UI_LAB_CANDIDATE_WAVES.md`, `25_...CSV`, or any of `01`/`13`/`17`/`21`/`23`/`24` read for this reconciliation — those documents define **per-family** requirements (A01 vs A02 vs A06, etc.), not a cross-wave invariant matrix as a distinct deliverable |

**Resolution, per the bundle's own stated precedence ("Programme v0.5.4 and explicit owner
approvals override this implementation bundle"):** this PR performs the literal W5 durability/
completeness check as the binding deliverable, and additionally performs the bundle's cross-wave
consistency audit as **self-imposed supplementary diligence** — genuinely useful (catching real
cross-wave defects, see `CROSS_WAVE_CONSISTENCY.md`), consistent with the spirit of "a final
cross-wave consistency phase," but explicitly **not** asserted as something the literal programme
text itself mandates. This distinction matters for completeness claims: Gate A cannot be said to
be incomplete *against the literal W5 contract* merely because a cross-wave invariant is marked
`NOT_TESTED` below — but it absolutely remains incomplete against **C6 design authority** (W4's 13
`CANDIDATE` entries) either way, which is the dominant blocker regardless of which W5 reading is
used.

## Other required programme documents (read in full, this session)

| Document | Found at | Used for |
|---|---|---|
| `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` | `programme_v054/` | Cross-referenced via each wave's own requirement-traceability tables (already cited per-scenario in W1-W4 `*_REVIEW.md`) |
| `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` | `programme_v054/` | A05/A08/A10/A11 capability families; ADR-0139 conflict (`CONFLICT_AND_BLOCKER_REGISTER.md`) |
| `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` | `programme_v054/` | `XR-*` ID cross-checks already present in each wave's review doc |
| `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` | `programme_v054/` | `INTERACTION_STATE_AUDIT.md` |
| `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` | `programme_v054/` | `VISUAL_COVERAGE_AND_CAPTURE.md`, evidence-level vocabulary |
| `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md` | `programme_v054/` | `REVIEW_RECORD.md`, `APPROVAL_DEPENDENCIES.md` |
| `24_CONFLICT_AND_BLOCKER_REGISTER.md` | `programme_v054/` | `CONFLICT_AND_BLOCKER_REGISTER.md` field schema |
| `07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md` | `programme_v054/` | D7 storage strategy, verification tiers — `VISUAL_COVERAGE_AND_CAPTURE.md` |
| `22_AGENT_WORK_ORDER_UI_LAB_ONLY.md` | `programme_v054/` | Confirms W1's scope boundary precedent this PR follows |

No cited document was unavailable; no `BLOCKED_SOURCE_CONTRACT` condition applies to source
*recovery*. (W4's design-authority approval itself remains outstanding for unrelated reasons — see
`APPROVAL_DEPENDENCIES.md` — which is a governance gap, not a source-recovery gap.)

## Reconciliation table (required fields)

| source_file \| section | exact_requirement | scenario_ids | current_implementation | source_trust | compliance | evidence_ref | deviation | owner_decision_needed |
|---|---|---|---|---|---|---|---|---|
| `20_UI_LAB_CANDIDATE_WAVES.md` W5 line | 3-part contract + manifest + screenshots + review record per scenario; durable-storage feasibility test; no auto-release | all 38 entries (A01-A12) | 25/38 have all five artifacts (W1-W3); 13/38 (W4) have contract+manifest+screenshots but no review record decision yet | Direct, verbatim | `PARTIAL` — see `AUTHORITY_INVENTORY.md` | `authority_inventory.csv` | W4 missing the review-record *decision* (form exists, decision fields blank) | Yes — owner must complete W4's `APPROVE_GOLDEN`/`REVISE`/`REJECT` per scenario |
| `20_UI_LAB_CANDIDATE_WAVES.md` W5 line | "Test approval-only asset packaging and release storage/retrieval capabilities" | N/A (infra capability, not per-scenario) | Not attempted in any wave — every wave disclosed the durable-storage (D7/GitHub Release) step as blocked/not-attempted, see W1-W4 `BLOCKERS.md`/`REVIEW.md` | Direct | `NOT_DONE` | `10_DESIGN_REFERENCE_AUTHORITY_AND_STORAGE.md`-equivalent analysis below | No prior wave tested this; still open | Yes — owner must authorize a real `gh release create` test (a "Create Public Surface" action, per W1's own disclosed sandbox classifier block) |
| `20_UI_LAB_CANDIDATE_WAVES.md` W5 line | "Do not publish an official approved release without explicit human approval" | N/A | Honored — no release created in any wave | Direct | `PASS` | `gh release list` returns zero releases (re-checked this session) | None | No |
| Bundle's own `C-X01`-`C-X10` (supplementary, not literal-W5) | Cross-wave semantic consistency | A01-A12 | See `CROSS_WAVE_CONSISTENCY.md` | Bundle-authored, not source-quoted | `PARTIAL` (one confirmed real regression found) | `CROSS_WAVE_CONSISTENCY.md` | A07/A10 breakpoint regression vs A01's approved fix | Yes for A07 (approved golden); no (already fixed in this PR) for A10 |

## Stop/go

**`SOURCE_VERIFIED`.** No part of this audit is blocked by missing source. The one real
blocker to a complete Gate A design-authority claim is governance, not source recovery: W4's 13
candidates have no recorded owner decision (see `APPROVAL_DEPENDENCIES.md`).
