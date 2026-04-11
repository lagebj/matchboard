import Link from "next/link";
import {
  deleteTeamAction,
  updateTeamConfigurationAction,
} from "@/app/teams/actions";
import { TeamCreateLayover } from "@/components/teams/team-create-layover";
import { TeamTable } from "@/components/teams/team-table";
import { db } from "@/lib/db";

type TeamsPageProps = {
  searchParams: Promise<{
    create?: string;
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "created") {
    return "Team created.";
  }

  if (saved === "support-updated") {
    return "Team support and development setup updated.";
  }

  if (saved === "deleted") {
    return "Team removed.";
  }

  return null;
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const { create, error, saved } = await searchParams;

  const teams = await db.team.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      corePlayers: {
        where: {
          removedAt: null,
        },
        select: {
          id: true,
        },
      },
      floatPlayers: {
        where: {
          player: {
            removedAt: null,
          },
        },
        select: {
          playerId: true,
        },
      },
      matches: {
        select: {
          id: true,
        },
      },
      supportTargetRelationships: {
        include: {
          sourceTeam: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sourceTeam: {
            name: "asc",
          },
        },
      },
      developmentTargetRelationships: {
        include: {
          sourceTeam: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sourceTeam: {
            name: "asc",
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Matchboard</p>
          <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            Maintain the team registry used by players, matches, and support coverage rules.
            Teams can be removed when they are no longer referenced anywhere in the app.
          </p>
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

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              Configure support requirements, development slots, and allowed support and development source teams.
            </p>
            <Link
              className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
              href="/teams?create=1"
            >
              Create team
            </Link>
          </div>

          <TeamTable
            availableTeams={teams.map((team) => ({
              id: team.id,
              name: team.name,
            }))}
            teams={teams.map((team) => ({
              activeCorePlayers: team.corePlayers.length,
              activeFloatLinks: team.floatPlayers.length,
              developmentSlots: team.developmentSlots,
              developmentSourceTeamIds: team.developmentTargetRelationships.map(
                (relationship) => relationship.sourceTeam.id,
              ),
              developmentSourceTeamNames: team.developmentTargetRelationships.map(
                (relationship) => relationship.sourceTeam.name,
              ),
              id: team.id,
              matches: team.matches.length,
              minSupportPlayers: team.minSupportPlayers,
              name: team.name,
              removeAction: deleteTeamAction.bind(null, team.id),
              saveAction: updateTeamConfigurationAction.bind(null, team.id),
              supportSourceTeamIds: team.supportTargetRelationships.map(
                (relationship) => relationship.sourceTeam.id,
              ),
              supportSourceTeamNames: team.supportTargetRelationships.map(
                (relationship) => relationship.sourceTeam.name,
              ),
            }))}
          />
        </section>
      </div>

      {create === "1" ? <TeamCreateLayover /> : null}
    </main>
  );
}
