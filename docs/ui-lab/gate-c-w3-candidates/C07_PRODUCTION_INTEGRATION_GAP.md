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
