import Link from "next/link";
import { notFound } from "next/navigation";
import { removePlayerAction, togglePlayerActiveAction, updatePlayerAction } from "@/app/players/actions";
import { PlayerEditorForm, PlayerSummaryCard } from "@/components/players/player-editor-form";
import {
  getOverallStarRating,
  getPlayerAttributeAverages,
  getPlayerPositionSummary,
} from "@/lib/player-metrics";
import { db } from "@/lib/db";

type PlayerPageProps = {
  params: Promise<{
    playerId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "updated") {
    return "Player updated.";
  }

  if (saved === "status") {
    return "Player status updated.";
  }

  return null;
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const [{ playerId }, { error, saved }] = await Promise.all([params, searchParams]);

  const [player, teams, orderedPlayerIds] = await Promise.all([
    db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            id: true,
            name: true,
          },
        },
        allowedFloatTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            team: {
              name: "asc",
            },
          },
        },
      },
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
    db.player.findMany({
      where: {
        removedAt: null,
      },
      select: {
        id: true,
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
  ]);

  if (!player) {
    notFound();
  }

  const averages = getPlayerAttributeAverages(player);
  const overallStars = getOverallStarRating(averages.overall);
  const orderedIds = orderedPlayerIds.map((entry) => entry.id);
  const currentPlayerIndex = orderedIds.indexOf(player.id);
  const nextPlayerId =
    currentPlayerIndex >= 0 && currentPlayerIndex < orderedIds.length - 1
      ? orderedIds[currentPlayerIndex + 1]
      : null;
  const saveAction = updatePlayerAction.bind(null, player.id);
  const toggleAction = togglePlayerActiveAction.bind(null, player.id);
  const removeAction = removePlayerAction.bind(null, player.id);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Matchboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Player Detail</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Review the full player profile, attributes, floating permissions, and update the
              record from one page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {nextPlayerId ? (
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
                href={`/players/${nextPlayerId}`}
              >
                Next player
              </Link>
            ) : null}
            <Link
              className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
              href="/players"
            >
              Back to players
            </Link>
          </div>
        </header>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {formatSavedMessage(saved) ? (
          <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            {formatSavedMessage(saved)}
          </div>
        ) : null}

        <PlayerSummaryCard player={player} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Technical</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{averages.technical}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Tactical</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{averages.tactical}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Mental</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{averages.mental}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Physical</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{averages.physical}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Overall</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{averages.overall}</p>
            <p className="mt-2 text-sm text-amber-600" aria-label={`${overallStars} star overall rating`}>
              {"★".repeat(overallStars)}
              <span className="text-zinc-300">{"★".repeat(5 - overallStars)}</span>
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Backend Code</p>
            <p className="mt-1 text-sm text-zinc-900">{player.playerCode}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Registry Status</p>
            <p className="mt-1 text-sm text-zinc-900">{player.active ? "Active" : "Inactive"}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Positions</p>
            <p className="mt-1 text-sm text-zinc-900">{getPlayerPositionSummary(player)}</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Core-Match Drop</p>
            <p className="mt-1 text-sm text-zinc-900">
              {player.canDropCoreMatch ? "Allowed" : "Not allowed"}
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <form action={toggleAction}>
            <button
              className="h-10 rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
              type="submit"
            >
              {player.active ? "Set inactive" : "Set active"}
            </button>
          </form>
          <form action={removeAction}>
            <button
              className="h-10 rounded border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
              type="submit"
            >
              Remove player
            </button>
          </form>
        </section>

        <section className="border border-zinc-200 bg-white p-5">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Edit Player</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Update the player profile, positions, availability, floating permissions, and
              attribute ratings.
            </p>
          </div>

          <PlayerEditorForm
            action={saveAction}
            cancelHref="/players"
            player={player}
            submitLabel="Save changes"
            teams={teams}
          />
        </section>
      </div>
    </main>
  );
}
