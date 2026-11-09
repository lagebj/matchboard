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
import { GATE_C_ORG_SLUG } from "./fixtures";

/**
 * Gate C W1 shared mount. Kept as its own small client boundary so every scenario's `page.tsx`
 * can stay a plain server component — exactly the real production `today/page.tsx`'s own shape
 * (server loader -> client `TodaySurface`), not a Gate-C-local pattern. This matters beyond
 * convention: a client page component computing fixture data directly evaluates it once during
 * the server's initial render pass and again, independently, a moment later during browser
 * hydration — a real React hydration mismatch this exact shape once produced (confirmed live on
 * `gate-c-w1-c03-league-prepare`, caught by the capture script's own console-error gate, before
 * this fix). A server component computes the fixture exactly once per request; this component
 * only ever receives the already-resolved, serializable result as props, the same way
 * `TodaySurface` already receives `AssistantCommandCentre.computedAt` (a `Date`) from the real
 * production server loader. P2-01 remediation additionally threads an explicit `nowIso` through
 * (see `shared/fixtures.ts`), so no part of this rendering depends on the real wall clock at all.
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
  /** P2-01 remediation: every Gate C scenario passes the shared fixed reference instant
   * (`GATE_C_NOW_ISO`, `shared/fixtures.ts`) explicitly, rather than relying on `TodaySurface`'s
   * own `new Date()` fallback. */
  nowIso: string;
}) {
  return (
    <OrgSlugProvider orgSlug={GATE_C_ORG_SLUG}>
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
        nowIso={props.nowIso}
      />
    </OrgSlugProvider>
  );
}
