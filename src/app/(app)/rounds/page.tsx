export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { RoundListClient } from "./round-list-client";
import { signalCategoryFromSeverity } from "@/lib/selection/signal-category";
import { type WarningSeverity } from "@/generated/prisma/client";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";

type RoundItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: RoundStatus;
};

export default async function RoundsPage() {
  const activeLeagueSeason = await db.leagueSeason.findFirst({
    orderBy: { startDate: "desc" },
  });

  const matchRounds = await db.matchRound.findMany({
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
      warnings: {
        where: { resolved: false },
        select: { severity: true, rule: true },
      },
      selections: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const roundItems: RoundItem[] = matchRounds.map((round) => {
    const blockedCount = round.warnings.filter((w) => signalCategoryFromSeverity(w.severity as WarningSeverity) === "BLOCKED").length;
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
  });

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