import Link from "next/link";
import {
  deleteMatchAction,
  finalizeAllMatchesAction,
  recalculateMatchesAction,
} from "@/app/matches/actions";
import { MatchCreateLayover } from "@/components/matches/match-create-layover";
import { MatchTable } from "@/components/matches/match-table";
import { db } from "@/lib/db";

type MatchesPageProps = {
  searchParams: Promise<{
    create?: string;
    created?: string;
    deleted?: string;
    error?: string;
    finalizedAll?: string;
    finalizeWarnings?: string;
    recalculated?: string;
  }>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { create, created, deleted, error, finalizedAll, finalizeWarnings, recalculated } = await searchParams;
  const bulkFinalizeWarnings = finalizeWarnings?.split("\n").filter(Boolean) ?? [];

  const [matches, teams, selections] = await Promise.all([
    db.match.findMany({
      include: {
        targetTeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { startsAt: "desc" },
        { createdAt: "desc" },
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
    db.matchSelection.findMany({
      select: {
        createdAt: true,
        finalizedAt: true,
        matchId: true,
        status: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();

  for (const selection of selections) {
    if (!latestSelectionByMatchId.has(selection.matchId)) {
      latestSelectionByMatchId.set(selection.matchId, selection);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Matchboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Matches</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            Create one match at a time and open its selection workspace.
          </p>
        </header>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {created ? (
          <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Match created. Open its selection workspace from the list below.
          </div>
        ) : null}

        {deleted ? (
          <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Match removed.
          </div>
        ) : null}

        {recalculated ? (
          <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            {recalculated === "all"
              ? "All draft-eligible matches recalculated."
              : "Selected draft-eligible matches recalculated."}
          </div>
        ) : null}

        {finalizedAll && Number.parseInt(finalizedAll, 10) > 0 ? (
          <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Finalized {finalizedAll} match{finalizedAll === "1" ? "" : "es"} from the current non-finalized set.
          </div>
        ) : null}

        {bulkFinalizeWarnings.length > 0 ? (
          <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium text-amber-900">Some matches still need attention before finalizing.</p>
            <div className="mt-2 flex flex-col gap-1">
              {bulkFinalizeWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        ) : null}

        {teams.length === 0 ? (
          <section className="border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">No Active Teams</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Create a team before adding new matches.
            </p>
            <div className="mt-4">
              <Link
                className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
                href="/teams"
              >
                Open team registry
              </Link>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600">
                Open a match directly from the list, recalculate draft-eligible sets, or export finalized selections for manual review.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
                  href="/api/exports/finalized-selections?format=csv"
                >
                  Export CSV
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
                  href="/api/exports/finalized-selections?format=txt"
                >
                  Export text
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
                  href="/api/exports/finalized-selections?format=md"
                >
                  Export markdown
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
                  href="/matches?create=1"
                >
                  Create match
                </Link>
              </div>
            </div>

            <MatchTable
              matches={matches.map((match) => {
                const latestSelection = latestSelectionByMatchId.get(match.id) ?? null;

                return {
                  ...match,
                  deleteAction: deleteMatchAction.bind(null, match.id),
                  latestSelectionStatus: latestSelection?.status ?? null,
                };
              })}
              finalizeAllAction={finalizeAllMatchesAction}
              recalculateAction={recalculateMatchesAction}
            />
          </section>
        )}
      </div>

      {create === "1" && teams.length > 0 ? <MatchCreateLayover teams={teams} /> : null}
    </main>
  );
}
