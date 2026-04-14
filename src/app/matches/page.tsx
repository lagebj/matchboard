import Link from "next/link";
import { SelectionStatus } from "@/generated/prisma/client";
import {
  deleteMatchAction,
  finalizeMatchesAction,
  markMatchesAsDraftAction,
  recalculateMatchesAction,
  resetSelectionsAction,
  updateMatchDevelopmentAvailabilityAction,
} from "@/app/matches/actions";
import { MatchCreateLayover } from "@/components/matches/match-create-layover";
import { MatchTable } from "@/components/matches/match-table";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekKey } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import { getSelectionMovementPlayers } from "@/lib/selection/get-selection-movement";
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
    reset?: string;
    resetCount?: string;
    saved?: string;
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

function formatResetMessage(reset?: string, resetCount?: string): string | null {
  if (!reset) {
    return null;
  }

  if (reset === "all") {
    return `Saved selections cleared across the full queue${resetCount ? ` (${resetCount} snapshot${resetCount === "1" ? "" : "s"} removed).` : "."}`;
  }

  if (reset === "week") {
    return `Saved selections cleared for the selected week${resetCount ? ` (${resetCount} snapshot${resetCount === "1" ? "" : "s"} removed).` : "."}`;
  }

  return "Saved selections cleared for the selected match.";
}

function formatSavedMessage(saved?: string): string | null {
  if (saved === "development-availability-updated") {
    return "Match development availability updated.";
  }

  return null;
}

function buildAssistantManagerNote(input: {
  draftCount: number;
  highlightWeek:
    | {
        isFullyFinalized: boolean;
        label: string;
        matches: Array<{
          latestSelectionStatus: SelectionStatus | null;
        }>;
      }
    | null;
  nextActionMatch:
    | {
        opponent: string;
        targetTeam: {
          name: string;
        };
      }
    | null;
  openWeekCount: number;
}) {
  if (!input.highlightWeek) {
    return {
      detail: "Create the first match and the week flow will appear here.",
      title: "No week is active yet.",
    };
  }

  if (input.nextActionMatch) {
    return {
      detail: `${input.highlightWeek.label} is the live lane. ${input.nextActionMatch.targetTeam.name} vs. ${input.nextActionMatch.opponent} is the next unresolved call.`,
      title: "Assistant manager says: stay with the active week.",
    };
  }

  if (input.openWeekCount > 0) {
    return {
      detail: `${input.draftCount} draft match${input.draftCount === 1 ? "" : "es"} still sit in the board. Clean those up before adding new work.`,
      title: "Assistant manager says: finish the saved drafts.",
    };
  }

  return {
    detail: `${input.highlightWeek.label} is locked. Review history or reset a week when you want a fresh restart.`,
    title: "Assistant manager says: the queue is fully locked.",
  };
}

function getMovementOwnTeamStatus(input: {
  matchId: string;
  playerId: string;
  playerById: Map<
    string,
    {
      coreTeamId: string;
      coreTeam: {
        name: string;
      };
    }
  >;
  selectedPlayerIdsByMatchId: Map<string, string[]>;
  weekMatches: Array<{
    id: string;
    latestSelectionStatus: SelectionStatus | null;
    targetTeam: {
      id: string;
      name: string;
    };
  }>;
}) {
  const player = input.playerById.get(input.playerId);

  if (!player) {
    return {
      tone: "neutral",
      text: "Own-team context unavailable",
    } as const;
  }

  const coreMatch = input.weekMatches.find((match) => match.targetTeam.id === player.coreTeamId);

  if (!coreMatch) {
    return {
      tone: "neutral",
      text: `No ${player.coreTeam.name} match this week`,
    } as const;
  }

  if (coreMatch.id === input.matchId) {
    return {
      tone: "neutral",
      text: "Own-team match",
    } as const;
  }

  if (coreMatch.latestSelectionStatus === null) {
    return {
      tone: "neutral",
      text: `${player.coreTeam.name} not saved yet`,
    } as const;
  }

  const selectedInCoreMatch =
    input.selectedPlayerIdsByMatchId.get(coreMatch.id)?.includes(input.playerId) ?? false;

  return selectedInCoreMatch
    ? {
        tone: "settled",
        text: `Still selected for ${player.coreTeam.name}`,
      }
    : {
        tone: "warning",
        text: `Left out of ${player.coreTeam.name}`,
      };
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
    reset,
    resetCount,
    saved,
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
            player: {
              select: {
                firstName: true,
                id: true,
                lastName: true,
              },
            },
            playerId: true,
            roleType: true,
            sourceTeamNameSnapshot: true,
            targetTeamNameSnapshot: true,
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
  const movementPlayersByMatchId = new Map(
    [...latestSelectionByMatchId.entries()].map(([matchId, selection]) => [
      matchId,
      getSelectionMovementPlayers(selection.players),
    ]),
  );
  const playerById = new Map(players.map((player) => [player.id, player]));

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
  const assistantManagerNote = buildAssistantManagerNote({
    draftCount,
    highlightWeek,
    nextActionMatch,
    openWeekCount,
  });
  const resetMessage = formatResetMessage(reset, resetCount);
  const savedMessage = formatSavedMessage(saved);

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
                Weekly board
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Plan the week from one board.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Keep the active week brightest, move match by match when needed, and use the ledger for cleanup only.
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
              <form action={resetSelectionsAction}>
                <input name="resetScope" type="hidden" value="all" />
                <input name="returnPath" type="hidden" value="/matches" />
                <button
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-5 text-sm font-medium text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)] hover:text-white"
                  type="submit"
                >
                  Reset all selections
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Assistant Manager
              </p>
              <p className="mt-3 text-lg font-semibold text-zinc-50">{assistantManagerNote.title}</p>
              <p className="mt-2 text-sm leading-6 app-copy-soft">{assistantManagerNote.detail}</p>
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

        {savedMessage ? (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            {savedMessage}
          </div>
        ) : null}

        {deleted ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            Match removed.
          </div>
        ) : null}

        {resetMessage ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.34)] bg-[rgba(185,128,119,0.12)] px-4 py-3 text-sm text-[#f0cbc5]">
            {resetMessage}
          </div>
        ) : null}

        {recalculated ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.045)] px-4 py-3 text-sm text-zinc-100">
            {recalculated === "all"
              ? "All current draft-eligible matches recalculated across the full queue."
              : "Selected draft-eligible matches recalculated."}
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
                <h2 className="mt-2 text-xl font-semibold text-zinc-50">One card per week</h2>
                <p className="mt-2 text-sm app-copy-soft">
                  Keep the live week brightest. Coverage, movement, and next actions stay on the same card.
                </p>
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
                weekGroups.map((week, index) => {
                  const warningCount = week.coverage.filter((row) => row.severity === "warning").length;
                  const infoCount = week.coverage.length - warningCount;
                  const weekMatchIds = week.matches.map((match) => match.id);
                  const weekMovementCount = week.matches.reduce(
                    (sum, match) => sum + (movementPlayersByMatchId.get(match.id)?.length ?? 0),
                    0,
                  );
                  const unresolvedMatch = week.matches.find(
                    (match) => match.latestSelectionStatus !== SelectionStatus.FINALIZED,
                  );
                  const cardTone = week.isFullyFinalized
                    ? "border-[rgba(140,167,146,0.26)] bg-[linear-gradient(180deg,rgba(140,167,146,0.12),rgba(17,22,31,0.82))]"
                    : index === 0
                      ? "border-[rgba(205,219,210,0.28)] bg-[linear-gradient(180deg,rgba(146,171,151,0.18),rgba(20,26,36,0.92))]"
                      : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)]";

                  return (
                    <div
                      key={week.label}
                      className={`rounded-[1.5rem] border p-4 ${cardTone}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                            {index === 0 && !week.isFullyFinalized ? "Active week" : "Weekly card"}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">{week.label}</p>
                          <p className="mt-2 text-sm app-copy-soft">
                            {unresolvedMatch
                              ? `Next call: ${unresolvedMatch.targetTeam.name} vs. ${unresolvedMatch.opponent}.`
                              : "This week is locked. Review history or reopen the week if you need another pass."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            className="inline-flex h-9 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                            href={`/weeks/${formatIsoWeekKey(week.matches[0].startsAt)}`}
                          >
                            Open week board
                          </Link>
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
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                            Matches
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">
                            {week.matches.length}
                          </p>
                        </div>
                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                            Warnings
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">{warningCount}</p>
                        </div>
                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                            Info
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">{infoCount}</p>
                        </div>
                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                            Movers
                          </p>
                          <p className="mt-2 text-lg font-semibold text-zinc-50">{weekMovementCount}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {week.matches.map((match) => (
                          <Link
                            key={match.id}
                            className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
                            href={`/selection/${match.id}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-zinc-100">
                                  {match.targetTeam.name} vs. {match.opponent}
                                </p>
                                <p className="mt-1 text-sm app-copy-soft">
                                  {formatDate(match.startsAt)} · {formatMatchVenue(match.homeOrAway)}
                                </p>
                              </div>
                              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] uppercase tracking-[0.18em] app-copy-soft">
                                {match.availableForDevelopmentSlot ? "Development open" : "Development closed"}
                              </span>
                            </div>
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

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.12)] px-4 py-4">
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

                        <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.12)] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                            Selection movement
                          </p>
                          <div className="mt-3 flex flex-col gap-3">
                            {week.matches.map((match) => {
                              const movementPlayers = movementPlayersByMatchId.get(match.id) ?? [];

                              return (
                                <div key={match.id} className="rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="font-medium text-zinc-100">
                                      {match.targetTeam.name} vs. {match.opponent}
                                    </p>
                                    <span className="text-xs uppercase tracking-[0.18em] app-copy-muted">
                                      {match.latestSelectionStatus === SelectionStatus.FINALIZED
                                        ? "Finalized"
                                        : match.latestSelectionStatus === SelectionStatus.DRAFT
                                          ? "Draft"
                                          : "No saved selection"}
                                    </span>
                                  </div>
                                  {movementPlayers.length > 0 ? (
                                    <div className="mt-3 flex flex-col gap-2">
                                      {movementPlayers.map((player) => {
                                        const ownTeamStatus = getMovementOwnTeamStatus({
                                          matchId: match.id,
                                          playerById,
                                          playerId: player.playerId,
                                          selectedPlayerIdsByMatchId,
                                          weekMatches: week.matches,
                                        });

                                        return (
                                          <div
                                            key={player.playerId}
                                            className="rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-3"
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-medium text-zinc-100">{player.playerName}</span>
                                              <span className="text-xs app-copy-soft">
                                                {player.sourceTeamName} to {player.targetTeamName}
                                              </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              <span
                                                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                                                  ownTeamStatus.tone === "warning"
                                                    ? "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                                                    : ownTeamStatus.tone === "settled"
                                                      ? "border-[rgba(140,167,146,0.24)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                                                      : "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]"
                                                }`}
                                              >
                                                {ownTeamStatus.text}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 app-copy-soft">
                                      {match.latestSelectionStatus
                                        ? "No floating players saved in this match."
                                        : "No saved draft yet."}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
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
                updateDevelopmentAvailabilityAction: updateMatchDevelopmentAvailabilityAction.bind(
                  null,
                  match.id,
                ),
              }))}
              recalculateMatchesAction={recalculateMatchesAction}
            />
          </section>
        </>
      )}

      {create === "1" && teams.length > 0 ? <MatchCreateLayover teams={teams} /> : null}
    </main>
  );
}
