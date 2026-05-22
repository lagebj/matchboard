export const dynamic = "force-dynamic";

import Link from "next/link";
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
          currentAvailability: true,
        },
      },
      matches: { select: { id: true } },
      fromRotationPaths: {
        select: { fromTeamId: true, toTeamId: true, role: true, toTeam: { select: { name: true } } },
      },
      toRotationPaths: {
        select: { fromTeamId: true, toTeamId: true, role: true, fromTeam: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ supportPriority: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Teams</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Team registry and configuration. Select a team for detail.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {formatSavedMessage(saved) && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{formatSavedMessage(saved)}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">{teams.length} team{teams.length !== 1 ? "s" : ""}</span>
        <Link
          href="/teams/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] shrink-0"
        >
          Add team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No teams yet.</p>
          <Link
            href="/teams/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Create a team
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Team</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Core</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Available</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Squad limits</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Support priority</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Rotation paths</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Matches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {teams.map((team) => {
                const coreCount = team.corePlayers.length;
                const availableCount = team.corePlayers.filter((p) => p.currentAvailability === "AVAILABLE").length;
                const isBelowMinCore = coreCount < team.minCorePlayers;
                const pathCount = team.fromRotationPaths.length + team.toRotationPaths.length;

                return (
                  <tr key={team.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/teams/${team.id}`} className="font-medium text-zinc-200 hover:text-zinc-50">
                        {team.name}
                      </Link>
                      {isBelowMinCore && (
                        <span className="ml-2 text-[10px] text-red-400">Below min core</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 ${isBelowMinCore ? "text-red-300" : "text-zinc-300"}`}>
                      {coreCount} / {team.minCorePlayers} min
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {availableCount}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {team.targetSquadSize} / {team.minAcceptedSquadSize}–{team.maxSquadSize}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {team.supportPriority} <span className="text-[10px] text-zinc-500">(1=highest)</span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {pathCount > 0 ? (
                        <span>{pathCount} path{pathCount !== 1 ? "s" : ""}</span>
                      ) : (
                        <span className="text-zinc-500">None</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {team.matches.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}