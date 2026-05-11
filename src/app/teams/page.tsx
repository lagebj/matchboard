export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  deleteTeamAction,
  updateTeamConfigurationAction,
} from "@/app/teams/actions";
import { TeamTable } from "@/components/teams/team-table";
import { db } from "@/lib/db";

type TeamsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "created") return "Team created.";
  if (saved === "support-updated") return "Team support and development setup updated.";
  if (saved === "deleted") return "Team removed.";
  return null;
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const { error, saved } = await searchParams;

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    include: {
      corePlayers: {
        where: { removedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          nonRotatable: true,
          reducedMatchLoadAllowed: true,
          currentAvailability: true,
          active: true,
          supportSuitability: true,
          developmentReadiness: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      matches: { select: { id: true } },
      fromRotationPaths: {
        select: { fromTeamId: true, toTeamId: true, role: true },
      },
      toRotationPaths: {
        select: { fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Teams
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Core groups, support needs, and movement paths.
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Teams
              </h1>
              <p className="mt-4 text-sm app-copy-soft sm:text-base">
                Select a team for squad detail, current round status, movement, and history.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/teams/new"
              >
                Create team
              </Link>
            </div>
          </div>
        </div>
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
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Team Directory
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">All active teams</h2>
          <p className="mt-2 text-sm app-copy-soft">Select a team to view squad detail, round status, movement, and history.</p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const coreCount = team.corePlayers.length;
            const availableCount = team.corePlayers.filter((p) => p.currentAvailability === "AVAILABLE").length;
            const unavailableCount = team.corePlayers.filter(
              (p) => p.currentAvailability === "INJURED" || p.currentAvailability === "SICK" || p.currentAvailability === "AWAY",
            ).length;
            const isBelowMinCore = coreCount < team.minCorePlayers;

            return (
              <Link
                key={team.id}
                className={`group rounded-[1.45rem] border p-4 transition-colors hover:bg-[rgba(255,255,255,0.04)] ${isBelowMinCore ? "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.06)]" : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]"}`}
                href={`/teams/${team.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-100 group-hover:text-[var(--accent-strong)]">{team.name}</p>
                  {isBelowMinCore && (
                    <span className="shrink-0 rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.12)] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#f0cbc5]">
                      Below min core
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs app-copy-muted">Core players</span>
                    <span className={`text-xs font-medium ${isBelowMinCore ? "text-[#f0cbc5]" : "text-zinc-100"}`}>
                      {coreCount} / {team.minCorePlayers} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs app-copy-muted">Available</span>
                    <span className="text-xs font-medium text-zinc-100">{availableCount}</span>
                  </div>
                  {unavailableCount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs app-copy-muted">Unavailable</span>
                      <span className="text-xs font-medium text-[#f0cbc5]">{unavailableCount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs app-copy-muted">Support priority rank</span>
                    <span className="text-xs font-medium text-zinc-100">{team.supportPriority}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs app-copy-muted">Squad target</span>
                    <span className="text-xs font-medium text-zinc-100">
                      {team.targetSquadSize} / {team.minAcceptedSquadSize} min / {team.maxSquadSize} max
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {teams.length === 0 && (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft md:col-span-2 xl:col-span-3">
              No teams yet.{" "}
              <Link href="/teams/new" className="underline text-[var(--accent-strong)]">
                Create a team
              </Link>{" "}
              to get started.
            </div>
          )}
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <TeamTable
          teams={teams.map((team) => ({
            activeCorePlayers: team.corePlayers.length,
            developmentSlots: team.developmentSlots,
            developmentSourceTeamIds: [...new Set(
              team.toRotationPaths
                .filter((p) => p.role === "DEVELOPMENT")
                .map((p) => p.fromTeam.id),
            )],
            developmentSourceTeamNames: [...new Set(
              team.toRotationPaths
                .filter((p) => p.role === "DEVELOPMENT")
                .map((p) => p.fromTeam.name),
            )],
            id: team.id,
            matches: team.matches.length,
            maxSquadSize: team.maxSquadSize,
            minAcceptedSquadSize: team.minAcceptedSquadSize,
            minCorePlayers: team.minCorePlayers,
            minSupportCount: team.minSupportCount,
            minSupportPlayers: team.minSupportPlayers,
            name: team.name,
            removeAction: deleteTeamAction.bind(null, team.id),
            saveAction: updateTeamConfigurationAction.bind(null, team.id),
            supportPriority: team.supportPriority,
            supportSourceTeamIds: [...new Set(
              team.toRotationPaths
                .filter((p) => p.role === "SUPPORT")
                .map((p) => p.fromTeam.id),
            )],
            supportSourceTeamNames: [...new Set(
              team.toRotationPaths
                .filter((p) => p.role === "SUPPORT")
                .map((p) => p.fromTeam.name),
            )],
            targetSquadSize: team.targetSquadSize,
            targetSupportCount: team.targetSupportCount,
            maxSupportCount: team.maxSupportCount,
          }))}
        />
      </section>

    </main>
  );
}