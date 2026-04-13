import Link from "next/link";
import { removePlayerAction } from "@/app/players/actions";
import { PlayerCreateLayover } from "@/components/players/player-create-layover";
import { PlayerTable } from "@/components/players/player-table";
import { db } from "@/lib/db";
import { formatAvailabilityStatus } from "@/lib/player-metrics";

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
  const floatingCount = players.filter(
    (player) => player.isFloating && player.allowedFloatTeams.length > 0,
  ).length;
  const unavailableCount = players.filter((player) => player.currentAvailability !== "AVAILABLE").length;
  const nextProfilePlayer = players[0] ?? null;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Registry Board
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 5 workflow
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Scan the squad before you edit the record.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                The registry should help you see who is available, who can float, and which profile
                to inspect next without feeling like a flat back-office list.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Active Players
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{activeCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Players currently available for normal selection work.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Floating Enabled
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{floatingCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Players with explicit float-team eligibility configured.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Unavailable
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{unavailableCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Injured, sick, or away players currently blocking selection.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Inactive
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{inactiveCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Registry entries kept for reference but not active in selection.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
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
                Manage teams
              </Link>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Profile Flow
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Where to inspect next</h2>
            </div>

            {nextProfilePlayer ? (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] app-copy-muted">First registry entry</p>
                <p className="mt-2 text-lg font-semibold text-zinc-50">
                  {nextProfilePlayer.firstName} {nextProfilePlayer.lastName ?? ""}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {nextProfilePlayer.coreTeam.name} · {formatAvailabilityStatus(nextProfilePlayer.currentAvailability)}
                </p>
                <p className="mt-3 text-sm app-copy-soft">
                  Open a profile when you need the fuller FM-style attribute view, floating setup,
                  and appearance context.
                </p>
                <Link
                  className="mt-4 inline-flex h-10 items-center rounded-full border border-[rgba(205,219,210,0.28)] bg-[rgba(255,255,255,0.05)] px-4 text-sm font-medium text-zinc-50 hover:bg-[rgba(255,255,255,0.1)]"
                  href={`/players/${nextProfilePlayer.id}`}
                >
                  Open player profile
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-zinc-100">No players in the registry yet.</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Create the first player after your teams are in place.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Use the registry for scanning, not deep editing.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  The list should tell you who needs attention before you open the full profile page.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Floating visibility matters here.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Explicit float eligibility is one of the fastest checks before selection work starts.
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
