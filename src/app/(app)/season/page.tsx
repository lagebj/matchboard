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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Season</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Track load, movement, and fairness across the planning period.
        </p>
      </div>
      <SeasonOverviewClient
        planningPeriods={planningPeriods}
        activePlanningPeriodId={activePlanningPeriod?.id ?? null}
      />
    </div>
  );
}