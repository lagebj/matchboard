import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { MovementOverview, type MovementOverviewRow } from "@/components/history/movement-overview";
import { HistoryTable, type PlayerHistoryRow } from "@/components/history/history-table";
import { ExportPanel } from "@/components/history/export-panel";
import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { formatDate } from "@/lib/date-utils";
import { formatSelectionRole, isFloatingSelectionRole } from "@/lib/match-utils";
import {
  compareSelectionSnapshotRecency,
  getLatestSelectionSnapshots,
} from "@/lib/selection/get-latest-selection-snapshots";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { isSelectionMovementRow } from "@/lib/selection/get-selection-movement";
import { Surface } from "@/components/ui/surface";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

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

export default async function HistoryPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const [players, rawSelectionSnapshots] = await Promise.all([
    db.player.findMany({
      where: {
        removedAt: null,
        ...orgWhere,
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
      where: { status: SelectionStatus.FINALIZED, ...orgWhere },
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
  const playerCoreTeamNameById = new Map(players.map((player) => [player.id, player.coreTeam?.name ?? "Unassigned"]));

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
      coreTeamName: player.coreTeam?.name ?? "Unassigned",
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
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <Surface variant="raised" padding="lg">
          <PageHeader
            title="History"
            description="Finalised rounds, movement, and fairness over time."
            eyebrow="History"
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
            <div />
            <Surface variant="subtle" padding="md" className="mt-6 lg:mt-0">
              <SectionHeader title="Summary" />
              <div className="mt-4 grid gap-3">
                <Surface variant="default" padding="md">
                  <p className="text-sm font-medium text-zinc-100">{totalFinalizedAppearances} finalised appearance(s)</p>
                  <p className="text-sm text-[var(--text-soft)]">Latest saved snapshot per match.</p>
                </Surface>
                <Surface variant="default" padding="md">
                  <p className="text-sm font-medium text-zinc-100">{totalFloatAppearances} floating appearance(s)</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Support, development, and floating usage in saved history.</p>
                </Surface>
                <Surface variant="default" padding="md">
                  <p className="text-sm font-medium text-zinc-100">{recentMovers} player(s) with visible movement history</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Players with recorded movement in saved history.</p>
                </Surface>
                <Surface variant="default" padding="md">
                  <p className="text-sm font-medium text-zinc-100">{currentDraftMatches} draft match(es) · {currentFinalizedMatches} finalised match(es)</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Current match state: draft vs. finalised.</p>
                </Surface>
              </div>
            </Surface>
          </div>
        </Surface>

        <aside className="grid gap-4">
          <Surface variant="default" padding="md">
            <SectionHeader title="Load check" />
            {mostUsedPlayer ? (
              <Surface variant="default" padding="md" className="mt-4">
                <p className="text-sm font-semibold text-zinc-100">
                  {mostUsedPlayer.lastName
                    ? `${mostUsedPlayer.firstName} ${mostUsedPlayer.lastName}`
                    : mostUsedPlayer.firstName}
                </p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {mostUsedPlayer.totalFinalizedAppearances} finalised appearance(s) · {mostUsedPlayer.floatCount} floating appearance(s)
                </p>
                <p className="mt-3 text-sm text-[var(--text-soft)]">Use the table below for the deeper load check.</p>
              </Surface>
            ) : (
              <EmptyState
                title="No finalised history yet"
                description="Finalised match selections will appear here once rounds are locked."
                illustration="emptyStats"
                className="mt-4"
              />
            )}
          </Surface>
        </aside>
      </section>

      <ExportPanel />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Surface variant="default" padding="lg">
          <SectionHeader title="Review steps" description="Check the summary, review recent player movement, then open the table for detail." />
          <div className="mt-6 grid gap-3">
            <Surface variant="subtle" padding="md">
              <p className="text-sm font-semibold text-zinc-100">1. Check the summary</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                {currentDraftMatches} match(es) are currently draft and {currentFinalizedMatches} match(es) are currently finalised.
              </p>
            </Surface>
            <Surface variant="subtle" padding="md">
              <p className="text-sm font-semibold text-zinc-100">2. Review recent player movement</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                The movement feed below shows one latest visible move per player.
              </p>
            </Surface>
            <Surface variant="subtle" padding="md">
              <p className="text-sm font-semibold text-zinc-100">3. Open the table for detail</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Use the movement overview for per-player timelines and the table for workload or fairness checks.
              </p>
            </Surface>
          </div>
        </Surface>

        <Surface variant="default" padding="lg">
          <SectionHeader title="How to read this page" />
          <div className="mt-6 grid gap-3">
            {[
              "This page shows the latest saved snapshot per match. Superseded snapshots are collapsed away.",
              "Use recent pattern strings to see whether a player has a run of core or floating assignments.",
              "Use the full table for fairness, workload, or movement detail.",
            ].map((note) => (
              <Surface key={note} variant="subtle" padding="md">
                <p className="text-sm text-[var(--text-soft)]">{note}</p>
              </Surface>
            ))}
          </div>
        </Surface>
      </section>

      <Surface variant="default" padding="lg">
        <SectionHeader title="Movement Feed" description="Latest visible move per player" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {latestMovementRows.length > 0 ? (
            latestMovementRows.map((row) => (
              <Surface key={row.playerId} variant="default" padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{row.coreTeamName}</p>
                  </div>
                  <span className="rounded-full border border-[var(--warning)]/30 bg-[var(--warning-subtle)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
                    {row.latestMovementDate ? formatDate(row.latestMovementDate) : "No move"}
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-100">{row.latestMovementSummary}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{row.latestMovementReason}</p>
              </Surface>
            ))
          ) : (
            <EmptyState
              title="No visible movement yet"
              description="Support, development, or floating appearances will surface here once saved in the latest match state."
              illustration="emptyStats"
              className="lg:col-span-2"
            />
          )}
        </div>
      </Surface>

      <MovementOverview rows={sortedMovementOverviewRows} />

      <Surface variant="default" padding="lg">
        <HistoryTable rows={rows} />
      </Surface>
    </main>
  );
}