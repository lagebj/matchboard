export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  deleteTeamAction,
  updateTeamConfigurationAction,
} from "@/app/(app)/teams/actions";
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
        select: { fromTeamId: true, toTeamId: true, role: true, toTeam: { select: { name: true } } },
      },
      toRotationPaths: {
        select: { fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {formatSavedMessage(saved) && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{formatSavedMessage(saved)}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Teams · {teams.length}</p>
        <Link
          href="/teams/new"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
        >
          Add team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
          <p className="text-sm font-medium text-zinc-200">No teams yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create a team to get started.</p>
          <Link href="/teams/new" className="mt-2 inline-flex h-7 items-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20">
            Create team
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const coreCount = team.corePlayers.length;
              const availableCount = team.corePlayers.filter((p) => p.currentAvailability === "AVAILABLE").length;
              const isBelowMinCore = coreCount < team.minCorePlayers;

              return (
                <div
                  key={team.id}
                  className={`flex flex-col gap-2 rounded-md border p-3 ${isBelowMinCore ? "border-red-900/40 bg-red-950/10" : "border-zinc-700/40 bg-zinc-800/20"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/teams/${team.id}`} className="text-sm font-semibold text-zinc-200 hover:text-zinc-100">
                      {team.name}
                    </Link>
                    {isBelowMinCore && (
                      <span className="text-[10px] font-medium text-red-300">Below min core</span>
                    )}
                  </div>

                  <div className="grid gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Core</span>
                      <span className={isBelowMinCore ? "text-red-200" : "text-zinc-200"}>{coreCount} (min {team.minCorePlayers})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Available</span>
                      <span className="text-zinc-200">{availableCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Squad target</span>
                      <span className="text-zinc-200">{team.targetSquadSize} / {team.maxSquadSize} max</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Support priority rank</span>
                      <span className="text-zinc-200">{team.supportPriority} (1=highest)</span>
                    </div>
                  </div>

                  {(team.fromRotationPaths.length > 0 || team.toRotationPaths.length > 0) && (
                    <div className="mt-1 border-t border-zinc-700/30 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Rotation paths</p>
                      <div className="flex flex-col gap-0.5">
                        {team.fromRotationPaths.map((p, i) => (
                          <p key={`from-${i}`} className="text-[11px] text-zinc-400">
                            <span className="text-zinc-200">{team.name}</span>
                            <span className="text-zinc-500"> → </span>
                            <span className="text-zinc-200">{p.toTeam.name}</span>
                            <span className="ml-1 rounded bg-zinc-700/40 px-1 text-[9px] text-zinc-300">{p.role}</span>
                          </p>
                        ))}
                        {team.toRotationPaths.map((p, i) => (
                          <p key={`to-${i}`} className="text-[11px] text-zinc-400">
                            <span className="text-zinc-200">{p.fromTeam.name}</span>
                            <span className="text-zinc-500"> → </span>
                            <span className="text-zinc-200">{team.name}</span>
                            <span className="ml-1 rounded bg-zinc-700/40 px-1 text-[9px] text-zinc-300">{p.role}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Advanced table
            </summary>
            <div className="mt-2">
              <TeamTable
                teams={teams.map((team) => ({
                  activeCorePlayers: team.corePlayers.length,
                  developmentSlots: team.developmentSlots,
                  developmentSourceTeamIds: [...new Set(team.toRotationPaths.filter((p) => p.role === "DEVELOPMENT").map((p) => p.fromTeam.id))],
                  developmentSourceTeamNames: [...new Set(team.toRotationPaths.filter((p) => p.role === "DEVELOPMENT").map((p) => p.fromTeam.name))],
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
                  supportSourceTeamIds: [...new Set(team.toRotationPaths.filter((p) => p.role === "SUPPORT").map((p) => p.fromTeam.id))],
                  supportSourceTeamNames: [...new Set(team.toRotationPaths.filter((p) => p.role === "SUPPORT").map((p) => p.fromTeam.name))],
                  targetSquadSize: team.targetSquadSize,
                  targetSupportCount: team.targetSupportCount,
                  maxSupportCount: team.maxSupportCount,
                }))}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}