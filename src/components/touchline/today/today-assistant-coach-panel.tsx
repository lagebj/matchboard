import { AssistantCoachHypothesisPanel } from "@/components/ai/assistant-coach-hypothesis-panel";
import { AdvisorPanelStale, AdvisorPanelUnavailable } from "@/components/ai/advisor-panel";
import {
  isTodayAssistantCoachVisible,
  type TodayAssistantCoachContext,
} from "@/lib/touchline/presentation/today-assistant-coach";

/**
 * Today's Assistant Coach contextual fallback (Gate C W3, register C07; ADR-0157 §2/§5). Renders
 * exactly one of the real, already-shipped Assistant Coach presentation components — never a new
 * one — and renders nothing at all for "off" (capability disabled) and "empty" (capability
 * available, no material hypothesis): both cases must look identical to Today's existing
 * composition, never an empty panel or a loading placeholder.
 *
 * This component owns no AI boundary logic itself — it only maps an already-resolved context to
 * presentation, exactly like `getRoundBoardAdvisorViewModel()`'s own `"fresh" | "stale"` result
 * does for Round Board.
 */
export function TodayAssistantCoachPanel({ context }: { context: TodayAssistantCoachContext | null | undefined }) {
  if (!isTodayAssistantCoachVisible(context)) return null;

  if (context.status === "fresh") {
    return <AssistantCoachHypothesisPanel hypotheses={context.hypotheses} actions={context.actions} />;
  }
  if (context.status === "stale") {
    return <AdvisorPanelStale />;
  }
  return <AdvisorPanelUnavailable />;
}
