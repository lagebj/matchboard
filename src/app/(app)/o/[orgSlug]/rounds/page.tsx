export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { RoundListClient } from "@/app/(app)/rounds/round-list-client";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";

type RoundItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: RoundStatus;
};

export default async function RoundsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireActorContext(orgSlug);
  const orgWhere = ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {};

  const activeLeagueSeason = await db.leagueSeason.findFirst({
    where: orgWhere,
    orderBy: { startDate: "desc" },
  });

  const matchRounds = await db.matchRound.findMany({
    where: orgWhere,
    include: {
      matches: {
        select: {
          id: true,
          opponent: true,
          startsAt: true,
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
      },
      selections: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const roundItems: RoundItem[] = await Promise.all(matchRounds.map(async (round) => {
    const integrity = await computeRoundPlanIntegrity(round.id);
    const blockedCount = integrity.summary.blockerCount + integrity.summary.decisionRequiredCount;
    const hasDraftSelections = round.selections.length > 0;
    const hasMatches = round.matches.length > 0;

    return {
      id: round.id,
      name: round.name,
      weekLabel: round.matches.length > 0
        ? formatIsoWeekLabel(round.matches[0]!.startsAt)
        : round.name,
      matchCount: round.matches.length,
      teamNames: [...new Set(round.matches.map((m) => m.team.name))],
      derivedStatus: deriveRoundStatus({ dbStatus: round.status, hasDraftSelections, hasMatches, blockedSignalCount: blockedCount }),
    };
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Rounds · {roundItems.length}</p>
      </div>

      <RoundListClient
        rounds={roundItems}
        activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
        hasDraftRounds={roundItems.some((r) => r.derivedStatus === "DRAFT" || r.derivedStatus === "BLOCKED" || r.derivedStatus === "READY")}
        hasNotGeneratedRounds={roundItems.some((r) => r.derivedStatus === "NOT_GENERATED")}
        roundCount={roundItems.length}
      />
    </div>
  );
}