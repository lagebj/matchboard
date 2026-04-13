import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import {
  deleteMatchAction,
  finalizeAllMatchesAction,
  markAllMatchesAsDraftAction,
  recalculateMatchesAction,
} from "@/app/matches/actions";
import { MatchCreateLayover } from "@/components/matches/match-create-layover";
import { MatchTable } from "@/components/matches/match-table";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";

type MatchesPageProps = {
  searchParams: Promise<{
    create?: string;
    created?: string;
    deleted?: string;
    error?: string;
    finalizedAll?: string;
    finalizeWarnings?: string;
    markedDraftAll?: string;
    recalculated?: string;
  }>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const {
    create,
    created,
    deleted,
    error,
    finalizedAll,
    finalizeWarnings,
    markedDraftAll,
    recalculated,
  } = await searchParams;
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

  const enrichedMatches = matches.map((match) => ({
    ...match,
    latestSelectionStatus: latestSelectionByMatchId.get(match.id)?.status ?? null,
  }));
  const actionableMatches = enrichedMatches.filter(
    (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
  );
  const nextActionMatch =
    [...actionableMatches].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())[0] ?? null;
  const draftCount = actionableMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.DRAFT,
  ).length;
  const unstartedCount = actionableMatches.filter((match) => match.latestSelectionStatus === null).length;
  const finalizedCount = enrichedMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.FINALIZED,
  ).length;
  const recentMatchCount = enrichedMatches.length;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Match Operations
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 4 workflow
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Keep the match queue moving with less scanning.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                This board is for the operational part of match-day prep: create the fixture, see
                which workspaces already have drafts, finish what is closest to kickoff, and only
                then drop into the detailed squad editor.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Total Matches
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{recentMatchCount}</p>
                <p className="mt-2 text-sm app-copy-soft">All registered fixtures in the current board.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Drafts Ready
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{draftCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Selections already generated and waiting for review.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Not Started
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{unstartedCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Fixtures without a saved draft yet.</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Finalized
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{finalizedCount}</p>
                <p className="mt-2 text-sm app-copy-soft">Selections already locked into history.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/matches?create=1"
              >
                Create match
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/api/exports/finalized-selections?format=csv"
              >
                Export CSV
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/api/exports/finalized-selections?format=txt"
              >
                Export text
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/api/exports/finalized-selections?format=md"
              >
                Export markdown
              </Link>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Queue Focus
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">What to open next</h2>
            </div>

            {nextActionMatch ? (
              <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] app-copy-muted">Closest open match</p>
                <p className="mt-2 text-lg font-semibold text-zinc-50">
                  {nextActionMatch.targetTeam.name} vs. {nextActionMatch.opponent}
                </p>
                <p className="mt-1 text-sm app-copy-soft">
                  {formatDate(nextActionMatch.startsAt)} · {formatIsoWeekLabel(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeOrAway)}
                </p>
                <div className="mt-4 rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] app-copy-muted">
                    Current state
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    {nextActionMatch.latestSelectionStatus === SelectionStatus.DRAFT
                      ? "Draft ready for review"
                      : "Needs first draft"}
                  </p>
                  <p className="mt-2 text-sm app-copy-soft">
                    Open the workspace directly from the board to generate or finish the squad.
                  </p>
                </div>
                <Link
                  className="mt-4 inline-flex h-10 items-center rounded-full border border-[rgba(205,219,210,0.28)] bg-[rgba(255,255,255,0.05)] px-4 text-sm font-medium text-zinc-50 hover:bg-[rgba(255,255,255,0.1)]"
                  href={`/selection/${nextActionMatch.id}`}
                >
                  Open match workspace
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-zinc-100">No open match workspace right now.</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Every registered match is finalized. Create a new fixture when the next cycle starts.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Drafts should be the first review lane.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Resume saved work before generating new selections for later fixtures.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Use bulk recalc only for open matches.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Finalized rows stay visible for history context, but they are locked out of draft actions.
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

        {created ? (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            Match created. Open its selection workspace from the board below.
          </div>
        ) : null}

        {deleted ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Match removed.
          </div>
        ) : null}

        {recalculated ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            {recalculated === "all"
              ? "All draft-eligible matches recalculated."
              : "Selected draft-eligible matches recalculated."}
          </div>
        ) : null}

        {markedDraftAll ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            {Number.parseInt(markedDraftAll, 10) > 0
              ? `Marked ${markedDraftAll} finalized match selection${markedDraftAll === "1" ? "" : "s"} as draft.`
              : "No finalized selections needed to be marked as draft."}
          </div>
        ) : null}

        {finalizedAll && Number.parseInt(finalizedAll, 10) > 0 ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Finalized {finalizedAll} match{finalizedAll === "1" ? "" : "es"} from the current non-finalized set.
          </div>
        ) : null}

        {bulkFinalizeWarnings.length > 0 ? (
          <div className="rounded-2xl border border-[rgba(208,176,127,0.34)] bg-[rgba(208,176,127,0.14)] px-4 py-4 text-sm text-[var(--foreground)]">
            <p className="font-medium text-[var(--warning)]">Some matches still need attention before finalizing.</p>
            <div className="mt-2 flex flex-col gap-1 app-copy-soft">
              {bulkFinalizeWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <section className="app-panel rounded-[1.75rem] p-6">
          <h2 className="text-lg font-semibold text-zinc-50">No Active Teams</h2>
          <p className="mt-1 text-sm leading-6 app-copy-soft">
            Create a team before adding new matches.
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
          <MatchTable
            markAllDraftAction={markAllMatchesAsDraftAction}
            matches={enrichedMatches.map((match) => ({
              ...match,
              deleteAction: deleteMatchAction.bind(null, match.id),
            }))}
            finalizeAllAction={finalizeAllMatchesAction}
            recalculateAction={recalculateMatchesAction}
          />
        </section>
      )}

      {create === "1" && teams.length > 0 ? <MatchCreateLayover teams={teams} /> : null}
    </main>
  );
}
