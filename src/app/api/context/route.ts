import { getOperationalContext, searchEntities } from "@/lib/context/get-operational-context";
import { formatDate } from "@/lib/date-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (query) {
    const results = await searchEntities(query);
    return Response.json(results);
  }

  const ctx = await getOperationalContext();
  return Response.json({
    season: ctx.season,
    planningPeriod: ctx.planningPeriod
      ? {
          id: ctx.planningPeriod.id,
          name: ctx.planningPeriod.name,
          startDate: ctx.planningPeriod.startDate.toISOString(),
          endDate: ctx.planningPeriod.endDate.toISOString(),
          startDateLabel: formatDate(ctx.planningPeriod.startDate),
          endDateLabel: formatDate(ctx.planningPeriod.endDate),
        }
      : null,
    matchRound: ctx.matchRound,
  });
}