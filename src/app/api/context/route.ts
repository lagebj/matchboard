import { getOperationalContext, searchEntities } from "@/lib/context/get-operational-context";
import { requireCoachAccess } from "@/lib/auth";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";

export async function GET(request: Request) {
  await requireCoachAccess();
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (query) {
    const results = await searchEntities(query);
    return Response.json(results);
  }

  const ctx = await getOperationalContext();
  const phaseDisplay = ctx.planningPeriod
    ? formatPhaseDisplay({
        seasonName: ctx.season?.name ?? "",
        phaseName: ctx.planningPeriod.name,
        startDate: ctx.planningPeriod.startDate,
        endDate: ctx.planningPeriod.endDate,
      })
    : null;

  return Response.json({
    season: ctx.season,
    planningPeriod: ctx.planningPeriod
      ? {
          id: ctx.planningPeriod.id,
          name: ctx.planningPeriod.name,
          phaseLabel: phaseDisplay?.phaseLabel ?? ctx.planningPeriod.name,
          seasonLabel: phaseDisplay?.seasonLabel ?? "",
          combinedLabel: phaseDisplay?.combinedLabel ?? ctx.planningPeriod.name,
          dateRangeLabel: phaseDisplay?.dateRangeLabel ?? "",
          startDate: ctx.planningPeriod.startDate.toISOString(),
          endDate: ctx.planningPeriod.endDate.toISOString(),
        }
      : null,
    matchRound: ctx.matchRound,
  });
}