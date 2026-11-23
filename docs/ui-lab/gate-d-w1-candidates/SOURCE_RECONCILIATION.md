# Gate D — Source Reconciliation

Status: initiation documentation for Gate D Wave 1. Produced before any Wave 1 scope decision
or implementation, per the programme's required order (recover sources → audit current state →
scope → implement).

## 1. Source bundle location and provenance

The Gate D source contracts were recovered on disk at:

```
.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/programme_v054/
```

This directory is **gitignored** (`.gitignore:111`) — it exists in this checkout but is not
tracked by git and is not guaranteed to exist in any other checkout, in CI, or for a future
agent working from a fresh clone. The Gate A–C precedent (ADR-0139, ADR-0155, ADR-0157 all cite
similarly gitignored `.matchboard-work/...` bundles as their normative source) establishes this
as the accepted convention in this repository, not an anomaly specific to Gate D.

A second copy exists at
`.matchboard-work/Matchboard_Gate_A_W3_A03_A07_A09_Agent_Bundle_2026-10-10/source_contracts/`.
It is byte-identical for the files it contains and its own header states it is "copied
verbatim... authoritative originals live in the attached programme package" — i.e. it explicitly
defers to the `programme_v054/` copy. The `programme_v054/` copy is treated as authoritative
throughout this document; the second copy is not cited independently.

## 2. Required documents — recovery status

All eight documents listed in the Gate D mission brief §2 were found and read in full:

| Document | Status | Role for Gate D |
|---|---|---|
| `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` | FOUND | Gate D scenario register (§3 below) |
| `01_APPROVED_PRODUCT_EXPERIENCE_CONTRACT.md` | FOUND | D1–D7 experience requirements + a position addendum; Gate D lives inside D4/D5 and the addendum |
| `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` | FOUND | Mutation/approval policy; contains the authority conflict in §4 below |
| `13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` | FOUND | XR-A01–A04 (AI/evidence), XR-P01–P04 (position), XR-V01/V02 (visual), XR-I01/I02 (interaction); explicitly scopes Gate D to XR-A01–A04 in Player Detail/evidence/mutation review |
| `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md` | FOUND | XR-I01/I02 — mutation/review decisions open **within Player Detail**, not a new player-management page |
| `21_FIXTURE_CAPTURE_AND_AUTHORITY.md` | FOUND | Fixture/capture rules — consistent with Gate A–C conventions already in use |
| `23_CANDIDATE_REVIEW_AND_APPROVAL_FORM.md` | FOUND | Candidate review form shape, consistent with ADR-0159 |
| `24_CONFLICT_AND_BLOCKER_REGISTER.md` | FOUND | BLK-01–08; BLK-03 (14-role picker) and BLK-08 (mutation thresholds) bear directly on D07/D08 |

Two additional documents in the same bundle are not in the mission brief's required list but are
directly load-bearing and are cited here:

- `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md` — the full 14-role ↔ 24-sided-code mapping
  table. It explicitly names D01/D02/D08 as scenarios that "show cross-surface propagation" of
  this mapping. Required reading for any Wave touching position presentation.
- `02_AUTHORITY_SCOPE_AND_APPROVALS.md` — confirms only a UI-Lab-scoped PR has ever been
  authorized under this programme; production code under `src/app/(app)/**`, domain services,
  Prisma schema, and auth remain forbidden to modify without separate explicit authorization.
  This is consistent with, and does not relax, the Gate D mission brief's own "Permitted /
  Prohibited changes" sections.
- `26_CANDIDATE_MANIFEST_TEMPLATE.json` — a v0.5.4 manifest schema template. **Not used
  verbatim.** The schema actually enforced by the live Visual Authority Gate implementation (as
  used in the merged Gate C W3 `candidate_manifest.json`, PR #843) is newer and is the one this
  wave's `candidate_manifest.json` follows. Per repository convention (and ADR-0159's 2026-11-09
  comment-ledger follow-up already recorded in prior-session memory), the real implementation is
  authoritative over a superseded bundle template.

## 3. Gate D register — exact rows

From `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`, filtered to `capture_wave=GATE_D`. Every row carries
`status=Needs golden`, `direction_status=DIRECTIONAL_ONLY`, `official_golden_status=NOT_READY`,
`source_commit=b070df73664d816f1b0ebc61d54487a24044972e`.

| ID | Surface | Required state | Viewports | Acceptance question | Owner refs |
|---|---|---|---|---|---|
| D01 | Player Detail / Overview | Declared + actual position evidence | Desktop dark, mobile dark | Identity + development story; 14 profile codes, no sided/central labels conflated (XR-P01, XR-P04, XR-V01) | Player page, `player-position-map-widget` |
| D02 | Player Detail / Evidence | Partial + unknown data | Desktop light, mobile light | Profile-level dot consolidation without losing exact sided drill-down or double-counting (XR-P03, XR-A03) | `EvidenceStory`, derived trends |
| D03 | Player Detail / Development–AI | AI hypothesis + coach focus | Desktop dark, mobile light | Defensible longitudinal story; Assistant Coach cannot pad findings (XR-A01, XR-A04) | `AssistantCoachHypothesisPanel`, ADR-0155 |
| D04 | Player Detail / Matches | Unknown minute coverage | Mobile dark, desktop light | Recorded matches vs. not-recorded minutes | `PlayerMatchTimeline` |
| D06 | Player intelligence / Assistant Coach cross-source hypothesis | Trend + observation + position history vs. sparse data | Desktop, mobile | Source-linked story + coach confirmation; no invented performance | `AssistantCoachHypothesisPanel`; derived trends/history |
| D07 | Player Detail / Attribute evolution review | Auto-below-threshold vs. material-approval vs. manual edit | Desktop, mobile | Threshold-based, source-linked review; audit trail; undo when authorised | `player-evidence-service`; assessment-change |
| D08 | Player Detail / Primary position proposal | High evidence, conflicting note, accept/reject | Desktop, mobile | 14-role profile target, never a sided/central tactical code (e.g. never LCB/LAM); coach approval; no exact-history write (XR-P01, XR-P04, XR-I01) | ADR-0139; `effective-position-profile` |
| D09 | Player Detail / Free-text evidence lineage | Explicit/tentative/ambiguous references; edit/retract | Desktop, mobile | Preserve source wording; prevent double counting; no phantom rating | qualitative-evidence-extraction contract; ADR-0152 |

**D05 does not exist in the register.** It is a genuine gap in the source document, not an
omission on this agent's part — no scenario ID D05 is assigned anywhere in the Gate D block of
the CSV. It is not invented here and must not be invented in any later wave without an explicit
owner decision that re-numbers or fills it.

## 4. Authority conflict — ADR-0139 vs. the mutation/approval contract

`04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md` contains an explicit self-flagged entry:

> "Existing repository tension (MUST resolve before implementation)": ADR-0139 auto-promotes a
> player's primary position with no coach approval step, which **contradicts** this contract's
> requirement that primary-position changes receive explicit coach approval.

This conflict is directly load-bearing for **D08** (primary position proposal — accept/reject,
explicitly described as requiring coach approval) and indirectly for **D07** (attribute evolution
review — "material-approval" tier) and **D09** (evidence lineage edit/retract, which touches the
same assessment-change audit trail).

Per the source hierarchy in the mission brief (§2.2), an accepted ADR (ADR-0139) sits above a
programme source contract when they conflict, **but** the programme contract is itself the
document defining Gate D's acceptance criteria for D07/D08/D09 — so neither source can be
silently preferred without misrepresenting either the current accepted architecture or the
scenario's own acceptance question. This is recorded as an unresolved authority conflict in
`BLOCKERS.md` and is the primary reason D07, D08, and D09 are **not** included in Gate D Wave 1
(see `WAVE_SCOPE.md`). It is not resolved, reinterpreted, or worked around in this wave.

## 4b. Second authority conflict — the "14-role profile vocabulary" vs. ADR-0154

Discovered during Wave 1 implementation, not during initial source recovery, and verified
directly in this session (not merely asserted by a sub-agent).

`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md` (not in the mission brief's required list,
but the direct owner reference for D01/D02/D08) states its own status plainly:

> "Status: Product requirement approved in conversation, 2026-10-09... **No source code or
> repository ADR has been changed.** Implementation requires later approved goldens, code-owner
> verification, and **deliberate reconciliation with ADR-0154**."
>
> "ADR-0154 currently states all new player declarations use 24 tactical codes... That is
> **superseded as a future product target** for player declarations, not changed in the
> repository today."

Direct repository verification confirms the document's own framing: `ADR-0154` (Accepted,
`docs/adr/0154-canonical-tactical-position-model.md`) deliberately unified five previously
incompatible position vocabularies into **one** 24-code `CANONICAL_TACTICAL_POSITIONS` set, used
for declaration, tactical slots, actual-position evidence, reporting, and AI context alike
(ADR-0154 §3, §8). A grep for any second, 14-value "profile" vocabulary in production
(`tacticalToProfile`, a profile-projection function, a `PlayerProfilePosition` type) finds it
**only** under `src/app/dev/ui-lab/gate-a/{a06-position-pitches,a12-profile-editor}` — i.e. it
exists exclusively as a Gate A *directional study*, never as a production capability.
`src/lib/player-form-options.ts` and `src/components/players/player-editor-form.tsx` both use
`CANONICAL_TACTICAL_POSITIONS` directly, confirming there is no production 14-role tier today.

**This is not an architectural-residue mismatch (no ARR applies).** Per this repository's own
ARR-governance boundary, an ARR records a mismatch between an *already-decided* intended
architecture and current implementation; it explicitly excludes "a decision that has not yet been
made." Here, the only accepted architecture is ADR-0154's single unified vocabulary — the 14-role
profile tier is self-described by its own source document as a future target awaiting
"deliberate reconciliation," not a decision already made that the codebase has failed to catch up
to. The correct instrument is therefore an owner decision (recorded as a new or amending ADR if
adopted), not an ARR — consistent with how the ADR-0139 conflict in §4 is also an undecided-future-
direction question, not residue.

This conflict directly affects **D01** and **D08**, and is carried into `BLOCKERS.md` and the
Wave 1 candidate manifest's `knownGaps`. It is not silently resolved in either direction: Wave 1's
D01 candidates demonstrate the real, current architecture (one vocabulary, distinguished by
provenance and support-band/confidence, never by a second code system) and explicitly disclose
that this is not the same thing the register's acceptance question describes. See
`docs/ui-lab/gate-d-w1-candidates/VISUAL_VS_CURRENT.md` for how this was handled in the actual
candidate implementation.

## 5. Other normative constraints carried into Wave 1 and future waves

- **XR-I01/I02** (`17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`): position-role and assessment
  review decisions must open within Player Detail itself — no new player-management route.
- **XR-P01–P04** (`13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`, cross-referenced by
  `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`): the 14-role profile vocabulary and the
  24-sided tactical-code vocabulary are never conflated in presentation — a profile position is
  not a tactical slot and vice versa.
- **XR-A01–A04**: Assistant Coach output must remain clearly distinguished from deterministic
  evidence, never outrank it, and never be presented in a way that "pads" sparse findings into
  false confidence.
- **02_AUTHORITY_SCOPE_AND_APPROVALS.md**: this wave's permitted surface is UI Lab only
  (`src/app/dev/ui-lab/gate-d/**` and `docs/ui-lab/gate-d-w1-candidates/**`), consistent with the
  Gate D mission brief's own Permitted/Prohibited changes sections. No production route, domain
  service, Prisma schema, or auth logic is in scope for Wave 1 beyond fixture-safe presentation
  seams, if any are independently justified.

## 6. Source-recovery outcome

No source-recovery failure occurred — all required documents were found. This document does not
need to fall back to the "missing source" procedure in the mission brief §2. The unresolved item
carried forward is the ADR-0139 conflict in §4, which is an authority conflict, not a missing
source.
