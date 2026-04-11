import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { HistoryTable, type PlayerHistoryRow } from "@/components/history/history-table";
import { db } from "@/lib/db";
import { formatSelectionRole, isFloatingSelectionRole } from "@/lib/match-utils";

function formatPatternRole(roleType: SelectionRole): string {
  return formatSelectionRole(roleType);
}

function formatPatternDate(matchDate: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(matchDate);
}

export default async function HistoryPage() {
  const [players, finalizedSelectionPlayers] = await Promise.all([
    db.player.findMany({
      where: {
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          coreTeam: {
            name: "asc",
          },
        },
        { firstName: "asc" },
        { lastName: "asc" },
        { playerCode: "asc" },
      ],
    }),
    db.matchSelectionPlayer.findMany({
      where: {
        wasManuallyRemoved: false,
        selection: {
          status: SelectionStatus.FINALIZED,
        },
      },
      select: {
        playerId: true,
        roleType: true,
        selection: {
          select: {
            match: {
              select: {
                startsAt: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          selection: {
            match: {
              startsAt: "desc",
            },
          },
        },
      ],
    }),
  ]);

  const finalizedHistoryByPlayerId = new Map<
    string,
    {
      coreTeamAppearances: number;
      floatCount: number;
      lastFinalizedMatchDate: Date | null;
      recentSelectionPattern: string;
      totalFinalizedAppearances: number;
    }
  >();

  for (const selectionPlayer of finalizedSelectionPlayers) {
    const existingHistory = finalizedHistoryByPlayerId.get(selectionPlayer.playerId) ?? {
      coreTeamAppearances: 0,
      floatCount: 0,
      lastFinalizedMatchDate: null,
      recentSelectionPattern: "",
      totalFinalizedAppearances: 0,
    };

    const matchDate = selectionPlayer.selection.match.startsAt;
    const recentPatternParts = existingHistory.recentSelectionPattern
      ? existingHistory.recentSelectionPattern.split(" | ")
      : [];

    if (selectionPlayer.roleType === SelectionRole.CORE) {
      existingHistory.coreTeamAppearances += 1;
    }

    if (isFloatingSelectionRole(selectionPlayer.roleType)) {
      existingHistory.floatCount += 1;
    }

    existingHistory.totalFinalizedAppearances += 1;

    if (!existingHistory.lastFinalizedMatchDate) {
      existingHistory.lastFinalizedMatchDate = matchDate;
    }

    if (recentPatternParts.length < 5) {
      recentPatternParts.push(
        `${formatPatternDate(matchDate)} ${formatPatternRole(selectionPlayer.roleType)}`,
      );
      existingHistory.recentSelectionPattern = recentPatternParts.join(" | ");
    }

    finalizedHistoryByPlayerId.set(selectionPlayer.playerId, existingHistory);
  }

  const rows: PlayerHistoryRow[] = players.map((player) => {
    const history = finalizedHistoryByPlayerId.get(player.id);

    return {
      coreTeamAppearances: history?.coreTeamAppearances ?? 0,
      coreTeamName: player.coreTeam.name,
      firstName: player.firstName,
      floatCount: history?.floatCount ?? 0,
      lastFinalizedMatchDate: history?.lastFinalizedMatchDate ?? null,
      lastName: player.lastName,
      playerCode: player.playerCode,
      playerId: player.id,
      recentSelectionPattern: history?.recentSelectionPattern ?? "-",
      totalFinalizedAppearances: history?.totalFinalizedAppearances ?? 0,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Matchboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Inspect finalized player history to see how appearances, floating, and recent rotation
            are distributed across the squad.
          </p>
        </header>

        <HistoryTable rows={rows} />
      </div>
    </main>
  );
}
