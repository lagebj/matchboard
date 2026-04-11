import { notFound } from "next/navigation";
import { SelectionBuilder } from "@/components/selection/selection-builder";
import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";

type SelectionPageProps = {
  params: Promise<{
    matchId: string;
  }>;
  searchParams: Promise<{
    accepted?: string;
    error?: string;
    generated?: string;
    recalculated?: string;
    saved?: string;
  }>;
};

export default async function SelectionPage({
  params,
  searchParams,
}: SelectionPageProps) {
  const { matchId } = await params;
  const { accepted, error, generated, recalculated, saved } = await searchParams;

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

  const [players, teams, latestSelection, orderedMatchIds] = await Promise.all([
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
      select: {
        id: true,
      },
      orderBy: [
        { startsAt: "desc" },
        { createdAt: "desc" },
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
  const matchOrder = orderedMatchIds.map((entry) => entry.id);
  const currentMatchIndex = matchOrder.indexOf(match.id);
  const previousMatchId =
    currentMatchIndex >= 0 && currentMatchIndex < matchOrder.length - 1
      ? matchOrder[currentMatchIndex + 1]
      : null;
  const nextMatchId = currentMatchIndex > 0 ? matchOrder[currentMatchIndex - 1] : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
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
          savedMessage={saved === "draft" || saved === "final" ? saved : undefined}
          selectionAnalysis={selectionAnalysis}
        />
      </div>
    </main>
  );
}
