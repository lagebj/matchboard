export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { deriveRoundStatus } from "@/lib/round-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { MatchTable } from "@/components/matches/match-table";

type MatchesPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

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
      matchRound: {
        select: {
          name: true,
          status: true,
          warnings: {
            where: { resolved: false },
            select: { severity: true, matchId: true },
          },
        },
      },
      selections: {
        where: { status: { in: ["DRAFT", "FINALIZED"] } },
        select: { status: true },
      },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  type MatchItem = typeof matches[number];
  const matchesByRound = new Map<string, { roundName: string; roundStatus: string; matches: MatchItem[] }>();
  const ungrouped: MatchItem[] = [];

  for (const match of matches) {
    const roundId = match.matchRoundId;
    if (!roundId) {
      ungrouped.push(match);
      continue;
    }
    const existing = matchesByRound.get(roundId);
    if (existing) {
      existing.matches.push(match);
    } else {
      matchesByRound.set(roundId, {
        roundName: match.matchRound?.name ?? roundId,
        roundStatus: match.matchRound?.status ?? "DRAFT",
        matches: [match],
      });
    }
  }

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
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {saved === "created" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Match created.</div>
      )}
      {saved === "deleted" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Match removed.</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Matches · {matches.length}</p>
        {teams.length > 0 && (
          <Link
            href="/matches/new"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
          >
            Add match
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
          <p className="text-sm font-medium text-zinc-200">No teams yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create a team before adding matches.</p>
          <Link href="/teams/new" className="mt-2 inline-flex h-7 items-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20">
            Create team
          </Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
          <p className="text-sm font-medium text-zinc-200">No matches yet</p>
          <p className="mt-1 text-xs text-zinc-400">Register match details for each team.</p>
          <Link href="/matches/new" className="mt-2 inline-flex h-7 items-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20">
            Add match
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {[...matchesByRound.entries()].map(([roundId, { roundName, roundStatus, matches: roundMatches }]) => {
              const firstMatch = roundMatches[0];
              const roundWarnings = firstMatch?.matchRound?.warnings ?? [];
              const blockingCount = roundWarnings.filter((w) => w.severity === "HARD_BLOCK").length;
              const derivedStatus = deriveRoundStatus({
                dbStatus: roundStatus,
                hasDraftSelections: roundMatches.some((m) => m.selections.some((s) => s.status === "DRAFT")),
                hasMatches: roundMatches.length > 0,
                blockingWarningCount: blockingCount,
              });

              return (
                <div key={roundId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/rounds/${roundId}`} className="text-xs font-semibold text-zinc-300 hover:text-zinc-100">
                        {roundName}
                      </Link>
                      <StatusBadge status={derivedStatus} />
                    </div>
                    <Link
                      href={`/rounds/${roundId}`}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
                    >
                      Open round
                    </Link>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {roundMatches.map((match) => {
                      const draftCount = match.selections.filter((s) => s.status === "DRAFT").length;
                      const matchWarnings = (match.matchRound?.warnings ?? []).filter((w) => w.matchId === match.id);
                      const warningCount = matchWarnings.length;
                      return (
                        <Link
                          key={match.id}
                          href={`/matches/${match.id}`}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-200">{match.team.name} vs {match.opponent}</span>
                            <span className="text-zinc-600">{match.homeAway === "HOME" ? "H" : "A"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {draftCount > 0 && <span className="text-[10px] text-zinc-400">{draftCount} sel</span>}
                            {warningCount > 0 && <span className="text-[10px] text-amber-400">{warningCount}w</span>}
                            <span className="text-zinc-500">{formatDate(match.startsAt)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Ungrouped</p>
                {ungrouped.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-800/40"
                  >
                    <span className="text-zinc-200">{match.team.name} vs {match.opponent}</span>
                    <span className="text-zinc-500">{formatDate(match.startsAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Full table
            </summary>
            <div className="mt-2">
              <MatchTable matches={matchRows} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}