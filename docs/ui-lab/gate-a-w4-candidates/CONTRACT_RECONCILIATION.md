# Gate A W4 — Contract Reconciliation

**Phase 0, mandatory before implementation.** Per the handoff bundle's `02_SCOPE_AND_SOURCE_RECONCILIATION.md`: "If a normative requirement conflicts with this working plan, the normative requirement wins." This document records what was found, where it conflicts with the handoff bundle's own "working allocation", and which definition this PR actually builds against.

## Source recovery — result: FOUND, not BLOCKED

The handoff bundle (`.matchboard-work/Matchboard_Gate_A_W4_Assistant_Coach_Implementation_Bundle_2026-10-11/`) explicitly states its own per-ID mapping is a "working allocation", not a recovered quotation, and instructs searching for the real programme documents before trusting it. They were found, outside the handoff bundle:

| Document | Located at |
|---|---|
| `20_UI_LAB_CANDIDATE_WAVES.md` | `.matchboard-work/Matchboard_Gate_A_W3_A03_A07_A09_Agent_Bundle_2026-10-10/source_contracts/20_UI_LAB_CANDIDATE_WAVES.md` and `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/20_UI_LAB_CANDIDATE_WAVES.md` (identical content, two copies) |
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` | same two locations |
| `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md`, `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`, `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`, `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`, `21_FIXTURE_CAPTURE_AND_AUTHORITY.md`, `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md`, `24_CONFLICT_AND_BLOCKER_REGISTER.md` | `programme_v054/` (the W3 bundle's `source_contracts/` carries a subset — missing `04`, `22` — confirming W3's own agent never needed the Assistant Coach chapter) |

These are the same documents W3's own `source_contracts/` directory drew from (confirmed identical file sizes/content against the `programme_v054/` originals), so this is the same authority chain W1–W3 built against, not a new or substitute source. No ZIP upload or external fetch was needed — both copies were already present in the agent workspace at task start.

**This changes the stop condition.** The handoff bundle's `02_SCOPE_AND_SOURCE_RECONCILIATION.md` says: "no accessible authoritative definition for one of A05/A08/A10/A11... complete the independent current-source audit and design proposal with `BLOCKED_SOURCE_CONTRACT` status." That condition does not apply — the authoritative definitions exist and were read. This candidate is built against them, not against the handoff bundle's own placeholder "working case" descriptions.

## A05/A08/A10/A11 — official definition (verified quotation)

Source: `programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` rows 6, 31, 37, 38, and `20_UI_LAB_CANDIDATE_WAVES.md` "W4" line, both read directly (not paraphrased from the handoff bundle).

| golden_id | design_surface | required_state | primary_acceptance_question | existing_owner_or_reference |
|---|---|---|---|---|
| A05 | Assistant Coach semantic grammar | Disabled; enabled with pattern; enabled without pattern; unavailable | "Assistant Coach only; enabled/off/no-value/failure; novel cited longitudinal patterns, not fact rewrites" | `AssistantCoachHypothesisPanel`, `MatchInsights` |
| A08 | Assistant Coach activation parity | OFF vs ON with strong pattern vs ON with no insight | "No reserved gap when off; conspicuous trustworthy synthesis when on; no filler" | `OrganisationAiSettings`; existing Assistant Coach presentation readers |
| A10 | Assistant Coach structured action | Review lineup alternative, stale proposal, disabled/failure | "Repeatable non-chat action; validate-before-preview, no automatic write, apply blocked when stale (XR-I01: Review lineup / Explore alternatives / validated Apply all remain within Match Details)" | `MatchInsights`; planning engine; provider capability |
| A11 | Qualitative evidence + mutation | Coach text; parsed evidence; guarded review | "AI parsing not AI inference; source lineage, independence, guarded profile change" | qualitative evidence service; player evidence engine |

All four rows: `status=Needs golden`, `capture_wave=W4`, `direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`, `source_commit=b070df73664d816f1b0ebc61d54487a24044972e` (the commit the register itself was authored against — not this PR's base; see `CURRENT_STATE_AUDIT.md` for this PR's own verified base SHA).

`20_UI_LAB_CANDIDATE_WAVES.md`'s own W4 line (verbatim): *"W4 / Assistant Coach and structured proposals: candidate A05, A08, A10, A11. Same scene OFF, READY with valuable evidence-based hypothesis, READY with no useful insight, unavailable/quota/pending. Show review→alternative→diff→revalidated apply within same match, stale/invalid no-write, source-linked coach free text, tentative statement, and material profile-change review; no numeric/profile direct AI mutation."*

## Conflict: the handoff bundle's A11 is not the programme's A11

| | Handoff bundle `10_A11_REVIEW_REJECT_APPLY_CANDIDATE.md` ("working allocation") | Official register A11 |
|---|---|---|
| Subject | Coach review/reject/apply of a **lineup assignment proposal** — the same state machine as A10, just carried one step further (`CLOSED → OPEN_WITH_PROPOSAL → ... → SUCCESS\|DENIED\|CONFLICT\|...`) | **Qualitative evidence + mutation**: coach free text → parsed evidence (AI parsing, not AI inference) → guarded profile-change review |
| Owner | None named (treated as A10's own apply step) | `qualitative evidence service; player evidence engine` |
| Programme chapter | — | `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` capability family 3 ("Governed learning"), `D4` in `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` |

This is a real, substantive conflict, not a naming nuance — the handoff bundle's A11 duplicates A10's apply mechanics instead of covering the qualitative-evidence-parsing-and-profile-mutation capability family the programme actually assigns to A11. **The official register wins.** This PR implements A11 as the qualitative-evidence/profile-change-review candidate; the handoff bundle's "review/reject/apply" lineup-apply mechanics are built once, under A10 (where the register places "Review lineup alternative... validated Apply"), not duplicated under A11.

## Reconciliation table

| Source document + section | Exact scenario ID | Binding requirement | This PR's coverage | Aligned / adapted / conflicting / missing | Test and capture obligation |
|---|---|---|---|---|---|
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 6 | A05 | Disabled / enabled-with-pattern / enabled-without-pattern / unavailable, using `AssistantCoachHypothesisPanel` + `MatchInsights` | `a05-assistant-coach-semantic-grammar/{disabled,enabled-with-pattern,enabled-without-pattern,unavailable}` | Adapted — `AssistantCoachHypothesisPanel` itself is not fixture-injectable (live server-action calls, `useOrgSlug` dependency; see `CURRENT_STATE_AUDIT.md` item 10), so a pure-presentation candidate reproducing its exact visual grammar/types is used instead, same pattern as W1's BLK-01/02/03. `MatchInsights` is reused directly and unmodified (it is already prop-driven, not self-fetching) | Component test per state; capture per state |
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 31 | A08 | OFF vs ON-strong-pattern vs ON-no-insight; no reserved gap when off; no filler when on-but-empty | `a08-assistant-coach-activation-parity/{off,on-strong-pattern,on-no-insight}` | Aligned — reuses the same A05 presentation building blocks; its own tests specifically assert DOM-level absence of a placeholder region (OFF) and absence of filler copy (ON/no-insight), which A05's tests do not assert | DOM-assertion test per state (no reserved-gap assertion); capture per state |
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 37; `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` XR-I01 | A10 | Review lineup alternative / stale proposal / disabled-failure; validate-before-preview; apply blocked when stale; stays in Match Details | `a10-assistant-coach-structured-action/{review-alternative-success,stale-proposal-blocked,disabled-or-failed}` | Adapted — no production structured lineup-proposal/Apply capability exists yet to baseline against (verified: `planned-match-advisor.ts` only returns free-text `insights`, never a typed mutation payload — see `CURRENT_STATE_AUDIT.md` item 6); this is a new UI-Lab-only presentation candidate built on the W3 `useFixtureOperation`/`matchW3*` fixtures, same "directional, not a reproduction" status W1's A03 already disclosed for an analogous case | Fixture/schema-validation unit tests; state-machine component tests; capture per state |
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 38; `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` | A11 | Coach text → parsed evidence (parsing, not inference) → guarded profile-change review; no direct provider write | `a11-qualitative-evidence-and-mutation/{coach-text-and-parsed-evidence,profile-change-review-guarded,profile-change-review-rejected}` | Adapted — the real extraction contract (`qualitative-evidence-extraction-contract.ts`) and `player-evidence-service.ts` exist and are read for shape/vocabulary fidelity, but are server-only and not invoked; `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s own "Mandatory gates before profile mutation work" (1–7) are explicitly unresolved product decisions, so the profile-change-review state uses an explicitly hypothetical fixture threshold, exactly as `04`'s own "Candidate UI Lab states" section permits ("Attribute adjustment: non-material automatic example and material approval-required example, with explicit hypothetical fixture thresholds until actually approved") | Extraction-shape unit tests (reusing the real zod schema for shape fidelity, no live call); profile-review state-machine tests; capture per state |
| `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` XR-I01/XR-I02 | all four | Context-local by default; `SAME_VIEW`/`CONTEXT_SHEET`/`CONTEXT_INSPECTOR` only; no `SEPARATE_WORKSPACE`/`NEW_PAGE` | Desktop inspector / mobile `TouchlineBottomSheet`, same chrome pair as A07/A09 | Aligned | Interaction smoke test per scenario (no route change, focus restoration) |
| `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` | all four | Immutable fixture identity/version/SHA-256; frozen clock; no network/AI-provider call | `fixture-identity.ts` (W3's, reused unmodified) + per-scenario `fixtures.ts` | Aligned | `fixtures.test.ts` SHA-256 recomputation per scenario |
| `24_CONFLICT_AND_BLOCKER_REGISTER.md` BLK-08 | A11 | Primary/attribute profile-mutation thresholds not locked — "Allowed in design-only phase: Planning only" | Profile-change-review fixture uses an explicit, disclosed hypothetical threshold | Aligned (disclosed, not resolved) | See `BLOCKERS.md` W4-BLK-09 |

## Open items not resolved by source (carried forward, not invented)

| ID | Question | This PR's resolution |
|---|---|---|
| W4-D05 (handoff bundle) | Who owns the structured lineup-proposal schema? | No production owner exists yet (verified). This PR's `a10` fixture schema is explicitly UI-Lab-only, matching `A10`'s own `official_golden_status=NOT_READY` and the register's blocking note: "Interactive prototype cannot prove production revalidation." |
| BLK-08 | Primary-position/attribute mutation threshold and ADR-0139 auto-promotion conflict | Not resolved here — out of scope for a UI-Lab candidate. `a11`'s profile-change-review fixture discloses its threshold as hypothetical, per `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s own instruction. |
| Handoff bundle W4-D04 | Must completed-match (post-match) Assistant Coach be demonstrated in W4? | No — the official register and `20_UI_LAB_CANDIDATE_WAVES.md`'s W4 line scope A05/A08/A10/A11 entirely to pre-match Match Details / Player Detail (`AssistantCoachHypothesisPanel`, `MatchInsights`, lineup review). `completed-match-advisor.ts`'s post-match presentation is a distinct lifecycle (confirmed in `CURRENT_STATE_AUDIT.md`) and is out of scope for this wave. |

## Branch/dependency contract

W3 (PR #779) is **merged** into `main` at commit `9cb708f24c5a024582c4a8dfce204d90baca5ec3`; `main` was fast-forwarded to `1a2b5095ead2568aef2a7a505a15409b588107ac` (which includes the W3 merge plus one unrelated-to-this-wave docs commit) before this branch (`design/gate-a-w4-a05-a08-a10-a11-assistant-coach`) was cut. No stacked-branch authorization was needed.
