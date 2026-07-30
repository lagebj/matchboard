import { getOperationalContext, searchEntities } from "@/lib/context/get-operational-context";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";

export async function GET(request: Request) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (query) {
    const results = await searchEntities(query, orgFilter);
    return Response.json(results);
  }

  const ctx = await getOperationalContext(orgFilter);
  const phaseDisplay = ctx.leagueSeason
    ? formatPhaseDisplay({
        seasonName: ctx.season?.name ?? "",
        phaseName: ctx.leagueSeason.name,
        startDate: ctx.leagueSeason.startDate,
        endDate: ctx.leagueSeason.endDate,
      })
    : null;

  return Response.json({
    season: ctx.season,
    leagueSeason: ctx.leagueSeason
      ? {
          id: ctx.leagueSeason.id,
          name: ctx.leagueSeason.name,
          leagueSeasonLabel: phaseDisplay?.leagueSeasonLabel ?? ctx.leagueSeason.name,
          seasonLabel: phaseDisplay?.seasonLabel ?? "",
          combinedLabel: phaseDisplay?.combinedLabel ?? ctx.leagueSeason.name,
          dateRangeLabel: phaseDisplay?.dateRangeLabel ?? "",
          startDate: ctx.leagueSeason.startDate.toISOString(),
          endDate: ctx.leagueSeason.endDate.toISOString(),
        }
      : null,
    matchRound: ctx.matchRound,
  });
}