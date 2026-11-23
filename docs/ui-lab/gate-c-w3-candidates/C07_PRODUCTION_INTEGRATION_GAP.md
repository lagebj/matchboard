# C07 — Design Acceptance and Production-Integration Gap Report

## Disposition

- **UI Lab candidate:** complete. All 5 required states (OFF, ON, EMPTY, ERROR, STALE) render
  against the real, unmodified `TodaySurface`, using the real Assistant Coach presentation
  components, at every required viewport/theme.
- **Visual approval:** pending. CANDIDATE status; owner review required
  (`/visual-approve`/`/visual-reject`), never self-approved.
- **Production integration:** **not implemented.** Today has no real Assistant Coach data loader.
  This is explicitly disclosed, not implied as complete.

## What exists today

- `TodaySurface` accepts an optional `assistantCoachContext` prop (5-state discriminated union:
  `off | fresh | empty | stale | unavailable`). Production's `today/page.tsx` never passes it.
- A new presentational component, `TodayAssistantCoachPanel`, maps that context to the real,
  already-shipped Assistant Coach components (`AssistantCoachHypothesisPanel`,
  `AdvisorPanelStale`, `AdvisorPanelUnavailable`) — no new AI presentation component was built.
- **Remediation finding and fix** (external review, see `REVIEW_RECORD.md` pass 3): the first
  version of this candidate mounted the real `AssistantCoachHypothesisPanel` with its Promote/
  Dismiss controls wired to the real `confirmAssistantCoachHypothesisAction`/
  `dismissAssistantCoachHypothesisAction` Server Actions. Those actions require a real session
  and a persisted `AssistantCoachHypothesis` row — neither exists for `/dev/ui-lab`'s synthetic,
  unauthenticated fixture, so clicking them would not "fail gracefully" with a clean not-found
  message; it would hit a real, uncaught auth failure. Fixed by adding an optional `actions`
  override to `AssistantCoachHypothesisPanel` (`AssistantCoachHypothesisActions`): a non-production
  caller can substitute deterministic, fixture-safe confirm/dismiss handlers that resolve the same
  `{success}`/`{error}` shape the real actions return, without ever calling a Server Action or
  writing to persistence. Production passes nothing, so the real actions still run, unchanged.
  C07-ON now uses this to demonstrate genuine disabled→enabled→simulated-success interaction
  states (component tests, `on/__tests__/page.test.tsx`; Playwright, `e2e/ui-lab-gate-c.spec.ts`
  — the Playwright coverage additionally asserts zero POST network requests fire when either
  control is clicked, proving the real Server Action is never invoked), and the page explicitly
  discloses "Promote and Dismiss on this candidate are simulated: no Server Action is called, and
  no player-development record is written."
- **Follow-up fix** (real CI, see `REVIEW_RECORD.md` pass 5): the simulated handlers themselves
  must not be constructed in server-side fixture code — a Server Component's props to a Client
  Component must be serializable, and a plain function crossing that boundary threw a real React
  Server Components error, caught by CI's capture job. The simulated handlers now live inside
  `w3-shared/today-mount.tsx` (already `"use client"`), activated by a plain boolean prop
  (`simulateAssistantCoachActions`) rather than a function value ever crossing the boundary. The
  `actions` override on `AssistantCoachHypothesisPanel` itself is unchanged by this follow-up.

## What does not exist (the real remaining work)

A production data loader for Today that:

1. Checks the real three-layer capability gate (`organisation-ai-settings.ts`'s
   `isAiCapabilityEnabled(settings, "ASSISTANT_COACH")` + active-connection `READY` check) —
   exactly the pattern `getRoundBoardAdvisorViewModel()`/`getPlayerAssistantCoachHypotheses()`
   already use for Round Board/Player Detail.
2. Computes a real hypothesis for Today's situational context (which player, which round) — this
   is new AI-generation scope, not presentation scope, and would need its own design/data-contract
   decision about what Today-level hypotheses are even useful (the register's own
   `existing_owner_or_reference` column says "TodaySurface; situation policy; no second ranking" —
   any real hypothesis must derive from facts Today already has, never a second ranking engine).
3. Computes and compares a source fingerprint (reusing `computeSourceFingerprint()`, the same
   freshness mechanism Round Board already uses) to decide fresh vs. stale.
4. Is wired into `today/page.tsx` alongside the existing `Promise.all([...])` data loads.

Per your explicit decision, no ADR amendment is opened for this future work in this branch — when
someone picks it up, ADR-0157 (§4 shared decision/evidence contract, §6 "Today convergence") and
ADR-0155 (step B7, the hypothesis/assessment capability) are the governing decisions to extend,
most likely via an ADR amendment at that time.

## Why this split is honest, not a loophole

The brief explicitly authorizes exactly this split for this wave (see
`SOURCE_RECONCILIATION.md`). Nothing in the candidate claims live AI connectivity, a real
hypothesis-generation call, or production readiness beyond fixture-driven UI Lab demonstration —
every scenario's own doc comment and this report say so explicitly.
