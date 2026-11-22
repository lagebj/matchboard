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
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { GATE_C_W3_ORG_SLUG } from "./fixtures";

/**
 * Gate C W3 shared mount (C07) — same pattern as W1's `GateCTodayMount`: a small client boundary
 * so every scenario's `page.tsx` can stay a plain server component, matching the real production
 * `today/page.tsx`'s own shape (server loader -> client `TodaySurface`). Reused rather than
 * reimplemented: imports the real, unmodified `TodaySurface`, and mounts the real
 * `assistantCoachContext` prop it already accepts — C07's only actual integration seam.
 */
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
  /** Every Gate C scenario passes a fixed reference instant explicitly, rather than relying on
   * `TodaySurface`'s own `new Date()` fallback. */
  nowIso: string;
}) {
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
        assistantCoachContext={props.assistantCoachContext}
        nowIso={props.nowIso}
      />
    </OrgSlugProvider>
  );
}
