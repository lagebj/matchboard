import { db } from "@/lib/db";
import { SeasonOverviewClient } from "./season-client";

export const dynamic = "force-dynamic";

export default async function SeasonPage() {
  const planningPeriods = await db.planningPeriod.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const activePlanningPeriod = planningPeriods[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <SeasonOverviewClient
        planningPeriods={planningPeriods}
        activePlanningPeriodId={activePlanningPeriod?.id ?? null}
      />
    </div>
  );
}