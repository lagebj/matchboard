import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";

/**
 * Today's Assistant Coach contextual fallback seam (Gate C W3 — register C07). This type exists
 * purely to let `TodaySurface` render the real, already-shipped Assistant Coach presentation
 * family (`AssistantCoachHypothesisPanel`, `AdvisorPanelStale`, `AdvisorPanelUnavailable` —
 * ADR-0157 §2/§5, ADR-0155 step B7) from a single prop, without Today owning any AI inference,
 * endpoint, or capability-gate logic itself.
 *
 * Production's `today/page.tsx` does not pass this prop today (`undefined`) — Today has no real
 * Assistant Coach data loader yet. Every non-null value here is currently fixture-only (see
 * `src/app/dev/ui-lab/gate-c/c07-assistant-coach-fallback/`); wiring a real loader that mirrors
 * `src/lib/ai/presentation/round-board-advisor.ts`'s three-layer capability gate and
 * fingerprint-freshness check is deliberately out of scope for this seam (see that wave's
 * `BLOCKERS.md` for the disclosed production-integration gap).
 */
export type TodayAssistantCoachContext =
  | { status: "off" }
  | { status: "empty" }
  | { status: "fresh"; hypotheses: AssistantCoachHypothesisViewModel[] }
  | { status: "stale" }
  | { status: "unavailable" };

/** Whether this context renders anything at all — "off" and "empty" are both "no panel", per
 * every existing Advisor surface's "no empty card" rule (never a loading placeholder, never a
 * page-level error). Shared by `TodaySurface` (context-rail layout) and
 * `TodayAssistantCoachPanel` (what to actually render), so the two never disagree. */
export function isTodayAssistantCoachVisible(
  context: TodayAssistantCoachContext | null | undefined,
): context is Extract<TodayAssistantCoachContext, { status: "fresh" | "stale" | "unavailable" }> {
  if (!context) return false;
  return context.status === "fresh" || context.status === "stale" || context.status === "unavailable";
}
