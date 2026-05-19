import { db } from "@/lib/db";
import { SeasonOverviewClient } from "./season-client";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";

export const dynamic = "force-dynamic";

export default async function SeasonPage() {
  const planningPeriods = await db.planningPeriod.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const activePlanningPeriod = planningPeriods[0] ?? null;

  const planningPeriodIntent = activePlanningPeriod
    ? await db.coachingIntent.findFirst({
        where: { scopeType: "PLANNING_PERIOD", scopeId: activePlanningPeriod.id },
        select: { id: true, category: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      {activePlanningPeriod && (
        <CoachingIntentSelector
          scopeType="PLANNING_PERIOD"
          scopeId={activePlanningPeriod.id}
          currentIntent={planningPeriodIntent?.category ?? undefined}
          currentIntentId={planningPeriodIntent?.id ?? undefined}
          label="Planning period intent"
        />
      )}
      <SeasonOverviewClient
        planningPeriods={planningPeriods}
        activePlanningPeriodId={activePlanningPeriod?.id ?? null}
      />
    </div>
  );
}