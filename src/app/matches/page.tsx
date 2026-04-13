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

function groupMatchesByWeek<T extends { startsAt: Date }>(matches: T[]) {
  const groups = new Map<string, T[]>();

  for (const match of matches) {
    const label = formatIsoWeekLabel(match.startsAt);
    const existing = groups.get(label) ?? [];
    existing.push(match);
    groups.set(label, existing);
  }

  return [...groups.entries()].map(([label, weekMatches]) => ({
    label,
    matches: weekMatches,
  }));
}

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
  const weekQueue = groupMatchesByWeek(
    [...actionableMatches].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime()),
  ).slice(0, 4);

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Match Queue
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Weekly board before table
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Run the queue by week and state instead of scanning a flat fixture ledger.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                  This page should surface the live weeks first, then let the full board handle bulk
                  actions and deeper sorting. The coach should know which week is active before the
                  big table starts asking for attention.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
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
                    href="/history"
                  >
                    Open history
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Live queue
                </p>
                {nextActionMatch ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <p className="text-lg font-semibold text-zinc-50">
                        {nextActionMatch.targetTeam.name} vs. {nextActionMatch.opponent}
                      </p>
                      <p className="mt-2 text-sm app-copy-soft">
                        {formatDate(nextActionMatch.startsAt)} · {formatIsoWeekLabel(nextActionMatch.startsAt)} · {formatMatchVenue(nextActionMatch.homeOrAway)}
                      </p>
                    </div>
                    <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] app-copy-muted">
                        Current state
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-100">
                        {nextActionMatch.latestSelectionStatus === SelectionStatus.DRAFT
                          ? "Draft ready for review"
                          : "Needs first draft"}
                      </p>
                      <p className="mt-2 text-sm leading-6 app-copy-soft">
                        Open the workspace directly from here when you want to keep the week rhythm intact.
                      </p>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                      href={`/selection/${nextActionMatch.id}`}
                    >
                      Open match workspace
                    </Link>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 app-copy-soft">
                    No open match workspace right now. Every registered match is finalized.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Queue Signals
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Total matches
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{recentMatchCount}</p>
                <p className="mt-2 text-sm app-copy-soft">All registered fixtures currently on the board.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{draftCount} draft queue item(s)</p>
                  <p className="mt-1 text-sm app-copy-soft">Resume these before creating more review debt.</p>
                </div>
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <p className="text-sm font-medium text-zinc-100">{unstartedCount} first draft needed</p>
                  <p className="mt-1 text-sm app-copy-soft">These weeks still need their first generated pass.</p>
                </div>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">{finalizedCount} finalized fixture(s)</p>
                <p className="mt-1 text-sm app-copy-soft">Locked selections remain visible for context only.</p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Weekly Queue
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Open fixtures grouped by calendar week</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {weekQueue.length > 0 ? (
              weekQueue.map((week) => (
                <div
                  key={week.label}
                  className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                        {week.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-zinc-50">
                        {week.matches.length} open fixture{week.matches.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-muted">
                      {week.matches.filter((match) => match.latestSelectionStatus === SelectionStatus.DRAFT).length} draft
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {week.matches.slice(0, 3).map((match) => (
                      <Link
                        key={match.id}
                        className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                        href={`/selection/${match.id}`}
                      >
                        <p className="text-sm font-semibold text-zinc-100">
                          {match.targetTeam.name} vs. {match.opponent}
                        </p>
                        <p className="mt-1 text-sm app-copy-soft">
                          {formatDate(match.startsAt)} · {match.latestSelectionStatus === SelectionStatus.DRAFT ? "Draft saved" : "Needs first draft"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft lg:col-span-2">
                No open weekly queue right now. Once a non-finalized fixture exists, it should appear here before the full board demands scanning.
              </div>
            )}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Bulk Habits
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Use bulk actions after the week picture is clear</h2>
          <div className="mt-6 grid gap-3">
            {[
              "Recalculate selected rows when you need to refresh only the part of the queue you are actively working.",
              "Finalize all ready matches only after the open weeks look clean and complete.",
              "Mark all as draft when you need to reopen finalized work for another pass, but keep it a deliberate queue-wide decision.",
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
