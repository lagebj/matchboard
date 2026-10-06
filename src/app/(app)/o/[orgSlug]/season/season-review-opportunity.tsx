import { OpportunityMatrixClient } from "@/app/(app)/insights/opportunity/opportunity-matrix-client";
import { OpportunityQualityClient } from "@/app/(app)/insights/opportunity-quality/opportunity-quality-client";
import { OpportunityGapClient } from "@/app/(app)/insights/opportunity-gap/opportunity-gap-client";
import { LoadTimelineClient } from "@/app/(app)/insights/load/load-timeline-client";

/**
 * Season Review's Opportunity tab (ADR-0157 slice C7, `09_SEASON_REVIEW.md` "Opportunity tab").
 * Absorbs the current `/insights` opportunity-family jobs (`11_INSIGHTS_ROUTE_DISPOSITION.md`:
 * Opportunity, Opportunity quality, Opportunity gap, Load) by rendering their existing, already
 * self-contained client components directly with the same props their own `/insights/*` pages
 * already pass — not a re-derivation, real parity. Each component keeps its own honest
 * unavailable/no-show/unknown semantics and "no debt score" discipline unchanged; this slice
 * does not touch their internals.
 *
 * `/insights/opportunity`, `/insights/opportunity-quality`, `/insights/opportunity-gap`, and
 * `/insights/load` remain fully operational routes — retiring them is explicitly C8's job, gated
 * on this contextual destination actually existing first.
 */

type LeagueSeasonOption = { id: string; name: string; startDate: string; endDate: string };
type TeamOption = { id: string; name: string };

export function SeasonReviewOpportunity({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: TeamOption[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <OpportunityMatrixClient leagueSeasons={leagueSeasons} activeLeagueSeasonId={activeLeagueSeasonId} teams={teams} />
      <OpportunityQualityClient leagueSeasons={leagueSeasons} activeLeagueSeasonId={activeLeagueSeasonId} />
      <OpportunityGapClient leagueSeasons={leagueSeasons} activeLeagueSeasonId={activeLeagueSeasonId} />
      <LoadTimelineClient leagueSeasons={leagueSeasons} activeLeagueSeasonId={activeLeagueSeasonId} teams={teams} />
    </div>
  );
}
