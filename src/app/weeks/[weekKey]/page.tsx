import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectionStatus } from "@/generated/prisma/client";
import { WeekOverviewBoard } from "@/components/weeks/week-overview-board";
import { db } from "@/lib/db";
import { formatIsoWeekKey, formatIsoWeekLabel, getWeekRangeFromIsoWeekKey } from "@/lib/date-utils";
import { getSelectionMovementPlayers } from "@/lib/selection/get-selection-movement";

type WeekOverviewPageProps = {
  params: Promise<{
    weekKey: string;
  }>;
  searchParams: Promise<{
    error?: string;
    savedMatchId?: string;
    savedStatus?: string;
  }>;
};

function formatSavedMessage(savedStatus?: string): string | null {
  if (savedStatus === "final") {
    return "Week board update saved and finalized.";
  }

  if (savedStatus === "draft") {
    return "Week board draft saved.";
  }

  return null;
}

export default async function WeekOverviewPage({
  params,
  searchParams,
}: WeekOverviewPageProps) {
  const [{ weekKey }, { error, savedMatchId, savedStatus }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { startsAt, endsAt } = getWeekRangeFromIsoWeekKey(weekKey);

  const [matches, teams, players] = await Promise.all([
    db.match.findMany({
      where: {
        startsAt: {
          gte: startsAt,
          lte: endsAt,
        },
      },
      include: {
        targetTeam: {
          select: {
            developmentTargetRelationships: {
              include: {
                sourceTeam: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            id: true,
            minSupportPlayers: true,
            name: true,
            supportTargetRelationships: {
              include: {
                sourceTeam: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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
  ]);

  if (matches.length === 0) {
    notFound();
  }

  const selections = await db.matchSelection.findMany({
    where: {
      matchId: {
        in: matches.map((match) => match.id),
      },
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              firstName: true,
              id: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { finalizedAt: "desc" }],
  });

  const latestSelectionByMatchId = new Map<string, (typeof selections)[number]>();

  for (const selection of selections) {
    if (!latestSelectionByMatchId.has(selection.matchId)) {
      latestSelectionByMatchId.set(selection.matchId, selection);
    }
  }

  const weekLabel = formatIsoWeekLabel(matches[0].startsAt);
  const returnPath = `/weeks/${formatIsoWeekKey(matches[0].startsAt)}`;
  const weekMatches = matches.map((match) => {
    const latestSelection = latestSelectionByMatchId.get(match.id) ?? null;

    return {
      ...match,
      latestSelection,
      movementPlayers: latestSelection ? getSelectionMovementPlayers(latestSelection.players) : [],
    };
  });
  const groupedPlayers = teams
    .map((team) => ({
      players: players.filter((player) => player.coreTeamId === team.id),
      team,
    }))
    .filter((group) => group.players.length > 0);
  const finalizedMatchCount = weekMatches.filter(
    (match) => match.latestSelection?.status === SelectionStatus.FINALIZED,
  ).length;
  const movementCount = weekMatches.reduce((sum, match) => sum + match.movementPlayers.length, 0);
  const savedMatch = savedMatchId
    ? weekMatches.find((match) => match.id === savedMatchId) ?? null
    : null;

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Week Overview
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                {weekLabel}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Work the whole week without bouncing match to match.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Keep the queue for scanning. Use this board when you want the week side by side.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/matches"
              >
                Back to match queue
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Week status
              </p>
              <p className="mt-3 text-lg font-semibold text-zinc-50">
                {finalizedMatchCount} / {weekMatches.length} finalized
              </p>
              <p className="mt-2 text-sm app-copy-soft">
                {weekMatches.length - finalizedMatchCount} match
                {weekMatches.length - finalizedMatchCount === 1 ? "" : "es"} still open.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Matches
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{weekMatches.length}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  Movers
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{movementCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[#f0cbc5]">
          {error}
        </div>
      ) : null}

      {formatSavedMessage(savedStatus) ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {formatSavedMessage(savedStatus)}
          {savedMatch ? ` ${savedMatch.targetTeam.name} vs. ${savedMatch.opponent}.` : ""}
        </div>
      ) : null}

      <WeekOverviewBoard
        groupedPlayers={groupedPlayers}
        matches={weekMatches}
        returnPath={returnPath}
        weekLabel={weekLabel}
      />
    </main>
  );
}
