import { notFound } from "next/navigation";
import { SelectionBuilder } from "@/components/selection/selection-builder";
import { LockToggleForm } from "@/components/matchday/lock-toggle-form";
import { db } from "@/lib/db";
import { isInSameWeek } from "@/lib/date-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import { generateSelection } from "@/lib/selection/generate-selection";
import { getLatestSelectionSnapshotByMatchId } from "@/lib/selection/get-latest-selection-snapshots";
import { getWeeklyPlayerCoverage } from "@/lib/selection/get-weekly-player-coverage";

type SelectionPageProps = {
  params: Promise<{
    matchId: string;
  }>;
  searchParams: Promise<{
    accepted?: string;
    error?: string;
    generated?: string;
    recalculated?: string;
    reset?: string;
    resetCount?: string;
    saved?: string;
  }>;
};

function formatResetMessage(reset?: string, resetCount?: string): string | undefined {
  if (!reset) {
    return undefined;
  }

  if (reset === "match") {
    return "Saved selections cleared for this match. The workspace is back to an empty restart.";
  }

  if (reset === "week") {
    return `Saved selections cleared for this week${resetCount ? ` (${resetCount} snapshot${resetCount === "1" ? "" : "s"} removed).` : "."}`;
  }

  return `Saved selections cleared across the queue${resetCount ? ` (${resetCount} snapshot${resetCount === "1" ? "" : "s"} removed).` : "."}`;
}

export default async function SelectionPage({
  params,
  searchParams,
}: SelectionPageProps) {
  const { matchId } = await params;
  const { accepted, error, generated, recalculated, reset, resetCount, saved } = await searchParams;

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      team: {
        select: {
          developmentTargetRelationships: {
            include: {
              sourceTeam: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          developmentSlots: true,
          id: true,
          minSupportPlayers: true,
          name: true,
          supportTargetRelationships: {
            include: {
              sourceTeam: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!match) {
    notFound();
  }

  const shouldShowGeneratedSelection = generated === "1";

  const [players, teams, latestSelections, orderedMatches, allSelections, playerLocks] = await Promise.all([
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            id: true,
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
    db.team.findMany({
      where: {
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.selection.findMany({
      where: { matchId: match.id },
      include: { player: { include: { coreTeam: { select: { id: true, name: true } } } } },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.match.findMany({
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { startsAt: "desc" },
        { createdAt: "desc" },
      ],
    }),
    db.selection.findMany({
      include: { player: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.playerLock.findMany({
      where: {
        matchRoundId: match.matchRoundId,
      },
      include: {
        player: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  let selectionAnalysis = null;
  let generatedSelection = null;
  let generatedErrorMessage = error;

  try {
    selectionAnalysis = await generateSelection(match.id);

    if (shouldShowGeneratedSelection) {
      generatedSelection = selectionAnalysis;
    }
  } catch (generationError) {
    if (shouldShowGeneratedSelection) {
      generatedErrorMessage =
        generationError instanceof Error
          ? generationError.message
          : "Could not generate a suggested squad for this match.";
    }
  }

  const groupedPlayers = teams.map((team) => ({
    team,
    players: players.filter((player) => player.coreTeamId === team.id),
  }));

  const selectionSnapshots = allSelections.map((s) => ({
    createdAt: s.createdAt,
    id: s.id,
    matchId: s.matchId,
    status: s.status,
    updatedAt: s.updatedAt,
  }));
  const latestSelectionSnapshotByMatchId = getLatestSelectionSnapshotByMatchId(selectionSnapshots);

  const matchOrder = orderedMatches.map((entry) => entry.id);
  const currentMatchIndex = matchOrder.indexOf(match.id);
  const previousMatchId =
    currentMatchIndex >= 0 && currentMatchIndex < matchOrder.length - 1
      ? matchOrder[currentMatchIndex + 1]
      : null;
  const nextMatchId = currentMatchIndex > 0 ? matchOrder[currentMatchIndex - 1] : null;
  const sameWeekMatches = orderedMatches
    .filter((registeredMatch) => isInSameWeek(match.startsAt, registeredMatch.startsAt))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    .map((registeredMatch) => ({
      id: registeredMatch.id,
      latestSelectionStatus:
        latestSelectionSnapshotByMatchId.get(registeredMatch.id)?.status ?? null,
      opponent: registeredMatch.opponent,
      startsAt: registeredMatch.startsAt,
      team: registeredMatch.team,
    }));

  const matchSelectionsByMatchId = new Map<string, typeof allSelections>();
  for (const selection of allSelections) {
    const existing = matchSelectionsByMatchId.get(selection.matchId) ?? [];
    existing.push(selection);
    matchSelectionsByMatchId.set(selection.matchId, existing);
  }

  const selectedPlayerIdsByMatchId = new Map<string, string[]>(
    [...matchSelectionsByMatchId.entries()].map(([savedMatchId, matchSels]) => {
      const explanationRows = matchSels.filter((s) => {
        const e = (s.explanation ?? {}) as Record<string, unknown>;
        return e.manuallyRemoved !== true;
      });
      return [
        savedMatchId,
        [...new Set(explanationRows.map((s) => s.playerId))],
      ];
    }),
  );

  if (latestSelections.length === 0 && generatedSelection) {
    selectedPlayerIdsByMatchId.set(
      match.id,
      generatedSelection.selectedPlayers.map((player) => player.playerId),
    );
  }

  const weeklyCoverage = getWeeklyPlayerCoverage(
    players,
    sameWeekMatches.map((sameWeekMatch) => ({
      id: sameWeekMatch.id,
      opponent: sameWeekMatch.opponent,
      team: sameWeekMatch.team,
    })),
    selectedPlayerIdsByMatchId,
  );
  const isWeekFullyFinalized =
    sameWeekMatches.length > 0 &&
    sameWeekMatches.every((sameWeekMatch) => sameWeekMatch.latestSelectionStatus === "FINALIZED");

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <div className="flex flex-col gap-8">
        {playerLocks.length > 0 && (
          <section className="app-panel rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Player Locks
            </p>
            <p className="mt-1 text-sm app-copy-soft">
              Locked players affect the generated suggestion. Locked-out players are excluded. Locked-in players are always included.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {playerLocks.map((lock) => (
                <div key={lock.id} className="flex items-center justify-between gap-3 rounded-xl border app-hairline bg-[rgba(0,0,0,0.12)] px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[rgba(140,167,146,0.2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                      {lock.lockType === "LOCKED_IN" ? "Locked in" : "Locked out"}
                    </span>
                    <span className="text-sm font-medium text-zinc-100">
                      {lock.player.firstName}{lock.player.lastName ? ` ${lock.player.lastName}` : ""}
                    </span>
                    {lock.reason && (
                      <span className="text-xs app-copy-soft">&mdash; {lock.reason}</span>
                    )}
                  </div>
                  <LockToggleForm
                    lockId={lock.id}
                    matchRoundId={match.matchRoundId}
                    playerId={lock.playerId}
                    currentLockType={lock.lockType as "LOCKED_IN" | "LOCKED_OUT"}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        <SelectionBuilder
          acceptedGenerated={accepted === "generated"}
          errorMessage={generatedErrorMessage}
          generatedSelection={generatedSelection}
          groupedPlayers={groupedPlayers}
          latestSelections={latestSelections}
          match={match}
          nextMatchId={nextMatchId}
          previousMatchId={previousMatchId}
          recalculated={recalculated === "1"}
          resetMessage={formatResetMessage(reset, resetCount)}
          savedMessage={saved === "draft" || saved === "final" ? saved : undefined}
          sameWeekMatches={sameWeekMatches}
          selectionAnalysis={selectionAnalysis}
          isWeekFullyFinalized={isWeekFullyFinalized}
          weeklyCoverage={weeklyCoverage}
        />
      </div>
    </main>
  );
}