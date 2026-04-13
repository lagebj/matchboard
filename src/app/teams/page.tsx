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
  const configuredSupportTargets = teams.filter((team) => team.supportTargetRelationships.length > 0).length;
  const configuredDevelopmentTargets = teams.filter(
    (team) => team.developmentTargetRelationships.length > 0,
  ).length;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Team Configuration
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 6 workflow
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Configure support and development where the team context is visible.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                This board should make it obvious which teams carry support demand, where
                development slots are open, and which target teams still need their source teams configured.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Active Teams
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{teams.length}</p>
                <p className="mt-2 text-sm app-copy-soft">Teams currently available to players, matches, and rules.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Support Demand
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalSupportDemand}</p>
                <p className="mt-2 text-sm app-copy-soft">Total minimum support players requested across all targets.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Development Slots
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalDevelopmentSlots}</p>
                <p className="mt-2 text-sm app-copy-soft">Total development capacity currently configured across teams.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Linked Targets
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {configuredSupportTargets}/{configuredDevelopmentTargets}
                </p>
                <p className="mt-2 text-sm app-copy-soft">Support-linked teams vs. development-linked teams.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/teams?create=1"
              >
                Create team
              </Link>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Setup Notes
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">How to use this board</h2>
            </div>

            <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm font-medium text-zinc-100">Configure target teams, not abstract rules.</p>
              <p className="mt-2 text-sm app-copy-soft">
                Each row owns its support demand, development slots, and allowed source teams. That keeps the operational setup close to the team it affects.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Support should read as reserved capacity.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  If a team needs support players, its allowed source teams should be explicit here.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Development is a second priority lane.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Configure development slots and source teams separately so the selection engine can treat them distinctly.
                </p>
              </div>
            </div>
          </div>
        </aside>
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
