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
import { TouchlinePageHeader } from "@/components/touchline";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricTile } from "@/components/ui/metric-tile";
import { ParticipationLoadWidget, RoleUsageWidget, MovementHistoryWidget } from "@/components/touchline/widgets";
import { buildHistoryViewModel, type HistoryPlayerRowInput, type HistoryMovementEntryInput } from "@/lib/touchline/presentation/history-view-model";
import { aggregateMovementPaths } from "@/lib/history/aggregate-movement-paths";

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
      include: {
        player: { include: { coreTeam: { select: { name: true } } } },
        match: { select: { startsAt: true, opponent: true, homeAway: true, team: { select: { name: true } } } },
        matchRound: { select: { name: true } },
      },
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
      supportCount: number;
      developmentCount: number;
      backfillCount: number;
      latestMovementDate: Date | null;
      latestMovementRoundName: string;
      latestMovementToTeamName: string;
      latestMovementRole: string;
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
        supportCount: 0,
        developmentCount: 0,
        backfillCount: 0,
        latestMovementDate: null,
        latestMovementRoundName: "",
        latestMovementToTeamName: "",
        latestMovementRole: "",
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
      } else if (selectionPlayer.role === SelectionRole.SUPPORT) {
        existingHistory.supportCount += 1;
      } else if (selectionPlayer.role === SelectionRole.DEVELOPMENT) {
        existingHistory.developmentCount += 1;
      } else if (selectionPlayer.role === SelectionRole.BACKFILL) {
        existingHistory.backfillCount += 1;
      }

      if (isFloatingSelectionRole(selectionPlayer.role)) {
        existingHistory.floatCount += 1;

        if (!existingHistory.latestMovementDate) {
          existingHistory.latestMovementDate = matchDate;
          existingHistory.latestMovementRoundName = selectionSnapshot.matchRound.name;
          existingHistory.latestMovementToTeamName = selectionSnapshot.match.team.name;
          existingHistory.latestMovementRole = formatPatternRole(selectionPlayer.role);
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
  const latestMovementRows = [...rows]
    .filter((row) => row.latestMovementDate !== null)
    .sort(
      (left, right) =>
        (right.latestMovementDate?.getTime() ?? 0) - (left.latestMovementDate?.getTime() ?? 0),
    )
    .slice(0, 6);

  // Touchline Design Atlas (ADR-0136 Phase 6, `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §C`):
  // reshape the same already-loaded per-player history into `buildHistoryViewModel()`'s input --
  // no new query, this route's existing all-time (not single-league-season) scope is unchanged.
  // `roundsPlayed`/`doubleLoadRounds`/`droppedRounds`/`unavailableRounds` are not tracked by this
  // page's own data source and are not read by `buildHistoryViewModel()`'s actual computation
  // (verified against its implementation) -- 0 is a safe, inert placeholder, not a displayed value.
  const historyPlayerRows: HistoryPlayerRowInput[] = players.map((player) => {
    const history = finalizedHistoryByPlayerId.get(player.id);
    return {
      playerId: player.id,
      playerName: player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName,
      coreTeamName: player.coreTeam?.name ?? "Unassigned",
      roundsPlayed: 0,
      totalSelections: history?.totalFinalizedAppearances ?? 0,
      coreMatches: history?.coreTeamAppearances ?? 0,
      supportMatches: history?.supportCount ?? 0,
      developmentMatches: history?.developmentCount ?? 0,
      backfillMatches: history?.backfillCount ?? 0,
      doubleLoadRounds: 0,
      droppedRounds: 0,
      unavailableRounds: 0,
    };
  });

  const movementPathEntries = finalizedSelectionSnapshots
    .filter((s) =>
      isSelectionMovementRow({
        role: s.role,
        sourceTeamName: s.player.coreTeam?.name ?? "",
        targetTeamName: s.match.team.name,
      }),
    )
    .map((s) => ({
      fromTeamName: s.player.coreTeam?.name ?? "Unassigned",
      toTeamName: s.match.team.name,
      role: s.role,
      playerId: s.playerId,
      occurredAt: s.createdAt,
    }));
  const movementPaths = aggregateMovementPaths(movementPathEntries);

  const recentMovements: HistoryMovementEntryInput[] = latestMovementRows.map((row) => {
    const history = finalizedHistoryByPlayerId.get(row.playerId);
    return {
      playerId: row.playerId,
      playerName: row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName,
      matchRoundName: history?.latestMovementRoundName ?? "",
      matchDate: row.latestMovementDate ? row.latestMovementDate.toISOString() : null,
      fromTeamName: row.coreTeamName,
      teamName: history?.latestMovementToTeamName ?? row.coreTeamName,
      role: history?.latestMovementRole ?? "",
      explanation: row.latestMovementReason,
    };
  });

  const historyViewModel = buildHistoryViewModel({
    players: historyPlayerRows,
    movementPaths,
    recentMovements,
    finalizedRoundCount: currentFinalizedMatches,
    draftRoundCount: currentDraftMatches,
  });
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
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8). Composition
    // reordered for the Touchline Design Atlas (ADR-0136 Phase 6,
    // `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §C`): summary strip -> participation/role
    // usage widgets -> movement history widget -> movement feed -> detailed table -> export
    // (moved to the end, was previously rendered second). "Review steps"/"How to read this page"
    // (documentation, not product hierarchy, per the spec) and "Load check" (a "most used
    // player" framing the same spec's widget contracts explicitly disallow for this surface —
    // `ParticipationLoadWidget`'s own doc comment: "never ranking language, no 'most'") are
    // removed rather than reflowed; the global Help affordance already covers the spec's "if
    // explanation is required, use a single Help/disclosure affordance" fallback.
    <main className="touchline flex min-h-full flex-col gap-6">
      <TouchlinePageHeader
        title="History"
        context="Finalised rounds, movement, and fairness over time."
      />

      <div className="grid grid-cols-2 gap-3 medium:grid-cols-4">
        <MetricTile label="Finalised appearances" value={totalFinalizedAppearances} description="Latest saved snapshot per match." />
        <MetricTile label="Floating appearances" value={totalFloatAppearances} description="Support, development, and floating usage." />
        <MetricTile label="Players with movement" value={recentMovers} description="Recorded movement in saved history." />
        <MetricTile label="Draft / finalised matches" value={`${currentDraftMatches} / ${currentFinalizedMatches}`} description="Current match state." />
      </div>

      <div className="grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-7">
          <ParticipationLoadWidget
            distribution={historyViewModel.appearanceDistribution.map((b) => ({ label: b.label, value: b.count }))}
            loadRange={historyViewModel.loadRange}
          />
        </div>
        <div className="expanded:col-span-5">
          <RoleUsageWidget
            counts={{
              core: historyViewModel.roleUsage.find((r) => r.label === "Core")?.value ?? 0,
              support: historyViewModel.roleUsage.find((r) => r.label === "Support")?.value ?? 0,
              development: historyViewModel.roleUsage.find((r) => r.label === "Development")?.value ?? 0,
              squadRepair: historyViewModel.roleUsage.find((r) => r.label === "Squad repair")?.value ?? 0,
            }}
          />
        </div>
        <div className="expanded:col-span-12">
          <MovementHistoryWidget
            strip={historyViewModel.movementPaths.map((p, i) => ({
              id: String(i),
              label: `${p.fromTeamName} → ${p.toTeamName}`,
              sublabel: `${formatSelectionRole(p.role as SelectionRole)} · ${p.count}`,
              tone: "accent" as const,
            }))}
            recentRows={historyViewModel.recentMovements.map((m, i) => ({
              id: String(i),
              playerName: m.playerName,
              fromTeamName: m.fromTeamName ?? "—",
              toTeamName: m.teamName,
              role: m.role,
              roundLabel: m.matchRoundName,
            }))}
          />
        </div>
      </div>

      <Surface variant="default" padding="lg">
        <SectionHeader title="Movement Feed" description="Latest visible move per player" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {latestMovementRows.length > 0 ? (
            latestMovementRows.map((row) => (
              <Surface key={row.playerId} variant="default" padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">{row.coreTeamName}</p>
                  </div>
                  <span className="rounded-full border border-[var(--warning)]/30 bg-[var(--warning-subtle)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
                    {row.latestMovementDate ? formatDate(row.latestMovementDate) : "No move"}
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--foreground)]">{row.latestMovementSummary}</p>
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

      <ExportPanel />
    </main>
  );
}