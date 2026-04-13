import { notFound } from "next/navigation";
import { SelectionBuilder } from "@/components/selection/selection-builder";
import { db } from "@/lib/db";
import { isInSameWeek } from "@/lib/date-utils";
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
      targetTeam: {
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

  const [players, teams, latestSelection, orderedMatches, selectionSnapshots] = await Promise.all([
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
      },
      include: {
        allowedFloatTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
    db.matchSelection.findFirst({
      where: {
        matchId: match.id,
      },
      include: {
        players: {
          include: {
            player: {
              include: {
                coreTeam: {
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
      orderBy: [
        { createdAt: "desc" },
        { finalizedAt: "desc" },
      ],
    }),
    db.match.findMany({
      include: {
        targetTeam: {
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
    db.matchSelection.findMany({
      include: {
        players: {
          where: {
            wasManuallyRemoved: false,
          },
          select: {
            playerId: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { finalizedAt: "desc" },
      ],
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
      targetTeam: registeredMatch.targetTeam,
    }));
  const selectedPlayerIdsByMatchId = new Map<string, string[]>(
    [...latestSelectionSnapshotByMatchId.entries()].map(([savedMatchId, selectionSnapshot]) => [
      savedMatchId,
      selectionSnapshot.players.map((player) => player.playerId),
    ]),
  );

  if (!latestSelection && generatedSelection) {
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
      targetTeam: sameWeekMatch.targetTeam,
    })),
    selectedPlayerIdsByMatchId,
  );
  const isWeekFullyFinalized =
    sameWeekMatches.length > 0 &&
    sameWeekMatches.every((sameWeekMatch) => sameWeekMatch.latestSelectionStatus === "FINALIZED");

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <div className="flex flex-col gap-8">
        <SelectionBuilder
          acceptedGenerated={accepted === "generated"}
          errorMessage={generatedErrorMessage}
          generatedSelection={generatedSelection}
          groupedPlayers={groupedPlayers}
          latestSelection={latestSelection}
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
