# Gate D W2 — Interaction and State Audit

## Required interaction vs. implemented interaction

| Requirement (mission §11) | Implemented | Where |
|---|---|---|
| Hypothesis initially pending | Yes — every interactive fixture starts with no `outcome` set | All D03/D06 interactive scenarios |
| Development-focus input required where the action contract requires it | Yes — Promote stays disabled until the real component's own `focus.trim().length === 0` check passes (unmodified production behaviour) | D03-GROUNDED, D03-DECISION-FLOW, D06-SOURCE-INSPECTION |
| Confirmation enabled only when valid | Yes — same real component check | Same |
| Simulated successful confirmation | Yes | D03-GROUNDED, D03-DECISION-FLOW (`confirm-demo`), D06-SOURCE-INSPECTION |
| Simulated dismissal | Yes | D03-DECISION-FLOW (`dismiss-demo`), D06-SOURCE-INSPECTION |
| Failure response where relevant | Yes — `error-demo` in D03-DECISION-FLOW simulates a Promote failure with a visible inline error, hypothesis remains pending | D03-DECISION-FLOW |
| No unintended persistent changes | Yes by construction — every simulated action resolves a plain in-memory Promise; no fixture ever imports or calls a real Server Action | All |
| Source inspection opens the correct cited source | Yes — `EvidenceSourceInspector` resolves each ref through `resolveEvidenceSource`, which throws on any mismatch, so an incorrect source can never silently render | D06-COHERENT, D06-CONTRADICTION, D06-SOURCE-INSPECTION, D03-GROUNDED |
| Source inspection preserves player context | Not separately modelled — these fixtures are single-player pages with no cross-player navigation, so there is no player-context boundary to preserve or lose. Disclosed rather than silently assumed satisfied. | — |
| Source inspection distinguishes observed and derived evidence | Yes — `provenance: "RECORDED" | "DERIVED"` renders as a distinct `StatusPill` per source | D06-COHERENT, D06-CONTRADICTION, D06-SOURCE-INSPECTION |
| Source inspection identifies unknown/incomplete coverage | Yes — every source record's `coverage` field states its own sample/completeness explicitly | All D06 interactive scenarios |

## Unavailable states

The mission brief (§11) requires: no stale hypothesis shown as current; no provider error
presented as loss of recorded evidence; deterministic evidence and coach-authored content stay
usable with AI disabled; no actions shown against a non-current hypothesis.

**Audited, not newly built**: `getPlayerDevelopmentCycleInsight()`'s own doc comment confirms its
snapshots are immutable per review window — matches recorded after the window ended do not
invalidate it (`CURRENT_STATE_AUDIT.md`). No scenario in this wave needed to demonstrate a stale
cycle insight because the real reader's own contract already prevents that state from existing.

**Disclosed, not solved**: `getPlayerAssistantCoachHypotheses()` collapses AI-off, no-active-
hypothesis, and provider-not-ready into the same `[]` return (`CURRENT_STATE_AUDIT.md`). This
wave's D03-SPARSE/D06-SPARSE scenarios demonstrate the *evidence-insufficiency* case specifically
(the one case the register's own acceptance questions require), using the new
`NoDefensibleHypothesis` component — not a claim that production now distinguishes AI-off from
evidence-insufficient. Where the production loader currently collapses several states to `[]`,
that fact is preserved here, not hidden behind this wave's own more informative directional
presentation.

## Simulated mutation — the full discipline, per scenario

Every interactive scenario passes `simulateActions` to `AssistantCoachHypothesisMount`, which
builds a `confirm`/`dismiss` pair that resolves a plain `Promise` with no network call, no import
of `confirmAssistantCoachHypothesisAction`/`dismissAssistantCoachHypothesisAction`, and no write
to any Prisma model. Verified three ways:

1. **Component tests** (`vitest.config.components.ts`) — every Promote/Dismiss interaction is
   exercised via `@testing-library/user-event`, asserting the resulting DOM state (hypothesis
   text disappears on success, error text appears and hypothesis persists on simulated failure).
2. **Playwright** (`e2e/ui-lab-gate-d.spec.ts`, pending real CI execution — see `BLOCKERS.md`) —
   every new `describe` block for D03/D06 uses the existing `collectServerActionRequests()`
   helper (filters on the real `next-action` request header, not a blanket POST check, matching
   both Gate C W3's and Gate D W1's own established precedent for why a blanket check is
   unreliable) and asserts `requests.length === 0` after each simulated interaction.
3. **Code review** — `AssistantCoachHypothesisMount` is the only `"use client"` file in this
   wave's new code that imports `AssistantCoachHypothesisPanel`; no Wave 2 `page.tsx` imports the
   real Server Actions at all.

## Capability/freshness-state presentation where applicable

Not separately modelled beyond the sparse/no-hypothesis states above — D03/D06's acceptance
questions concern evidence sufficiency, not AI-provider lifecycle states (OFF/EMPTY/ERROR/STALE
as a provider-connection concept belongs to Gate C W3's C07, already delivered). Reusing
`AdvisorPanelUnavailable`/`AdvisorPanelStale` here would misrepresent a provider-lifecycle
component as answering an evidence-sufficiency question it was not built for — not done.

## Keyboard accessibility for implemented controls

- `EvidenceSourceInspector` uses native `<details>/<summary>` — keyboard-focusable and togglable
  with Enter/Space with zero custom JavaScript, inheriting the browser's own accessibility tree
  (the same primitive Wave 1's D01/D02 candidates already used for their own drill-downs).
- Promote/Dismiss buttons and the development-focus `<input>` are the real, unmodified production
  component's own controls — already keyboard-reachable (confirmed by Gate C W3's own Playwright
  coverage of the identical component).
