import { redirect } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveRetiredInsightDestination } from "@/lib/insights/retired-insight-redirects";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

/**
 * ADR-0157 slice C8: the standalone `/insights` hub is retired. Its 14 jobs were absorbed by
 * their contextual owners (`11_INSIGHTS_ROUTE_DISPOSITION.md`); Season Review's Overview is the
 * still-existing season-level analysis entry point for a bare hub visit.
 */
export const dynamic = "force-dynamic";

export default async function InsightsRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const sp = await searchParams;
  const first = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const destination = resolveRetiredInsightDestination(
    "overview",
    {
      leagueSeasonId: first("leagueSeasonId"),
      playerId: first("playerId"),
      teamId: first("teamId"),
      matchId: first("matchId"),
    },
    pageSearchParamsToUrlSearchParams(sp),
  );
  redirect(`/o/${orgSlug}${destination}`);
}