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
| Editing representation | Select the proposed candidate → diff preview ("RCM: Empty → Tobias — draft, not yet applied") → `Apply proposal` → `PENDING` (fixture-simulation gate) → resolved outcome. `stale-proposal-blocked`/`disabled-or-failed` never render an Apply affordance at all — blocked structurally, before any submit |
| Canonical server/domain owner | **Not invoked, and does not yet exist as a real capability.** Verified in source: `src/lib/ai/presentation/planned-match-advisor.ts`'s `PlannedMatchAdvisorViewModel` only ever carries free-text `insights`, never a structured mutation payload (`CURRENT_STATE_AUDIT.md` item 5). The eventual real mutation owner would be `src/app/(app)/matches/lineup-actions.ts`'s `assignPlayerToSlot`, which itself has no revision/fingerprint parameter today (W4-BLK-03) |
| Pending/success/rejection/conflict feedback | `PENDING` ("Applying… (fixture simulation)"), `SUCCESS` ("Saved (simulated)" + pitch re-renders Tobias at RCM from `useFixtureOperation.authoritative`), stale: a structural "This proposal is stale — revalidate before applying" reason citing both the expected and current revision, unavailable: an honest "no automated lineup suggestion was generated" reason pointing back to manual editing |
| Context restoration | Match identity and the "BEFORE · Lineup tab" label stay visible throughout; closing restores focus to the "Review lineup" trigger |
| Navigation classification + rationale | `CONTEXT_INSPECTOR`/`CONTEXT_SHEET`. Rationale: XR-I01 — "Review lineup / Explore alternatives" stays in Match Details by binding contract |

## A11 — Qualitative evidence + mutation (all three scenarios)

| Field | Value |
|---|---|
| Origin object/screen | Player Detail — `coach-text-and-parsed-evidence` for `player-w3-tobias` (continuity with A05/A08); `profile-change-review-guarded`/`-rejected` for `player-w3-sindre` (a distinct player, chosen because his real W3 story — recorded LCM tactical minutes — is the exact "sided tactical observation contributing to an unsided CM profile role" case `04_ASSISTANT_COACH_AND_PLAYER_MUTATIONS.md`'s position-domain refinement describes) |
| Action purpose | `coach-text-and-parsed-evidence`: show a coach's immutable original note alongside its parsed, source-linked observations. `profile-change-review-*`: review a guarded before/after declared-primary-position proposal and explicitly Accept/Reject/Defer |
| Host | `SAME_VIEW` |
| Editing representation | Extraction scenario is read-only (no action). Review scenarios: Accept / Reject / Defer, one immediate simulated outcome, no draft/PENDING step (the source doc describes a direct decision, not a server round-trip) |
| Canonical server/domain owner | **Not invoked.** Verified real owners: `src/lib/evidence/qualitative-evidence-extraction-contract.ts`'s `extractionResponseSchema`/`safeParseExtractionResponse`/`validateExtractionSemantics` (actually imported and run against this fixture's data for shape fidelity — the only W4 file that imports a real production module directly, since it is pure and safe to import) and `src/lib/evidence/player-evidence-service.ts` (read only, not imported — it is a real, already-shipped automatic-application pipeline, not yet a guarded-approval one; see `BLOCKERS.md` W4-BLK-09) |
| Pending/success/rejection/conflict feedback | `ACCEPTED (simulated)` / `REJECTED (simulated)` / `DEFERRED (simulated)`, each stating plainly that no real provider or database write occurred |
| Context restoration | N/A — no dialog opens |
| Navigation classification + rationale | `SAME_VIEW`. Rationale: this is Player Detail's own evidence/profile presentation, never a separate AI workspace |

## Cross-cutting disclosures

- **League/Event parity** (W4-BLK-08): every A10 scenario uses the W3 League match anchor (`match-w3-01`). No Event-context equivalent is built or claimed here.
- **No second rules engine**: every "eligible"/"blocked"/"stale" fact in A10/A11 is a predeclared fixture value, never a client-side recomputation of eligibility, permission, or staleness policy.
- **Evidence and access safety**: no fixture in this wave exposes another tenant's/group's data; cross-group/cross-match proof is covered by the negative fixture tests in each scenario's own `fixtures.test.ts` (schema/semantic validation rejecting an unresolvable `playerRef`, a mismatched revision, etc.).
