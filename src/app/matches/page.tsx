import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import {
  deleteMatchAction,
  finalizeMatchesAction,
  markMatchesAsDraftAction,
  recalculateMatchesAction,
} from "@/app/matches/actions";
import { MatchCreateLayover } from "@/components/matches/match-create-layover";
import { MatchTable } from "@/components/matches/match-table";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import { getWeeklyPlayerCoverage } from "@/lib/selection/get-weekly-player-coverage";
import { getMatchWeekGroups } from "@/lib/workflow/get-match-week-groups";

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

function WeekMatchInputs({ matchIds }: { matchIds: string[] }) {
  return (
    <>
      {matchIds.map((matchId) => (
        <input key={matchId} name="selectedMatchIds" type="hidden" value={matchId} />
      ))}
    </>
  );
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

  const [matches, teams, players, selections] = await Promise.all([
    db.match.findMany({
      include: {
        targetTeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
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
    db.player.findMany({
      where: {
        active: true,
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
    db.matchSelection.findMany({
      include: {
        players: {
          where: {
            wasManuallyRemoved: false,
          },
          select: {
            playerId: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { finalizedAt: "desc" }],
    }),
  ]);

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();

  for (const selection of selections) {
    if (!latestSelectionByMatchId.has(selection.matchId)) {
      latestSelectionByMatchId.set(selection.matchId, selection);
    }
  }

  const latestSelectionStatusByMatchId = new Map<string, SelectionStatus | null>(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [matchId, selection.status]),
  );
  const selectedPlayerIdsByMatchId = new Map<string, string[]>(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [
      matchId,
      selection.players.map((player) => player.playerId),
    ]),
  );

  const enrichedMatches = matches.map((match) => ({
    ...match,
    latestSelectionStatus: latestSelectionStatusByMatchId.get(match.id) ?? null,
  }));
  const weekGroups = getMatchWeekGroups(enrichedMatches, latestSelectionStatusByMatchId).map((week) => ({
    ...week,
    coverage: getWeeklyPlayerCoverage(
      players,
      week.matches.map((match) => ({
        id: match.id,
        opponent: match.opponent,
        targetTeam: match.targetTeam,
      })),
      selectedPlayerIdsByMatchId,
    ),
  }));
  const nextActionMatch = enrichedMatches.find(
    (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
  ) ?? null;
  const openWeekCount = weekGroups.filter((week) => !week.isFullyFinalized).length;
  const finalizedWeekCount = weekGroups.filter((week) => week.isFullyFinalized).length;
  const draftCount = enrichedMatches.filter(
    (match) => match.latestSelectionStatus === SelectionStatus.DRAFT,
  ).length;
  const highlightWeek =
    weekGroups.find((week) => !week.isFullyFinalized) ??
    weekGroups[0] ??
    null;

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Match Queue
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Weekly batch workflow
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Batch the queue by week, not by the whole fixture list.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 app-copy-soft sm:text-base">
              The weekly cards are the operating surface now. Use them to reopen, recalculate, and
              finalize one week at a time, then fall back to the deeper ledger only when you need
              sorting or cleanup.
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
                href={nextActionMatch ? `/selection/${nextActionMatch.id}` : "/history"}
              >
                {nextActionMatch ? "Open next workspace" : "Review locked history"}
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/api/exports/finalized-selections?format=csv"
              >
                Export CSV
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Active week
              </p>
              {highlightWeek ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-zinc-50">{highlightWeek.label}</p>
                  <p className="mt-2 text-sm app-copy-soft">
                    {highlightWeek.matches.length} match{highlightWeek.matches.length === 1 ? "" : "es"}.
                    {highlightWeek.isFullyFinalized ? " Every match is finalized." : " Still in progress."}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 app-copy-soft">
                  No weeks are on the board yet.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Open weeks
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{openWeekCount}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Finalized weeks
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{finalizedWeekCount}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Draft matches
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        ) : null}

        {created ? (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            Match created. It is now part of the weekly board below.
          </div>
        ) : null}

        {deleted ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Match removed.
          </div>
        ) : null}

        {recalculated ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Selected draft-eligible matches recalculated.
          </div>
        ) : null}

        {markedDraftAll ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            {Number.parseInt(markedDraftAll, 10) > 0
              ? `Reopened ${markedDraftAll} saved match selection${markedDraftAll === "1" ? "" : "s"} as draft.`
              : "No saved selections needed to be reopened as draft."}
          </div>
        ) : null}

        {finalizedAll && Number.parseInt(finalizedAll, 10) > 0 ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Finalized {finalizedAll} ready match{finalizedAll === "1" ? "" : "es"}.
          </div>
        ) : null}

        {bulkFinalizeWarnings.length > 0 ? (
          <div className="rounded-2xl border border-[rgba(208,176,127,0.34)] bg-[rgba(208,176,127,0.14)] px-4 py-4 text-sm text-[var(--foreground)]">
            <p className="font-medium text-[var(--warning)]">Some selected matches still need attention.</p>
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
        <>
          <section className="app-panel rounded-[1.75rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Weekly Workflow
                </p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-50">One card per week, one batch decision at a time</h2>
              </div>
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href="/history"
              >
                Open history
              </Link>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {weekGroups.length > 0 ? (
                weekGroups.map((week) => {
                  const warningCount = week.coverage.filter((row) => row.severity === "warning").length;
                  const infoCount = week.coverage.length - warningCount;
                  const weekMatchIds = week.matches.map((match) => match.id);

                  return (
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
                            {week.matches.length} match{week.matches.length === 1 ? "" : "es"}
                          </p>
                          <p className="mt-2 text-sm app-copy-soft">
                            {warningCount} warning{warningCount === 1 ? "" : "s"} · {infoCount} info
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                            week.isFullyFinalized
                              ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                              : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                          }`}
                        >
                          {week.isFullyFinalized ? "Week finalized" : "Week in progress"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {week.matches.map((match) => (
                          <Link
                            key={match.id}
                            className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                            href={`/selection/${match.id}`}
                          >
                            <p className="text-sm font-semibold text-zinc-100">
                              {match.targetTeam.name} vs. {match.opponent}
                            </p>
                            <p className="mt-1 text-sm app-copy-soft">
                              {formatDate(match.startsAt)} · {formatMatchVenue(match.homeOrAway)}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] app-copy-muted">
                              {match.latestSelectionStatus === SelectionStatus.FINALIZED
                                ? "Finalized"
                                : match.latestSelectionStatus === SelectionStatus.DRAFT
                                  ? "Draft saved"
                                  : "Needs first draft"}
                            </p>
                          </Link>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={recalculateMatchesAction}>
                          <WeekMatchInputs matchIds={weekMatchIds} />
                          <input name="scope" type="hidden" value="selected" />
                          <button
                            className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.08)] hover:text-zinc-50"
                            type="submit"
                          >
                            Recalculate week drafts
                          </button>
                        </form>
                        <form action={finalizeMatchesAction}>
                          <WeekMatchInputs matchIds={weekMatchIds} />
                          <button
                            className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.08)] hover:text-zinc-50"
                            type="submit"
                          >
                            Finalize ready week
                          </button>
                        </form>
                        <form action={markMatchesAsDraftAction}>
                          <WeekMatchInputs matchIds={weekMatchIds} />
                          <button
                            className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.08)] hover:text-zinc-50"
                            type="submit"
                          >
                            Reopen week as draft
                          </button>
                        </form>
                      </div>

                      <div className="mt-4 rounded-2xl border app-hairline bg-[rgba(0,0,0,0.12)] px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                          Week coverage
                        </p>
                        {week.coverage.length > 0 ? (
                          <div className="mt-3 flex flex-col gap-2">
                            {week.coverage.slice(0, 3).map((row) => (
                              <div key={row.playerId} className="text-sm">
                                <p className="font-medium text-zinc-100">
                                  {row.playerName}
                                  <span className="ml-2 text-xs uppercase tracking-[0.18em] app-copy-muted">
                                    {row.severity}
                                  </span>
                                </p>
                                <p className="mt-1 leading-6 app-copy-soft">{row.reason}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm app-copy-soft">
                            No uncovered active available players for this week.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft xl:col-span-2">
                  No weekly queue yet. Create a match to start the board.
                </div>
              )}
            </div>
          </section>

          <section className="app-panel rounded-[1.75rem] p-6">
            <MatchTable
              matches={enrichedMatches.map((match) => ({
                ...match,
                deleteAction: deleteMatchAction.bind(null, match.id),
              }))}
            />
          </section>
        </>
      )}

      {create === "1" && teams.length > 0 ? <MatchCreateLayover teams={teams} /> : null}
    </main>
  );
}
