import { getOperationalContext, searchEntities } from "@/lib/context/get-operational-context";
import { requireActorContext } from "@/lib/auth/actor-context";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function GET(request: Request) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (query) {
    const results = await searchEntities(query, ctx.orgFilter);
    return Response.json(results);
  }

  const opCtx = await getOperationalContext(ctx.orgFilter);
  const phaseDisplay = opCtx.leagueSeason
    ? formatPhaseDisplay({
        seasonName: opCtx.season?.name ?? "",
        phaseName: opCtx.leagueSeason.name,
        startDate: opCtx.leagueSeason.startDate,
        endDate: opCtx.leagueSeason.endDate,
      })
    : null;

  return Response.json({
    season: opCtx.season,
    leagueSeason: opCtx.leagueSeason
      ? {
          id: opCtx.leagueSeason.id,
          name: opCtx.leagueSeason.name,
          leagueSeasonLabel: phaseDisplay?.leagueSeasonLabel ?? opCtx.leagueSeason.name,
          seasonLabel: phaseDisplay?.seasonLabel ?? "",
          combinedLabel: phaseDisplay?.combinedLabel ?? opCtx.leagueSeason.name,
          dateRangeLabel: phaseDisplay?.dateRangeLabel ?? "",
          startDate: opCtx.leagueSeason.startDate.toISOString(),
          endDate: opCtx.leagueSeason.endDate.toISOString(),
        }
      : null,
    matchRound: opCtx.matchRound,
  });
}