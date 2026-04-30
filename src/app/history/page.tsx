import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { MovementOverview, type MovementOverviewRow } from "@/components/history/movement-overview";
import { HistoryTable, type PlayerHistoryRow } from "@/components/history/history-table";
import { ExportPanel } from "@/components/history/export-panel";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";
import { formatSelectionRole, isFloatingSelectionRole } from "@/lib/match-utils";
import {
  compareSelectionSnapshotRecency,
  getLatestSelectionSnapshots,
} from "@/lib/selection/get-latest-selection-snapshots";
import { isSelectionMovementRow } from "@/lib/selection/get-selection-movement";

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
  const [players, rawSelectionSnapshots] = await Promise.all([
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
    db.selection.findMany({
      where: { status: SelectionStatus.FINALIZED },
      include: { player: { include: { coreTeam: { select: { name: true } } } }, match: { select: { startsAt: true, opponent: true, homeAway: true, team: { select: { name: true } } } } },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);
    const selectionSnapshots = rawSelectionSnapshots.map((s) => ({
      ...s,
      finalizedAt: null as Date | null,
    }));
    const latestSelectionSnapshots = getLatestSelectionSnapshots(selectionSnapshots);
  const finalizedSelectionSnapshots = latestSelectionSnapshots
    .filter((snapshot) => snapshot.status === SelectionStatus.FINALIZED)
    .sort(compareSelectionSnapshotRecency);

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
  const playerCoreTeamNameById = new Map(players.map((player) => [player.id, player.coreTeam.name]));

    for (const selectionSnapshot of finalizedSelectionSnapshots) {
      const selectionPlayer = selectionSnapshot;
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

      const matchDate = selectionSnapshot.match.startsAt;
      const recentPatternParts = existingHistory.recentSelectionPattern
        ? existingHistory.recentSelectionPattern.split(" | ")
        : [];

      if (selectionPlayer.role === SelectionRole.CORE) {
        existingHistory.coreTeamAppearances += 1;
      }

      if (isFloatingSelectionRole(selectionPlayer.role)) {
        existingHistory.floatCount += 1;

        if (!existingHistory.latestMovementDate) {
          existingHistory.latestMovementDate = matchDate;
          existingHistory.latestMovementSummary = `${selectionPlayer.player.coreTeam?.name ?? ""} -> ${selectionSnapshot.match.team.name} · ${formatPatternRole(selectionPlayer.role)} · ${formatPatternDate(matchDate)}`;
          existingHistory.latestMovementReason = "No saved explanation for the latest movement.";
        }
      }

      existingHistory.totalFinalizedAppearances += 1;

      if (!existingHistory.lastFinalizedMatchDate) {
        existingHistory.lastFinalizedMatchDate = matchDate;
      }

      if (recentPatternParts.length < 5) {
        recentPatternParts.push(`${formatPatternDate(matchDate)} ${formatPatternRole(selectionPlayer.role)}`);
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
  const currentDraftMatches = latestSelectionSnapshots.filter(
    (snapshot) => snapshot.status === SelectionStatus.DRAFT,
  ).length;
  const currentFinalizedMatches = finalizedSelectionSnapshots.length;
  const mostUsedPlayer = [...rows].sort(
    (left, right) => right.totalFinalizedAppearances - left.totalFinalizedAppearances,
  )[0] ?? null;
  const latestMovementRows = [...rows]
    .filter((row) => row.latestMovementDate !== null)
    .sort(
      (left, right) =>
        (right.latestMovementDate?.getTime() ?? 0) - (left.latestMovementDate?.getTime() ?? 0),
    )
    .slice(0, 6);
    const movementOverviewByPlayerId = latestSelectionSnapshots.reduce<Map<string, MovementOverviewRow>>(
          (movementByPlayerId, selectionSnapshot) => {
            const selectionPlayer = selectionSnapshot;
            if (
              !isSelectionMovementRow({
                role: selectionPlayer.role,
                sourceTeamName: selectionPlayer.player.coreTeam?.name ?? "",
                targetTeamName: selectionSnapshot.match.team.name,
              })
            ) {
              return movementByPlayerId;
            }

            const playerName = selectionPlayer.player.lastName
              ? `${selectionPlayer.player.firstName} ${selectionPlayer.player.lastName}`
              : selectionPlayer.player.firstName;
            const existingRow = movementByPlayerId.get(selectionPlayer.player.id) ?? {
              coreTeamName:
                playerCoreTeamNameById.get(selectionPlayer.player.id) ??
                selectionPlayer.player.coreTeam?.name ??
                "",
              draftMovementCount: 0,
              finalizedMovementCount: 0,
              movementCount: 0,
              movements: [],
              playerId: selectionPlayer.player.id,
              playerName,
            };

            existingRow.movementCount += 1;

            if (selectionSnapshot.status === SelectionStatus.FINALIZED) {
              existingRow.finalizedMovementCount += 1;
            } else {
              existingRow.draftMovementCount += 1;
            }

            existingRow.movements.push({
              explanation:
                "No saved explanation for this movement.",
              key: `${selectionSnapshot.id}:${selectionPlayer.player.id}:${selectionPlayer.role}:${selectionPlayer.player.coreTeam?.name ?? ""}:${selectionSnapshot.match.team.name}`,
              matchId: selectionSnapshot.matchId,
              matchLabel: `${selectionSnapshot.match.team.name} vs. ${selectionSnapshot.match.opponent}`,
              roleType: selectionPlayer.role,
              sourceTeamName: selectionPlayer.player.coreTeam?.name ?? "",
              startsAt: selectionSnapshot.match.startsAt,
              status: selectionSnapshot.status,
              targetTeamName: selectionSnapshot.match.team.name,
            });

            movementByPlayerId.set(selectionPlayer.player.id, existingRow);
            return movementByPlayerId;
          },
          new Map<string, MovementOverviewRow>(),
        );

  const sortedMovementOverviewRows = [...movementOverviewByPlayerId.values()]
    .map((row) => ({
      ...row,
      movements: [...row.movements].sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime()),
    }))
    .sort((left, right) => {
      if (left.movementCount !== right.movementCount) {
        return right.movementCount - left.movementCount;
      }

      return left.playerName.localeCompare(right.playerName);
    });

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                History
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Finalized rounds, movement, and fairness over time.
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  History
                </h1>
                <p className="mt-4 max-w-2xl text-sm app-copy-soft sm:text-base">
                  Finalized rounds, movement, and fairness over time.
                </p>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Summary
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{totalFinalizedAppearances} finalized appearance(s)</p>
                    <p className="text-sm app-copy-soft">
                      Latest saved snapshot per match.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{totalFloatAppearances} floating appearance(s)</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Support, development, and floating usage in saved history.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{recentMovers} player(s) with visible movement history</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Players with recorded movement in saved history.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{currentDraftMatches} draft match(es) · {currentFinalizedMatches} finalized match(es)</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Current match state: draft vs. finalized.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Load check
            </p>
            {mostUsedPlayer ? (
              <div className="mt-4 rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-semibold text-zinc-100">
                  {mostUsedPlayer.lastName
                    ? `${mostUsedPlayer.firstName} ${mostUsedPlayer.lastName}`
                    : mostUsedPlayer.firstName}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {mostUsedPlayer.totalFinalizedAppearances} finalized appearance(s) · {mostUsedPlayer.floatCount} floating appearance(s)
                </p>
                <p className="mt-3 text-sm app-copy-soft">Use the table below for the deeper load check.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm leading-6 app-copy-soft">
                No finalized history yet.
              </div>
            )}
          </section>
        </aside>
      </section>

      <ExportPanel />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Review steps
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">How to review finalized rounds</h2>
            <p className="mt-2 text-sm app-copy-soft">
              Check the summary, review recent player movement, then open the table for detail.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
              <p className="text-sm font-semibold text-zinc-100">1. Check the summary</p>
              <p className="mt-2 text-sm app-copy-soft">
                {currentDraftMatches} match(es) are currently draft and {currentFinalizedMatches} match(es) are currently finalized.
              </p>
            </div>
            <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
              <p className="text-sm font-semibold text-zinc-100">2. Review recent player movement</p>
              <p className="mt-2 text-sm app-copy-soft">
                The movement feed below shows one latest visible move per player.
              </p>
            </div>
            <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
              <p className="text-sm font-semibold text-zinc-100">3. Open the table for detail</p>
              <p className="mt-2 text-sm app-copy-soft">
                Use the movement overview for per-player timelines and the table for workload or fairness checks.
              </p>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Reading tips
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">How to read this page</h2>
          <div className="mt-6 grid gap-3">
            {[
              "This page shows the latest saved snapshot per match. Superseded snapshots are collapsed away.",
              "Use recent pattern strings to see whether a player has a run of core or floating assignments.",
              "Use the full table for fairness, workload, or movement detail.",
            ].map((note) => (
              <div
                key={note}
                className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm leading-6 app-copy-soft"
              >
                {note}
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Movement Feed
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Latest visible move per player</h2>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {latestMovementRows.length > 0 ? (
            latestMovementRows.map((row) => (
              <div
                key={row.playerId}
                className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">{row.coreTeamName}</p>
                  </div>
                  <span className="rounded-full border border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
                    {row.latestMovementDate ? formatDate(row.latestMovementDate) : "No move"}
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-100">{row.latestMovementSummary}</p>
                <p className="mt-2 text-sm leading-6 app-copy-soft">{row.latestMovementReason}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft lg:col-span-2">
              No visible movement feed yet. Once support, development, or floating appearances are
              saved in the latest match state, they surface here as reviewable cards.
            </div>
          )}
        </div>
      </section>

      <MovementOverview rows={sortedMovementOverviewRows} />

      <section className="app-panel rounded-[1.75rem] p-6">
        <HistoryTable rows={rows} />
      </section>
    </main>
  );
}
