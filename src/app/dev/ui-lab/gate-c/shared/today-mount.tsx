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

/**
 * Gate C W1 shared mount. Kept as its own small client boundary so every scenario's `page.tsx`
 * can stay a plain server component — exactly the real production `today/page.tsx`'s own shape
 * (server loader -> client `TodaySurface`), not a Gate-C-local pattern. This matters beyond
 * convention: C03's kickoff-offset fixture is relative to the real `Date.now()``(see
 * `shared/fixtures.ts`'s own doc comment), and computing it inside a CLIENT page component means
 * it evaluates once during the server's initial render pass and again, independently, a moment
 * later during browser hydration — two different timestamps, producing a React hydration
 * mismatch (confirmed live: `gate-c-w1-c03-league-prepare` failed the capture script's
 * console-error gate with exactly this error before this fix). A server component computes the
 * fixture exactly once per request; this component only ever receives the already-resolved,
 * serializable result as props, the same way `TodaySurface` already receives
 * `AssistantCommandCentre.computedAt` (a `Date`) from the real production server loader.
 */
export function GateCTodayMount(props: {
  commandCentre: AssistantCommandCentre;
  liveNow: TodayLiveNowResult;
  projection?: CoachSituationProjection;
  selectionDecisions?: TodaySelectionDecision[];
  matchdayContext?: TodayMatchdayContext;
  squadStatus?: TodaySquadStatus | null;
  upcomingMatches?: MatchPresentation[];
  carryForwardItems?: TodayCarryForwardItem[];
}) {
  return (
    <OrgSlugProvider orgSlug="acme">
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
      />
    </OrgSlugProvider>
  );
}
