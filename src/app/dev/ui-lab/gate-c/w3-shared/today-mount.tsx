"use client";

import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { TodaySurface } from "@/components/touchline/today/today-surface";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { CoachSituationProjection } from "@/lib/situational/situation-types";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type {
  AssistantCoachHypothesisActionResult,
  AssistantCoachHypothesisActions,
} from "@/components/ai/assistant-coach-hypothesis-panel";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { GATE_C_W3_ORG_SLUG } from "./fixtures";

/**
 * Gate C W3 shared mount (C07) — same pattern as W1's `GateCTodayMount`: a small client boundary
 * so every scenario's `page.tsx` can stay a plain server component, matching the real production
 * `today/page.tsx`'s own shape (server loader -> client `TodaySurface`). Reused rather than
 * reimplemented: imports the real, unmodified `TodaySurface`, and mounts the real
 * `assistantCoachContext` prop it already accepts — C07's only actual integration seam.
 *
 * `simulateAssistantCoachActions` (a plain boolean, not the actions object itself) exists
 * because a Server Component's props to a Client Component must be serializable — a plain
 * function (not a "use server" Server Action) constructed in a server `fixtures.ts`/`page.tsx`
 * and passed down as a prop throws a real React Server Components error at runtime (confirmed
 * live: this exact shape crashed CI's capture job with
 * `locator.waitFor: Timeout 30000ms exceeded` on C07-ON, invisible to component tests that
 * render the page directly and never cross the real server/client boundary — the same class of
 * bug `today/page.tsx`'s own doc comment already warns about for Server Actions). The simulated
 * handlers are therefore constructed here, inside this already-"use client" module, never
 * serialized across the boundary.
 */
function simulateAssistantCoachAction(): Promise<AssistantCoachHypothesisActionResult> {
  return Promise.resolve({ success: true });
}

const SIMULATED_ASSISTANT_COACH_ACTIONS: AssistantCoachHypothesisActions = {
  confirm: simulateAssistantCoachAction,
  dismiss: simulateAssistantCoachAction,
};

export function GateCW3TodayMount(props: {
  commandCentre: AssistantCommandCentre;
  liveNow: TodayLiveNowResult;
  projection?: CoachSituationProjection;
  selectionDecisions?: TodaySelectionDecision[];
  matchdayContext?: TodayMatchdayContext;
  squadStatus?: TodaySquadStatus | null;
  upcomingMatches?: MatchPresentation[];
  carryForwardItems?: TodayCarryForwardItem[];
  assistantCoachContext?: TodayAssistantCoachContext | null;
  /** When true and `assistantCoachContext.status === "fresh"`, wires the deterministic simulated
   * Promote/Dismiss handlers (constructed above, client-side only) instead of expecting the
   * fixture itself to supply a non-serializable `actions` object. */
  simulateAssistantCoachActions?: boolean;
  /** Every Gate C scenario passes a fixed reference instant explicitly, rather than relying on
   * `TodaySurface`'s own `new Date()` fallback. */
  nowIso: string;
}) {
  const assistantCoachContext =
    props.simulateAssistantCoachActions && props.assistantCoachContext?.status === "fresh"
      ? { ...props.assistantCoachContext, actions: SIMULATED_ASSISTANT_COACH_ACTIONS }
      : props.assistantCoachContext;

  return (
    <OrgSlugProvider orgSlug={GATE_C_W3_ORG_SLUG}>
      <TodaySurface
        commandCentre={props.commandCentre}
        projection={props.projection}
        selectionDecisions={props.selectionDecisions ?? []}
        applyRecommendation={async () => ({
          success: false,
          message: "UI Lab candidate — no production mutation available.",
        })}
        carryForwardItems={props.carryForwardItems ?? []}
        liveNow={props.liveNow}
        squadStatus={props.squadStatus}
        upcomingMatches={props.upcomingMatches}
        matchdayContext={props.matchdayContext}
        assistantCoachContext={assistantCoachContext}
        nowIso={props.nowIso}
      />
    </OrgSlugProvider>
  );
}
