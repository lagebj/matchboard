/**
 * Today context rail (ADR-0142 `02_PRODUCTION_COMPOSITION_CONTRACT.md` "Context-rail ordering").
 * Fixed order — Since your last visit, Squad today, Carry forward, Recent football — rendering
 * only sections with content. Low-priority context, never a second unrelated dashboard.
 */

import { TodaySinceLastVisit } from "@/components/touchline/today/today-since-last-visit";
import { TodayCarryForwardWidget } from "@/components/touchline/today/today-carry-forward";
import { SquadReadinessWidget, RecentFootballWidget } from "@/components/touchline/widgets";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TodayVisitCurrentFacts } from "@/lib/touchline/presentation/today-visit-snapshot";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import type { MatchPresentation } from "@/lib/matches/match-presentation";

export function TodayContextRail({
  sinceLastVisitScope,
  sinceLastVisitFacts,
  squadStatus,
  squadStatusTitle,
  carryForwardItems,
  recentMatches,
}: {
  sinceLastVisitScope?: string;
  sinceLastVisitFacts?: TodayVisitCurrentFacts;
  squadStatus?: TodaySquadStatus | null;
  /** P1-04: an optional scope label (the widget's own existing `title` override, not a new
   * widget) — the caller sets this when a same-day Matchday card already shows match-specific
   * readiness above, so this organisation-wide count isn't misread as the same fact restated. */
  squadStatusTitle?: string;
  carryForwardItems: TodayCarryForwardItem[];
  recentMatches?: MatchPresentation[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {sinceLastVisitScope && sinceLastVisitFacts && (
        <TodaySinceLastVisit scope={sinceLastVisitScope} facts={sinceLastVisitFacts} />
      )}
      {squadStatus && (
        <SquadReadinessWidget
          title={squadStatusTitle}
          available={squadStatus.available}
          doubtful={squadStatus.doubtful}
          unavailable={squadStatus.unavailable}
          exceptions={[]}
        />
      )}
      <TodayCarryForwardWidget items={carryForwardItems} />
      {recentMatches && recentMatches.length > 0 && <RecentFootballWidget matches={recentMatches} />}
    </div>
  );
}
