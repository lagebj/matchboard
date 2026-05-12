import Link from "next/link";
import { removePlayerAction } from "@/app/(app)/players/actions";
import { PlayerTable } from "@/components/players/player-table";
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
      where: { removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    db.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activePlayers = players.filter((p) => p.active);
  const unavailablePlayers = activePlayers.filter((p) => p.currentAvailability !== "AVAILABLE");

  const playersByTeam = new Map<string, typeof activePlayers>();
  for (const team of teams) {
    playersByTeam.set(team.id, []);
  }
  const unassigned: typeof activePlayers = [];
  for (const player of activePlayers) {
    const group = playersByTeam.get(player.coreTeamId);
    if (group) {
      group.push(player);
    } else {
      unassigned.push(player);
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Players · {activePlayers.length} active
        </p>
        <div className="flex gap-2">
          {teams.length > 0 && (
            <Link
              href="/players/new"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
            >
              Add player
            </Link>
          )}
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
          <p className="text-sm font-medium text-zinc-200">No teams yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create a team before adding players.</p>
          <Link href="/teams/new" className="mt-2 inline-flex h-7 items-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20">
            Create team
          </Link>
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
          <p className="text-sm font-medium text-zinc-200">No players yet</p>
          <p className="mt-1 text-xs text-zinc-400">Add players to teams.</p>
          <Link href="/players/new" className="mt-2 inline-flex h-7 items-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20">
            Add player
          </Link>
        </div>
      ) : (
        <>
          {unavailablePlayers.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Unavailable ({unavailablePlayers.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {unavailablePlayers.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-900/30 bg-amber-950/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/20"
                  >
                    {formatPlayerName(p)}
                    <span className="text-[10px] text-amber-300/50">{formatAvailabilityStatus(p.currentAvailability)}</span>
                  </Link>
                ))}
                {unavailablePlayers.length > 8 && (
                  <span className="inline-flex items-center px-2 py-1 text-xs text-zinc-500">+{unavailablePlayers.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {teams.map((team) => {
              const teamPlayers = playersByTeam.get(team.id) ?? [];
              return (
                <div key={team.id} className="flex flex-col gap-1.5 rounded-md border border-zinc-700/40 bg-zinc-800/20 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/teams/${team.id}`} className="text-xs font-semibold text-zinc-200 hover:text-zinc-100">
                      {team.name}
                    </Link>
                    <span className="text-[10px] text-zinc-500">{teamPlayers.length} players</span>
                  </div>
                  {teamPlayers.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-1">No players assigned</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {teamPlayers.map((player) => (
                        <Link
                          key={player.id}
                          href={`/players/${player.id}`}
                          className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-zinc-700/30"
                        >
                          <span className="text-zinc-200">{formatPlayerName(player)}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500">{player.primaryPosition}</span>
                            {player.nonRotatable && <span className="text-[9px] text-zinc-600">locked</span>}
                            {player.currentAvailability !== "AVAILABLE" && (
                              <span className="text-[9px] text-amber-400/60">{formatAvailabilityStatus(player.currentAvailability)}</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unassigned.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Unassigned ({unassigned.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((p) => (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700/30"
                  >
                    {formatPlayerName(p)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Full table
            </summary>
            <div className="mt-2">
              <PlayerTable
                players={players.map((player) => ({
                  id: player.id,
                  firstName: player.firstName,
                  lastName: player.lastName,
                  active: player.active,
                  coreTeam: player.coreTeam,
                  currentAvailability: player.currentAvailability,
                  primaryPosition: player.primaryPosition,
                  secondaryPosition: player.secondaryPosition,
                  tertiaryPosition: player.tertiaryPosition,
                  nonRotatable: player.nonRotatable,
                  reducedMatchLoadAllowed: player.reducedMatchLoadAllowed,
                  supportSuitability: player.supportSuitability,
                  developmentReadiness: player.developmentReadiness,
                  removeAction: removePlayerAction.bind(null, player.id),
                }))}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}