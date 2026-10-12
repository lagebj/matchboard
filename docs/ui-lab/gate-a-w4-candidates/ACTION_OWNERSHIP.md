# Gate A W4 — Action Ownership

Per `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`'s mandatory decision rule: every action states its
origin object/screen, purpose, host, editing representation, canonical server/domain owner
**verified from current source**, pending/success/rejection/conflict feedback, context
restoration, and navigation classification + rationale. Default is `SAME_VIEW`; this wave only
ever uses `SAME_VIEW`, `CONTEXT_INSPECTOR`, or `CONTEXT_SHEET` — no `SEPARATE_WORKSPACE`, no
`NEW_PAGE`.

## A05 — Assistant Coach semantic grammar (all four scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Player Detail, for the W3-shared player identity `player-w3-tobias` (reused for fixture continuity, not a new invented player) |
| Action purpose | Show the Assistant Coach hypothesis grammar across disabled/pattern/no-pattern/unavailable, next to the real deterministic `MatchInsights` |
| Host | `SAME_VIEW` — inline cards on the page, no dialog |
| Editing representation | `enabled-with-pattern` only: fill a development-focus text input, then Promote or Dismiss |
| Canonical server/domain owner | **Not invoked.** Verified real owner: `confirmAssistantCoachHypothesisAction`/`dismissAssistantCoachHypothesisAction` (`src/app/(app)/o/[orgSlug]/players/[playerId]/assistant-coach-actions.ts`). The real `AssistantCoachHypothesisPanel` hardcodes these calls directly and is not fixture-injectable — see `BLOCKERS.md` W4-BLK-10; this candidate's own `assistant-coach-hypothesis-card.tsx` simulates the same promote/dismiss decision locally instead |
| Pending/success/rejection/conflict feedback | `PROMOTED`/`DISMISSED` are immediate simulated outcomes (no `PENDING` — the real action has no optimistic-concurrency concept either) |
| Context restoration | No dialog opens; nothing to restore |
| Navigation classification + rationale | `SAME_VIEW`. Rationale: this is Player Detail's own hypothesis presentation, not an isolated AI workspace |

## A08 — Assistant Coach activation parity (all three scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Same Player Detail identity as A05, through the shared `ActivationHarness` |
| Action purpose | Prove the SAME surrounding layout across OFF/ON-strong-pattern/ON-no-insight — only the Assistant Coach slot differs |
| Host | `SAME_VIEW` |
| Editing representation | None distinct from A05 — A08 reuses the exact same hypothesis card and no-pattern notice |
| Canonical server/domain owner | **Not invoked** — same as A05. Real owner: `src/lib/ai/organisation-ai-settings.ts`'s `isAiCapabilityEnabled`/master-switch gating (verified, not called) |
| Pending/success/rejection/conflict feedback | N/A for `off`/`on-no-insight` (no action); `on-strong-pattern` shares A05's simulated promote/dismiss |
| Context restoration | N/A |
| Navigation classification + rationale | `SAME_VIEW` |

## A10 — Assistant Coach structured action (all three scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Match Details BEFORE, Lineup tab, for `match-w3-01` — same W3 anchor A07 uses |
| Action purpose | Review an Assistant Coach lineup-assignment proposal (evidence, rationale, limitations, expected consequences) and, where valid, apply it, without leaving Match Details |
| Host | `CONTEXT_INSPECTOR` (desktop, `aria-modal="false"`) / `CONTEXT_SHEET` (mobile, `TouchlineBottomSheet`, `aria-modal="true"`) — same `useMediaQuery("(min-width: 600px)")` picker as A07 |
| Editing representation | Open → `validateLineupProposal` (`shared/lineup-proposal-contract.ts`, now a non-throwing `unknown`-accepting runtime shape boundary — round-2 finding N4) runs before anything renders as actionable, resolving the occupant of the PROPOSAL'S OWN exact target slot from an authoritative slot-indexed map built from the same `matchW3PlanningPitchAssignments` projection the pitch renders from (round-2 finding N1 — a single hardcoded "current slot" field previously let a proposal targeting any slot validate against RCM's unrelated empty state) → candidate identity/rationale/limitations/evidence render as a plain non-interactive info block, with evidence inspection as an independent sibling control, never nested inside the "Select proposal" button (round-2 finding N2) → selecting shows the complete before/after diff naming the actual proposed player, with "Draft, not yet applied." as a separate status line (round-2 finding N3) → `Apply proposal` → `PENDING` (fixture-simulation gate; Discard is unavailable while PENDING — round-1 finding R3) → resolved outcome. `stale-proposal-blocked` stays inspectable (evidence/rationale visible) but renders no Select/Apply row at all — `applicability: "STALE"` blocks it structurally, before any submit. `disabled-or-failed` has no proposal to inspect. Reopening after a `SUCCESS` shows an "Already applied (simulated)" state derived from the authoritative pitch projection itself, never a component-local boolean — round-1 finding R4 |
| Canonical server/domain owner | **Not invoked, and does not yet exist as a real capability.** Verified in source: `src/lib/ai/presentation/planned-match-advisor.ts`'s `PlannedMatchAdvisorViewModel` only ever carries free-text `insights`, never a structured mutation payload (`CURRENT_STATE_AUDIT.md` item 5). The eventual real mutation owner would be `src/app/(app)/matches/lineup-actions.ts`'s `assignPlayerToSlot`, which itself has no revision/fingerprint parameter today (W4-BLK-03). `lineup-proposal-contract.ts`'s `validateLineupProposal` is explicitly scope/structure validation only (runtime shape, match/group scope, roster membership, EXACT target-slot occupancy, duplicate-assignment prevention, diff validity, evidence resolution/scope/subject-relationship, action-kind/producer allowlists, stale-revision detection) — it never decides permission, eligibility, or planning-boundary outcomes, which remain predeclared `useFixtureOperation` fixture responses; this is deliberately not a second authorization engine |
| Pending/success/rejection/conflict feedback | `PENDING` ("Applying… (fixture simulation)"), `SUCCESS` ("Saved (simulated)" + pitch re-renders Tobias at RCM from `useFixtureOperation.authoritative`), stale: a structural "This proposal is stale — revalidate before applying" reason citing both the expected and current revision, unavailable: an honest "no automated lineup suggestion was generated" reason pointing back to manual editing, already-applied: an honest "no longer actionable" state |
| Context restoration | Match identity and the "BEFORE · Lineup tab" label stay visible throughout; closing restores focus to the "Review lineup" trigger |
| Navigation classification + rationale | `CONTEXT_INSPECTOR`/`CONTEXT_SHEET`. Rationale: XR-I01 — "Review lineup / Explore alternatives" stays in Match Details by binding contract |

## A11 — Qualitative evidence + mutation (all three scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Player Detail — `coach-text-and-parsed-evidence` for `player-w3-tobias` (continuity with A05/A08); `profile-change-review-guarded`/`-rejected` for `player-w3-sindre` (a distinct player, chosen because his real W3 story — recorded LCM tactical minutes — is the exact "sided tactical observation contributing to an unsided CM profile role" case `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s position-domain refinement describes) |
| Action purpose | `coach-text-and-parsed-evidence`: show a coach's immutable original note alongside its parsed, source-linked observations. `profile-change-review-*`: review a guarded before/after declared-primary-position proposal and explicitly Accept/Reject/Defer |
| Host | `SAME_VIEW` |
| Editing representation | Extraction scenario is read-only (no action); each observation's `period` is only ever set when the coach's own text actually supports it (independent review finding R1 — a prior version wrongly attributed "second half" to a claim the note never scoped to a half). Review scenarios: Accept / Reject / Defer, one immediate simulated outcome via `useProfileChangeReview` (`shared/profile-change-review-card.tsx`), no draft/PENDING step (the source doc describes a direct decision, not a server round-trip) |
| Canonical server/domain owner | **Not invoked.** Verified real owners: `src/lib/evidence/qualitative-evidence-extraction-contract.ts`'s `extractionResponseSchema`/`safeParseExtractionResponse`/`validateExtractionSemantics` (actually imported and run against this fixture's data for shape fidelity — the only W4 file that imports a real production module directly, since it is pure and safe to import) and `src/lib/evidence/player-evidence-service.ts` (read only, not imported — it is a real, already-shipped automatic-application pipeline, not yet a guarded-approval one; see `BLOCKERS.md` W4-BLK-09) |
| Pending/success/rejection/conflict feedback | `ACCEPTED (simulated)` / `REJECTED (simulated)` / `DEFERRED (simulated)`, each stating plainly that no real provider or database write occurred. `useProfileChangeReview` models a real authoritative `declaredPrimary` projection for this fixture — Accept genuinely changes it exactly once (idempotent against a repeated click), Reject/Defer leave it provably unchanged; the outcome message and the displayed authoritative value are read from the SAME state, never a canned success string (independent review finding R5) |
| Context restoration | N/A — no dialog opens |
| Navigation classification + rationale | `SAME_VIEW`. Rationale: this is Player Detail's own evidence/profile presentation, never a separate AI workspace |

## Cross-cutting disclosures

- **League/Event parity** (W4-BLK-08): every A10 scenario uses the W3 League match anchor (`match-w3-01`). No Event-context equivalent is built or claimed here.
- **No second rules engine**: `lineup-proposal-contract.ts`'s `validateLineupProposal` checks structural integrity, source resolution, entity scope, and snapshot consistency — it never decides permission, eligibility, or planning-boundary outcomes. Every "eligible"/"blocked"/"stale" *authorization* fact in A10/A11 remains a predeclared fixture value (`useFixtureOperation`'s outcome kinds), never a client-side recomputation of permission/eligibility policy.
- **Evidence and access safety**: no fixture in this wave exposes another tenant's/group's data; cross-group/cross-match proof is covered by negative fixture tests — A10's `shared/__tests__/lineup-proposal-contract.test.ts` (45 cases, round 2: covering every rejection code including the new `UNSUPPORTED_PRODUCER`/`DUPLICATE_ASSIGNMENT`/`EVIDENCE_SUBJECT_MISMATCH`, exact-slot occupancy, and a dedicated non-throwing-runtime-shape sweep) and each scenario's own `fixtures.test.ts`.

## Remediation record (independent technical review, PR #780)

**Round 1** — five findings (R1–R5) remediated against commit `db37d1c84`:

| Finding | Area | Fix |
|---|---|---|
| R1 | A11 | Removed an unsupported `period: "SECOND_HALF"` attribution the extraction fixture invented; the coach's note never scopes the composure claim to a half |
| R2 | A10 | New `lineup-proposal-contract.ts` (strict typed proposal, 11 rejection codes, stale-vs-rejected distinction) + a per-source evidence inspector replacing a bare evidence count — **partially resolved**, see round 2 |
| R3 | A10 | Discard draft is now unavailable while `PENDING`, via one centralized `deriveOperationControlPolicy`, not a scattered per-button condition |
| R4 | A10 | "Already applied" is derived from the authoritative pitch projection itself, never a component-local boolean — reopening after `SUCCESS` cannot look freshly actionable again |
| R5 | A11 | New `useProfileChangeReview` hook models a real authoritative `declaredPrimary` value; Accept/Reject/Defer genuinely change (or don't change) it, and the outcome message reads that same state |

**Round 2** — R2 was only partially resolved; a follow-up review found four concrete problems in it
plus one remaining A11 attribution concern, against commit `8b4a7479c`:

| Finding | Priority | Area | Root cause | Fix |
|---|---|---|---|---|
| N1 | P1 | A10 | `ctx.currentSlotPlayerId` was a single field populated from RCM's empty state, regardless of which slot a proposal actually named — a proposal targeting any OTHER slot (e.g. occupied GK) could validate against RCM's unrelated `null` | `LineupProposalValidationContext.slotOccupants: ReadonlyMap<string, string \| null>`, built in `lineup-proposal-fixture.ts` from the SAME `matchW3PlanningPitchAssignments` projection the pitch renders from — the validator now resolves the occupant of the proposal's OWN `slotId`. Also added duplicate-assignment prevention (a player already occupying a different slot cannot be silently proposed for a second one) |
| N2 | P2 | A10 | `EvidenceSourceList` (`<details>`/`<summary>`) was rendered INSIDE the candidate-selection `<button>` — invalid nested interactive HTML; expanding/collapsing evidence could toggle selection | Candidate identity/rationale/limitations/evidence are now a plain non-interactive info block; "Select proposal" is a separate sibling `<button>`, never a wrapper |
| N3 | P2 | A10 | Diff preview read `"RCM: Empty → draft, not yet applied."` — never named the proposed player at all | Preview now reads `"RCM: Empty → Tobias"` with `"Draft, not yet applied."` as a separate status line, derived from `candidateDisplayName` (the same prop driving the rest of the UI) |
| N4 | P2 | A10 | `validateLineupProposal(proposal: LineupSlotAssignmentProposal, ...)` accepted the compile-time type directly — TypeScript provides no runtime guarantee; a malformed payload (e.g. missing `before`) would throw reading `proposal.before.playerId` | Signature changed to accept `unknown`; a new `zod` `.strict()` shape schema validates every field's runtime type before any semantic check runs — malformed input always resolves to a typed `{ valid: false, code: "MALFORMED_PAYLOAD" }`, never a thrown exception |
| A11-F1 | Verify | A11 | Round 1's own fix left `phase: "BUILD_UP"` unexamined on the same composure observation — the note names a position ("deeper midfield"), never a tactical phase | Changed to `phase: "GENERAL"`, per the real contract's own rule 6 ("use GENERAL when the tactical phase is not clear from the text") |

All of round 1's R1/R3/R4/R5 fixes were independently re-verified as still intact after round 2's
changes — see the regression commands below.
