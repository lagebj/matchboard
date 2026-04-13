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

  const totalSupportDemand = teams.reduce((sum, team) => sum + team.minSupportPlayers, 0);
  const totalDevelopmentSlots = teams.reduce((sum, team) => sum + team.developmentSlots, 0);
  const supportConfiguredTeams = teams.filter(
    (team) => team.minSupportPlayers > 0 || team.supportTargetRelationships.length > 0,
  );
  const developmentConfiguredTeams = teams.filter(
    (team) => team.developmentSlots > 0 || team.developmentTargetRelationships.length > 0,
  );
  const dualPurposeTeams = teams.filter(
    (team) =>
      (team.minSupportPlayers > 0 || team.supportTargetRelationships.length > 0) &&
      (team.developmentSlots > 0 || team.developmentTargetRelationships.length > 0),
  );

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Team Setup
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Relationships before rows
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Configure team pathways where the downstream match pressure stays visible.
                </h1>
                <p className="mt-4 max-w-2xl text-sm app-copy-soft sm:text-base">
                  Keep the team links clear before the next selection run.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    href="/teams?create=1"
                  >
                    Create team
                  </Link>
                  <Link
                    className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href="/matches"
                  >
                    Open match queue
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Setup pressure
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{teams.length} active team record(s)</p>
                    <p className="mt-1 text-sm app-copy-soft">Current team base.</p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{supportConfiguredTeams.length} target team(s) with support demand</p>
                    <p className="mt-1 text-sm app-copy-soft">Need clear source teams.</p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{developmentConfiguredTeams.length} target team(s) with development pathways</p>
                    <p className="mt-1 text-sm app-copy-soft">Growth lanes in play.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Team Signals
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Support demand
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalSupportDemand}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Total minimum support players currently reserved across teams.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{totalDevelopmentSlots} development slot(s)</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Total development capacity currently configured.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{dualPurposeTeams.length} dual-pressure team(s)</p>
                <p className="mt-1 text-sm app-copy-soft">
                  These teams currently carry both support and development setup.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Support Map
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Target teams that need help</h2>
          </div>

          <div className="mt-6 grid gap-3">
            {supportConfiguredTeams.length > 0 ? (
              supportConfiguredTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-zinc-100">{team.name}</p>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-muted">
                      {team.minSupportPlayers} minimum support
                    </span>
                  </div>
                  <p className="mt-2 text-sm app-copy-soft">
                    Sources:{" "}
                    {team.supportTargetRelationships.length > 0
                      ? team.supportTargetRelationships.map((relationship) => relationship.sourceTeam.name).join(", ")
                      : "No source teams configured yet"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
                No support-target setup yet. Once a team needs help, it should appear here before
                you need to inspect the full editable table.
              </div>
            )}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Development Map
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Target teams growing through shared minutes</h2>
          </div>

          <div className="mt-6 grid gap-3">
            {developmentConfiguredTeams.length > 0 ? (
              developmentConfiguredTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-zinc-100">{team.name}</p>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-muted">
                      {team.developmentSlots} development slot(s)
                    </span>
                  </div>
                  <p className="mt-2 text-sm app-copy-soft">
                    Sources:{" "}
                    {team.developmentTargetRelationships.length > 0
                      ? team.developmentTargetRelationships.map((relationship) => relationship.sourceTeam.name).join(", ")
                      : "No development sources configured yet"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
                No development-target setup yet. Configure the target teams that should reserve
                development capacity before relying on the generator.
              </div>
            )}
          </div>
        </section>
      </section>

      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        ) : null}

        {formatSavedMessage(saved) ? (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            {formatSavedMessage(saved)}
          </div>
        ) : null}
      </div>

      <section className="app-panel rounded-[1.75rem] p-6">
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

      {create === "1" ? <TeamCreateLayover /> : null}
    </main>
  );
}
