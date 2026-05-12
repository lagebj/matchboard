export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { MatchTable } from "@/components/matches/match-table";

type MatchesPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "created") return "Match created.";
  if (saved === "deleted") return "Match removed.";
  return null;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { error, saved } = await searchParams;

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const matches = await db.match.findMany({
    include: {
      team: { select: { name: true } },
      matchRound: { select: { name: true, status: true } },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  const matchRows = matches.map((m) => ({
    gameFormat: m.gameFormat,
    homeAway: m.homeAway,
    id: m.id,
    matchRoundId: m.matchRoundId,
    matchRoundName: m.matchRound?.name ?? null,
    matchRoundStatus: m.matchRound?.status ?? null,
    matchType: m.matchType,
    opponent: m.opponent,
    startsAt: m.startsAt,
    teamName: m.team.name,
  }));

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Matches
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Match details, dates, and round assignment.
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Matches
              </h1>
              <p className="mt-4 text-sm app-copy-soft sm:text-base">
                {teams.length === 0
                  ? "Create a team before adding matches."
                  : "Register match details for each team. Matches are assigned to rounds by date."}
              </p>
            </div>

            {teams.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  href="/matches/new"
                >
                  Create match
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        )}
        {formatSavedMessage(saved) && (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            {formatSavedMessage(saved)}
          </div>
        )}
      </div>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Match Registry
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">All matches</h2>
          <p className="mt-2 text-sm app-copy-soft">
            {teams.length === 0
              ? "You need at least one team before creating matches."
              : "Matches are assigned to match rounds based on date."}
          </p>
        </div>

        <div className="mt-6">
          {teams.length === 0 ? (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
              No teams yet.{" "}
              <Link href="/teams/new" className="underline text-[var(--accent-strong)]">
                Create a team
              </Link>{" "}
              before adding matches.
            </div>
          ) : (
            <MatchTable matches={matchRows} />
          )}
        </div>
      </section>
    </main>
  );
}