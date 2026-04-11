import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";

export default async function HomePage() {
  const [recentMatches, recentFinalizedSelections, playerCount, teamCount] = await Promise.all([
    db.match.findMany({
      include: {
        targetTeam: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.matchSelection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
      },
      include: {
        match: {
          include: {
            targetTeam: {
              select: {
                name: true,
              },
            },
          },
        },
        players: {
          select: {
            id: true,
            wasManuallyRemoved: true,
          },
        },
      },
      orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.player.count({
      where: {
        removedAt: null,
      },
    }),
    db.team.count({
      where: {
        archivedAt: null,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight">Matchboard</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Keep the team and player registries current, create one match at a time, generate or
            adjust a squad, and use finalized history to inspect rotation fairness.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Players</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{playerCount}</p>
            <p className="mt-2 text-sm text-zinc-600">Registered players in the local database.</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Teams</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{teamCount}</p>
            <p className="mt-2 text-sm text-zinc-600">Active teams available for players and matches.</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Recent Matches</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{recentMatches.length}</p>
            <p className="mt-2 text-sm text-zinc-600">Most recent scheduled matches on record.</p>
          </div>
          <div className="border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Finalized Selections</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">
              {recentFinalizedSelections.length}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Latest finalized squads available for history checks.
            </p>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-4 border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Recent Matches</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Open a match to continue selection work.
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                href="/matches"
              >
                View matches
              </Link>
            </div>

            <div className="border border-zinc-200">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => (
                  <div
                    key={match.id}
                    className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-950">
                        {match.targetTeam.name} vs. {match.opponent}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {formatDate(match.startsAt)}
                        {` · ${formatMatchVenue(match.homeOrAway)}`}
                        {match.matchType ? ` · ${match.matchType}` : ""}
                      </p>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      href={`/selection/${match.id}`}
                    >
                      Open selection
                    </Link>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-zinc-500">
                  No matches yet. Create the first one from the matches page.
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-4 border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Recent Finalized Selections</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Review the latest finalized squads and reopen the match workspace.
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                href="/history"
              >
                Open history
              </Link>
            </div>

            <div className="border border-zinc-200">
              {recentFinalizedSelections.length > 0 ? (
                recentFinalizedSelections.map((selection) => {
                  const selectedPlayerCount = selection.players.filter(
                    (player) => !player.wasManuallyRemoved,
                  ).length;

                  return (
                    <div
                      key={selection.id}
                      className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-950">
                          {selection.match.targetTeam.name} vs. {selection.match.opponent}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {formatDate(selection.match.startsAt)} · {formatMatchVenue(selection.match.homeOrAway)} · {selectedPlayerCount} players finalized
                        </p>
                        {selection.overrideNotes ? (
                          <p className="mt-1 text-sm text-zinc-500">{selection.overrideNotes}</p>
                        ) : null}
                      </div>
                      <Link
                        className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        href={`/selection/${selection.matchId}`}
                      >
                        View selection
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-sm text-zinc-500">
                  No finalized selections yet. Finalized squads will appear here.
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Quick Links</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Jump straight to the next operational task.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
                href="/matches"
              >
                Create or open matches
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                href="/players"
              >
                Manage players
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                href="/teams"
              >
                Manage teams
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                href="/rules"
              >
                Review rules
              </Link>
            </div>
          </div>

          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">How To Use It</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Start with the team and player registries, create a match, generate or assemble a
              squad, then finalize the selection so it becomes history for future rotation
              decisions.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
