import Link from "next/link";
import { notFound } from "next/navigation";
import type { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { finalizeRoundAction } from "@/app/rounds/[matchRoundId]/actions";
import { CrossTeamConsequences } from "@/components/round-board/cross-team-consequences";
import { RoundBoardColumn } from "@/components/round-board/round-board-column";
import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";

type BucketKey =
  | "CORE"
  | "SUPPORT"
  | "BACKFILL"
  | "DEVELOPMENT"
  | "CONFIDENCE_REBUILD"
  | "CORE_MATCH_DROP"
  | "REDUCED_MATCH_LOAD_DROP"
  | "MANUAL_OVERRIDE";

const BUCKET_ORDER: BucketKey[] = [
  "CORE",
  "SUPPORT",
  "BACKFILL",
  "DEVELOPMENT",
  "CONFIDENCE_REBUILD",
  "CORE_MATCH_DROP",
  "REDUCED_MATCH_LOAD_DROP",
  "MANUAL_OVERRIDE",
];

const BUCKET_LABELS: Record<BucketKey, string> = {
  CORE: "Core",
  SUPPORT: "Support received",
  BACKFILL: "Backfill received",
  DEVELOPMENT: "Development",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  CORE_MATCH_DROP: "Dropped",
  REDUCED_MATCH_LOAD_DROP: "Dropped",
  MANUAL_OVERRIDE: "Manual override",
};

type RoundBoardPageProps = {
  params: Promise<{
    matchRoundId: string;
  }>;
  searchParams: Promise<{
    finalized?: string;
    error?: string;
  }>;
};

export default async function RoundBoardPage({
  params,
  searchParams,
}: RoundBoardPageProps) {
  const { matchRoundId } = await params;
  const { finalized, error } = await searchParams;

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              targetSquadSize: true,
              minAcceptedSquadSize: true,
              minSupportPlayers: true,
              developmentSlots: true,
            },
          },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      },
      warnings: {
        select: {
          id: true,
          rule: true,
          message: true,
          severity: true,
          matchId: true,
          playerId: true,
          teamId: true,
          resolved: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!matchRound) {
    notFound();
  }

  const matchIds = matchRound.matches.map((m) => m.id);

  const [selections, movementLedger, allPlayers] = await Promise.all([
    db.selection.findMany({
      where: {
        matchId: { in: matchIds },
        status: { in: ["DRAFT", "FINALIZED"] },
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            coreTeamId: true,
            nonRotatable: true,
            currentAvailability: true,
            coreTeam: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }],
    }),
    db.movementLedger.findMany({
      where: { matchRoundId },
      include: {
        player: { select: { firstName: true, lastName: true } },
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
    }),
    db.player.findMany({
      where: {
        active: true,
        removedAt: null,
        currentAvailability: {
          in: ["INJURED", "SICK", "AWAY"],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        coreTeamId: true,
        currentAvailability: true,
        coreTeam: { select: { id: true, name: true } },
      },
    }),
  ]);

  const selectionsByMatchId = new Map<string, typeof selections>();
  for (const sel of selections) {
    const existing = selectionsByMatchId.get(sel.matchId) ?? [];
    existing.push(sel);
    selectionsByMatchId.set(sel.matchId, existing);
  }

  const latestSelectionStatusByMatchId = new Map<string, SelectionStatus | null>();
  for (const sel of selections) {
    if (!latestSelectionStatusByMatchId.has(sel.matchId)) {
      latestSelectionStatusByMatchId.set(sel.matchId, sel.status);
    }
  }

  const roundLabel = matchRound.matches.length > 0
    ? formatIsoWeekLabel(matchRound.matches[0]!.startsAt)
    : matchRound.name;

  const adjacentMatchRounds = await db.matchRound.findMany({
    where: { planningPeriodId: matchRound.planningPeriodId },
    select: { id: true, name: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const currentRoundIndex = adjacentMatchRounds.findIndex((r) => r.id === matchRoundId);
  const previousMatchRoundId = currentRoundIndex > 0 ? adjacentMatchRounds[currentRoundIndex - 1]!.id : null;
  const nextMatchRoundId = currentRoundIndex >= 0 && currentRoundIndex < adjacentMatchRounds.length - 1
    ? adjacentMatchRounds[currentRoundIndex + 1]!.id
    : null;

  const unavailableByTeamId = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    const existing = unavailableByTeamId.get(p.coreTeamId) ?? [];
    existing.push(p);
    unavailableByTeamId.set(p.coreTeamId, existing);
  }

  const movedPlayers = movementLedger.map((entry) => ({
    playerId: entry.playerId,
    playerName: formatPlayerName(entry.player),
    sourceTeamId: entry.fromTeamId,
    sourceTeamName: entry.fromTeam.name,
    targetTeamId: entry.toTeamId,
    targetTeamName: entry.toTeam.name,
    role: entry.role,
  }));

  const donationCountByTeamId = new Map<string, number>();
  const backfillReceivedByTeamId = new Map<string, number>();
  for (const entry of movementLedger) {
    if (isFloatingSelectionRole(entry.role)) {
      donationCountByTeamId.set(entry.fromTeamId, (donationCountByTeamId.get(entry.fromTeamId) ?? 0) + 1);
      if (entry.role === "BACKFILL") {
        backfillReceivedByTeamId.set(entry.toTeamId, (backfillReceivedByTeamId.get(entry.toTeamId) ?? 0) + 1);
      }
    }
  }

  const backfillNeeds = matchRound.matches.map((match) => {
    const donated = donationCountByTeamId.get(match.teamId) ?? 0;
    const received = backfillReceivedByTeamId.get(match.teamId) ?? 0;
    return {
      teamId: match.teamId,
      teamName: match.team.name,
      donatedPlayerCount: donated,
      needsBackfill: donated > received,
      backfillReceivedCount: received,
    };
  });

  const unresolvedWarnings = matchRound.warnings.filter((w) => !w.resolved);

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Round Board
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                {roundLabel}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${matchRound.status === "FINALIZED" ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]" : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"}`}
              >
                {matchRound.status === "FINALIZED" ? "Finalized" : "Draft"}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Plan the round from one board.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Each team match is a column. Players are grouped by role bucket. See cross-team consequences at a glance.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/matches"
              >
                Back to matches
              </Link>
              {previousMatchRoundId && (
                <Link
                  className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href={`/rounds/${previousMatchRoundId}`}
                >
                  Previous round
                </Link>
              )}
              {nextMatchRoundId && (
                <Link
                  className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                  href={`/rounds/${nextMatchRoundId}`}
                >
                  Next round
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Round summary
              </p>
              <p className="mt-3 text-lg font-semibold text-zinc-50">
                {matchRound.matches.length} match{matchRound.matches.length !== 1 ? "es" : ""}
              </p>
              <p className="mt-2 text-sm app-copy-soft">
                {selections.length} selections &middot; {movedPlayers.length} mover{movedPlayers.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Unresolved warnings</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{unresolvedWarnings.length}</p>
              </div>
              <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Cross-team movers</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{movedPlayers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
          {error}
        </div>
      )}

      {finalized && (
        <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
          Round finalized.
        </div>
      )}

      {unresolvedWarnings.length > 0 && (
        <section className="rounded-[1.5rem] border border-[rgba(208,176,127,0.18)] bg-[rgba(208,176,127,0.06)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning)]">
            Round-level warnings
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {unresolvedWarnings.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-[rgba(208,176,127,0.14)] bg-[rgba(0,0,0,0.1)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] ${w.severity === "HARD_BLOCK" ? "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.14)] text-[var(--danger)]" : w.severity === "REQUIRES_OVERRIDE" ? "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.1)] text-[var(--warning)]" : "border app-hairline bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]"}`}
                  >
                    {w.severity}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.12em] app-copy-muted">
                    {w.rule}
                  </span>
                </div>
                <p className="mt-1 text-sm app-copy-soft">{w.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <CrossTeamConsequences
        backfillNeeds={backfillNeeds}
        movedPlayers={movedPlayers}
      />

      <section className="app-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Team Columns
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">
              One column per team match, grouped by role bucket
            </h2>
            <p className="mt-2 text-sm app-copy-soft">
              See cross-team consequences at a glance. Each column shows core, support, backfill, development, drops, and unavailable players.
            </p>
          </div>
          {matchRound.status === "DRAFT" && (
            <div className="flex flex-wrap gap-2">
              <form action={finalizeRoundAction}>
                <input name="matchRoundId" type="hidden" value={matchRoundId} />
                <button
                  className="inline-flex h-10 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  type="submit"
                >
                  Finalize round
                </button>
              </form>
            </div>
          )}
        </div>

        {matchRound.matches.length === 0 ? (
          <div className="mt-6 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            No matches in this round yet.
          </div>
        ) : (
          <div className="mt-6 -mx-2 overflow-x-auto px-2 pb-2">
            <div
              className="flex gap-4"
              style={{ minWidth: `${Math.max(matchRound.matches.length * 22, 44)}rem` }}
            >
              {matchRound.matches.map((match) => {
                const matchSels = (selectionsByMatchId.get(match.id) ?? [])
                  .filter((s) => {
                    const explanation = (s.explanation ?? {}) as Record<string, unknown>;
                    return explanation.manuallyRemoved !== true;
                  });

                const buckets = new Map<BucketKey, typeof matchSels>();
                for (const sel of matchSels) {
                  const key = sel.role as BucketKey;
                  const existing = buckets.get(key) ?? [];
                  existing.push(sel);
                  buckets.set(key, existing);
                }

                const selectedCount = matchSels.length;
                const supportCount = matchSels.filter(
                  (s) => s.role === "SUPPORT" || s.role === "BACKFILL",
                ).length;

                const matchWarnings = unresolvedWarnings.filter(
                  (w) => w.matchId === match.id || w.teamId === match.teamId,
                );

                const unavailableForTeam = unavailableByTeamId.get(match.teamId) ?? [];

                const bucketGroups: Array<{
                  key: BucketKey;
                  label: string;
                  players: Array<{
                    id: string;
                    firstName: string;
                    lastName: string | null;
                    primaryPosition: string;
                    coreTeamId: string;
                    coreTeamName: string;
                    role: SelectionRole;
                    explanation?: string | null;
                    currentAvailability?: string;
                    nonRotatable?: boolean;
                  }>;
                }> = [];

                for (const key of BUCKET_ORDER) {
                  const bucketSels = buckets.get(key) ?? [];
                  const label = BUCKET_LABELS[key];

                  if (key === "CORE_MATCH_DROP") {
                    const droppedPlayers = bucketSels.map((s) => ({
                      id: s.player.id,
                      firstName: s.player.firstName,
                      lastName: s.player.lastName,
                      primaryPosition: s.player.primaryPosition,
                      coreTeamId: s.player.coreTeamId,
                      coreTeamName: s.player.coreTeam.name,
                      role: s.role,
                      explanation: (s.explanation as Record<string, unknown>)?.summary as string ?? null,
                      currentAvailability: s.player.currentAvailability,
                      nonRotatable: s.player.nonRotatable,
                    }));

                    const unavailablePlayers = unavailableForTeam
                      .filter((up) => !droppedPlayers.some((dp) => dp.id === up.id))
                      .map((p) => ({
                        id: p.id,
                        firstName: p.firstName,
                        lastName: p.lastName,
                        primaryPosition: "",
                        coreTeamId: p.coreTeamId,
                        coreTeamName: p.coreTeam.name,
                        role: "CORE_MATCH_DROP" as SelectionRole,
                        explanation: `Unavailable: ${p.currentAvailability}`,
                        currentAvailability: p.currentAvailability,
                        nonRotatable: false,
                      }));

                    const allPlayers = [...droppedPlayers, ...unavailablePlayers];
                    if (allPlayers.length > 0) {
                      bucketGroups.push({ key, label: "Dropped", players: allPlayers });
                    }
                    continue;
                  }

                  if (bucketSels.length > 0) {
                    bucketGroups.push({
                      key,
                      label,
                      players: bucketSels.map((s) => ({
                        id: s.player.id,
                        firstName: s.player.firstName,
                        lastName: s.player.lastName,
                        primaryPosition: s.player.primaryPosition,
                        coreTeamId: s.player.coreTeamId,
                        coreTeamName: s.player.coreTeam.name,
                        role: s.role,
                        explanation: (s.explanation as Record<string, unknown>)?.summary as string ?? null,
                        currentAvailability: s.player.currentAvailability,
                        nonRotatable: s.player.nonRotatable,
                      })),
                    });
                  }
                }

                if (unavailableForTeam.length > 0 && !bucketGroups.some((bg) => bg.key === "CORE_MATCH_DROP")) {
                  bucketGroups.push({
                    key: "CORE_MATCH_DROP",
                    label: "Unavailable",
                    players: unavailableForTeam.map((p) => ({
                      id: p.id,
                      firstName: p.firstName,
                      lastName: p.lastName,
                      primaryPosition: "",
                      coreTeamId: p.coreTeamId,
                      coreTeamName: p.coreTeam.name,
                      role: "CORE_MATCH_DROP" as SelectionRole,
                      explanation: `Unavailable: ${p.currentAvailability}`,
                      currentAvailability: p.currentAvailability,
                      nonRotatable: false,
                    })),
                  });
                }

                return (
                  <RoundBoardColumn
                    buckets={bucketGroups}
                    gameFormat={match.gameFormat}
                    homeAway={match.homeAway}
                    key={match.id}
                    latestSelectionStatus={latestSelectionStatusByMatchId.get(match.id) ?? null}
                    matchId={match.id}
                    matchRoundStatus={matchRound.status}
                    minAcceptedSquadSize={match.team.minAcceptedSquadSize}
                    opponent={match.opponent}
                    selectedCount={selectedCount}
                    squadSize={match.squadSize}
                    startsAt={match.startsAt}
                    supportCount={supportCount}
                    targetSquadSize={match.team.targetSquadSize}
                    teamName={match.team.name}
                    warnings={matchWarnings.map((w) => ({
                      rule: w.rule,
                      message: w.message,
                      severity: w.severity,
                    }))}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}