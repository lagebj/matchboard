import Link from "next/link";
import { removePlayerAction } from "@/app/players/actions";
import { PlayerCreateLayover } from "@/components/players/player-create-layover";
import { PlayerTable } from "@/components/players/player-table";
import { db } from "@/lib/db";

type PlayersPageProps = {
  searchParams: Promise<{
    create?: string;
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "created") {
    return "Player created.";
  }

  if (saved === "removed") {
    return "Player removed from the active registry.";
  }

  return null;
}

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const { create, error, saved } = await searchParams;

  const [players, teams] = await Promise.all([
    db.player.findMany({
      where: {
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
  ]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Matchboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Player Registry</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Maintain the local registry, then open each player page for the full profile and
              editing workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
              href="/teams"
            >
              Manage teams
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
              href="/players?create=1"
            >
              Create player
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

        {teams.length === 0 ? (
          <section className="border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">No Teams Yet</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Create at least one team before adding players to the registry.
            </p>
            <div className="mt-4">
              <Link
                className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
                href="/teams"
              >
                Open team registry
              </Link>
            </div>
          </section>
        ) : (
          <PlayerTable
            players={players.map((player) => ({
              ...player,
              removeAction: removePlayerAction.bind(null, player.id),
            }))}
          />
        )}
      </div>

      {create === "1" && teams.length > 0 ? <PlayerCreateLayover teams={teams} /> : null}
    </main>
  );
}
