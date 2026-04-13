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
        explanation: true,
        playerId: true,
        roleType: true,
        sourceTeamNameSnapshot: true,
        targetTeamNameSnapshot: true,
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
      latestMovementDate: Date | null;
      latestMovementReason: string;
      latestMovementSummary: string;
      lastFinalizedMatchDate: Date | null;
      recentSelectionPattern: string;
      totalFinalizedAppearances: number;
    }
  >();

  for (const selectionPlayer of finalizedSelectionPlayers) {
    const existingHistory = finalizedHistoryByPlayerId.get(selectionPlayer.playerId) ?? {
      coreTeamAppearances: 0,
      floatCount: 0,
      latestMovementDate: null,
      latestMovementReason: "-",
      latestMovementSummary: "-",
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

      if (!existingHistory.latestMovementDate) {
        existingHistory.latestMovementDate = matchDate;
        existingHistory.latestMovementSummary = `${selectionPlayer.sourceTeamNameSnapshot} -> ${selectionPlayer.targetTeamNameSnapshot} · ${formatPatternRole(selectionPlayer.roleType)} · ${formatPatternDate(matchDate)}`;
        existingHistory.latestMovementReason =
          selectionPlayer.explanation?.trim() || "No saved explanation for the latest movement.";
      }
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
      latestMovementDate: history?.latestMovementDate ?? null,
      latestMovementReason: history?.latestMovementReason ?? "-",
      latestMovementSummary: history?.latestMovementSummary ?? "-",
      lastFinalizedMatchDate: history?.lastFinalizedMatchDate ?? null,
      lastName: player.lastName,
      playerCode: player.playerCode,
      playerId: player.id,
      recentSelectionPattern: history?.recentSelectionPattern ?? "-",
      totalFinalizedAppearances: history?.totalFinalizedAppearances ?? 0,
    };
  });

  const totalFinalizedAppearances = rows.reduce((sum, row) => sum + row.totalFinalizedAppearances, 0);
  const totalFloatAppearances = rows.reduce((sum, row) => sum + row.floatCount, 0);
  const recentMovers = rows.filter((row) => row.latestMovementDate !== null).length;
  const mostUsedPlayer = [...rows].sort(
    (left, right) => right.totalFinalizedAppearances - left.totalFinalizedAppearances,
  )[0] ?? null;
  const latestMovementPlayer = [...rows]
    .filter((row) => row.latestMovementDate !== null)
    .sort(
      (left, right) =>
        (right.latestMovementDate?.getTime() ?? 0) - (left.latestMovementDate?.getTime() ?? 0),
    )[0] ?? null;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Rotation History
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 7 workflow
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Read workload and floating patterns without digging through raw history.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                This board should make it easier to spot which players carry most of the finalized load,
                who has floated the most, and how recent patterns are distributed before you open an individual profile.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Players Tracked
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{rows.length}</p>
                <p className="mt-2 text-sm app-copy-soft">Players currently visible in the active registry history view.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Finalized Appearances
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalFinalizedAppearances}</p>
                <p className="mt-2 text-sm app-copy-soft">Total finalized appearances across all visible players.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Float Appearances
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalFloatAppearances}</p>
                <p className="mt-2 text-sm app-copy-soft">Finalized floating appearances currently present in history.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Recent Movers
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{recentMovers}</p>
                <p className="mt-2 text-sm app-copy-soft">Players with at least one visible finalized movement between teams.</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Rotation Focus
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">What to look for here</h2>
            </div>

            {latestMovementPlayer ? (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] app-copy-muted">Latest visible move</p>
                <p className="mt-2 text-lg font-semibold text-zinc-50">
                  {latestMovementPlayer.lastName
                    ? `${latestMovementPlayer.firstName} ${latestMovementPlayer.lastName}`
                    : latestMovementPlayer.firstName}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {latestMovementPlayer.latestMovementSummary}
                </p>
                <p className="mt-3 text-sm app-copy-soft">
                  {latestMovementPlayer.latestMovementReason}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-zinc-100">No finalized history yet.</p>
                <p className="mt-2 text-sm app-copy-soft">
                  History starts to matter once selections are finalized and written back into rotation tracking.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Recent pattern is the fast signal.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  You should be able to glance at the pattern column and see role sequence without opening a profile.
                </p>
              </div>
              {mostUsedPlayer ? (
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                  <p className="text-sm font-medium text-zinc-100">Highest current load: {mostUsedPlayer.lastName
                    ? `${mostUsedPlayer.firstName} ${mostUsedPlayer.lastName}`
                    : mostUsedPlayer.firstName}</p>
                  <p className="mt-1 text-sm app-copy-soft">
                    {mostUsedPlayer.totalFinalizedAppearances} finalized appearances and {mostUsedPlayer.floatCount} floating appearance(s).
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Floating deserves separate attention.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Core appearances and float appearances should stay visibly distinct on this page.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <HistoryTable rows={rows} />
      </section>
    </main>
  );
}
