import {
  redirectRetiredInsightRoute,
  type RetiredInsightRedirectSearchParams,
} from "@/lib/insights/retired-insight-redirects";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

/** ADR-0157 slice C8: `/insights/position-exposure` is retired — redirects to its contextual owner
 * (`11_INSIGHTS_ROUTE_DISPOSITION.md`), preserving selected-entity query params. */
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const first = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const selected: RetiredInsightRedirectSearchParams = {
    leagueSeasonId: first("leagueSeasonId"),
    playerId: first("playerId"),
    teamId: first("teamId"),
    matchId: first("matchId"),
  };
  return redirectRetiredInsightRoute(orgSlug, "position-exposure", selected, pageSearchParamsToUrlSearchParams(sp));
}
