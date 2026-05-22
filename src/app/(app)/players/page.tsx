import Link from "next/link";
import { db } from "@/lib/db";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";

type PlayersPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const { error, saved } = await searchParams;

  const [players, teams] = await Promise.all([
    db.player.findMany({
      where: { removedAt: null, active: true },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    db.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const unavailableCount = players.filter((p) => p.currentAvailability !== "AVAILABLE").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Players</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Player registry and assignment. Select a player for profile and availability.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {saved === "created" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Player created.</div>
      )}
      {saved === "removed" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Player removed.</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{players.length} player{players.length !== 1 ? "s" : ""}</span>
          {unavailableCount > 0 && (
            <span className="text-xs text-amber-400">{unavailableCount} unavailable</span>
          )}
        </div>
        {teams.length > 0 && (
          <Link
            href="/players/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] shrink-0"
          >
            Add player
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No teams yet.</p>
          <p className="text-xs text-zinc-500">Create a team before adding players.</p>
          <Link
            href="/teams/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Create team
          </Link>
        </div>
      ) : players.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No players yet.</p>
          <Link
            href="/players/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Add player
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Player</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Core team</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Position</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Availability</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Flags</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <Link
                    href="/players/new"
                    className="text-[var(--accent-strong)] hover:underline"
                  >
                    + Add
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {players.map((player) => {
                const isUnavailable = player.currentAvailability !== "AVAILABLE";
                return (
                  <tr key={player.id} className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors ${isUnavailable ? "bg-amber-950/5" : ""}`}>
                    <td className="px-4 py-2">
                      <Link href={`/players/${player.id}`} className="font-medium text-zinc-200 hover:text-zinc-50">
                        {formatPlayerName(player)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {player.coreTeam ? (
                        <Link href={`/teams/${player.coreTeam.id}`} className="text-zinc-400 hover:text-zinc-200">
                          {player.coreTeam.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {player.primaryPosition || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`${isUnavailable ? "text-amber-300" : "text-emerald-400"}`}>
                        {isUnavailable ? formatAvailabilityStatus(player.currentAvailability) : "Available"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {player.nonRotatable && (
                          <span className="inline-flex items-center rounded border border-zinc-700/40 bg-zinc-800/30 px-1.5 py-0.5 text-[9px] text-zinc-400">Locked</span>
                        )}
                        {player.reducedMatchLoadAllowed && (
                          <span className="inline-flex items-center rounded border border-zinc-700/40 bg-zinc-800/30 px-1.5 py-0.5 text-[9px] text-zinc-400">RML</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/players/${player.id}`}
                        className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline"
                      >
                        Profile
                      </Link>
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