export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { AssistantInboxPage } from "@/components/assistant/assistant-inbox-page";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { COACHING_INTENT_LABELS } from "@/lib/coaching/types";

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

  const rounds = planningPeriod
    ? await db.matchRound.findMany({
        where: { planningPeriodId: planningPeriod.id, status: "NOT_GENERATED" },
        select: { id: true },
        take: 1,
      })
    : [];

  const hasUngeneratedRounds = rounds.length > 0;
  const showIntentPrompt = hasUngeneratedRounds && !planningPeriodIntent;

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
      {showIntentPrompt && (
        <div className="rounded-2xl border border-amber-700/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-200">Set coaching intent before generating squads</p>
          <p className="text-[11px] text-amber-300/70 mt-1">
            Ungenerated rounds exist but no period-level coaching intent is set. Setting intent helps align selections with your coaching priorities.
          </p>
        </div>
      )}
      <AssistantInboxPage />
    </div>
  );
}