import Link from "next/link";
import { removePlayerAction } from "@/app/players/actions";
import { PlayerCreateLayover } from "@/components/players/player-create-layover";
import { PlayerTable } from "@/components/players/player-table";
import { db } from "@/lib/db";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";

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

  const activeCount = players.filter((player) => player.active).length;
  const inactiveCount = players.length - activeCount;
  const floatingPlayers = players.filter(
    (player) => player.isFloating && player.allowedFloatTeams.length > 0,
  );
  const unavailablePlayers = players.filter(
    (player) => player.currentAvailability !== "AVAILABLE",
  );
  const nextProfilePlayer = players[0] ?? null;
  const teamSnapshots = teams.map((team) => {
    const teamPlayers = players.filter((player) => player.coreTeamId === team.id);

    return {
      active: teamPlayers.filter((player) => player.active).length,
      floating: teamPlayers.filter(
        (player) => player.isFloating && player.allowedFloatTeams.length > 0,
      ).length,
      team,
      unavailable: teamPlayers.filter((player) => player.currentAvailability !== "AVAILABLE").length,
    };
  });

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Player Registry
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Scan first, edit second
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Keep the roster readable enough that you know which profile to open next.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                  This page should behave like a squad attention board. Show the availability
                  pressure, the floating pool, and the team context first, then leave the table as
                  a secondary scanning surface for deeper maintenance.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    href="/players?create=1"
                  >
                    Create player
                  </Link>
                  <Link
                    className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href="/teams"
                  >
                    Open teams
                  </Link>
                  <Link
                    className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href="/history"
                  >
                    Open history
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Next profile
                </p>
                {nextProfilePlayer ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <p className="text-lg font-semibold text-zinc-50">
                        {formatPlayerName(nextProfilePlayer)}
                      </p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {nextProfilePlayer.coreTeam.name} · {formatAvailabilityStatus(nextProfilePlayer.currentAvailability)}
                      </p>
                    </div>
                    <p className="text-sm leading-6 app-copy-soft">
                      Open the full player page when you need the attribute view, floating setup,
                      and finalized appearance context in one place.
                    </p>
                    <Link
                      className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                      href={`/players/${nextProfilePlayer.id}`}
                    >
                      Open player profile
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 app-copy-soft">
                    No active player records yet. Create the first player after the teams are in place.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Registry Signals
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Active players
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{activeCount}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Normal selection candidates currently available in the registry.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{floatingPlayers.length} floating profile(s)</p>
                  <p className="mt-1 text-sm app-copy-soft">
                    Explicit float permissions are configured and visible.
                  </p>
                </div>
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{inactiveCount} inactive record(s)</p>
                  <p className="mt-1 text-sm app-copy-soft">
                    Retained for reference but not live in selection.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Attention Rule
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">Use this page to decide who needs a closer look.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Availability changes, floating eligibility, and team context should be readable
                  before you need the detailed profile editor.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Attention Lanes
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">See the pressure before the grid</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                Unavailable now
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {unavailablePlayers.length > 0 ? (
                  unavailablePlayers.slice(0, 5).map((player) => (
                    <Link
                      key={player.id}
                      className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                      href={`/players/${player.id}`}
                    >
                      <p className="text-sm font-semibold text-zinc-100">{formatPlayerName(player)}</p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {player.coreTeam.name} · {formatAvailabilityStatus(player.currentAvailability)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 app-copy-soft">
                    No one is currently marked injured, sick, or away.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                Floating pool
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {floatingPlayers.length > 0 ? (
                  floatingPlayers.slice(0, 5).map((player) => (
                    <Link
                      key={player.id}
                      className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                      href={`/players/${player.id}`}
                    >
                      <p className="text-sm font-semibold text-zinc-100">{formatPlayerName(player)}</p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {player.coreTeam.name} → {player.allowedFloatTeams.map((entry) => entry.team.name).join(", ")}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 app-copy-soft">
                    No active player currently has explicit float-team coverage configured.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                Team snapshots
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {teamSnapshots.length > 0 ? (
                  teamSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.team.id}
                      className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-zinc-100">{snapshot.team.name}</p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {snapshot.active} active · {snapshot.unavailable} unavailable · {snapshot.floating} floating
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 app-copy-soft">
                    Team snapshots appear here once team records exist.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Working Habit
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Keep the table as the second read</h2>
          <div className="mt-6 grid gap-3">
            {[
              "Use the attention lanes first to see which players changed status or matter to the next selection.",
              "Open an individual profile only when you need the deeper attribute, floating, and history view.",
              "Return to the table for bulk scanning, sorting, and removals once you already know what you are looking for.",
            ].map((note) => (
              <div
                key={note}
                className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm leading-6 app-copy-soft"
              >
                {note}
              </div>
            ))}
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

      {teams.length === 0 ? (
        <section className="app-panel rounded-[1.75rem] p-6">
          <h2 className="text-lg font-semibold text-zinc-50">No Teams Yet</h2>
          <p className="mt-1 text-sm leading-6 app-copy-soft">
            Create at least one team before adding players to the registry.
          </p>
          <div className="mt-4">
            <Link
              className="inline-flex h-10 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              href="/teams"
            >
              Open team registry
            </Link>
          </div>
        </section>
      ) : (
        <section className="app-panel rounded-[1.75rem] p-6">
          <PlayerTable
            players={players.map((player) => ({
              ...player,
              removeAction: removePlayerAction.bind(null, player.id),
            }))}
          />
        </section>
      )}

      {create === "1" && teams.length > 0 ? <PlayerCreateLayover teams={teams} /> : null}
    </main>
  );
}
