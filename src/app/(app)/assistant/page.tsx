export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { AssistantInboxPage } from "@/components/assistant/assistant-inbox-page";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";

export default async function AssistantPage() {
  const planningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });

  const planningPeriodIntent = planningPeriod
    ? await db.coachingIntent.findFirst({
        where: { scopeType: "PLANNING_PERIOD", scopeId: planningPeriod.id },
        select: { id: true, category: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {planningPeriod && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            {planningPeriod.name}
          </p>
          <CoachingIntentSelector
            scopeType="PLANNING_PERIOD"
            scopeId={planningPeriod.id}
            currentIntent={planningPeriodIntent?.category ?? undefined}
            currentIntentId={planningPeriodIntent?.id ?? undefined}
            label="Period intent"
          />
        </div>
      )}
      <AssistantInboxPage />
    </div>
  );
}