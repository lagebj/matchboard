"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { FixturesOverview, FixturePeriod, FixtureRound, FixtureMatch } from "@/domain/fixtures/types";
import { fetchFixturesOverview } from "@/domain/fixtures/actions";
import { getReadinessClasses } from "@/domain/assistant-manager/utils/issue-grouping";

function readinessLabel(state?: string): string {
  switch (state) {
    case "NOT_PLAYABLE": return "Not playable";
    case "AT_RISK": return "At risk";
    case "WATCH": return "Watch";
    case "READY": return "Ready";
    default: return "—";
  }
}

function ReadinessBadge({ state }: { state?: string }) {
  if (!state || state === "READY") return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${getReadinessClasses(state)}`}>
      {readinessLabel(state)}
    </span>
  );
}

function MatchRow({ match }: { match: FixtureMatch }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-zinc-200 truncate">{match.title}</span>
        {match.venue && <span className="text-[10px] text-zinc-500">{match.venue}</span>}
        {match.startsAt && (
          <span className="text-[10px] text-zinc-500">{new Date(match.startsAt).toLocaleDateString()}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ReadinessBadge state={match.readinessState} />
        {typeof match.selectedPlayerCount === "number" && (
          <span className="text-[10px] text-zinc-500">{match.selectedPlayerCount} selected</span>
        )}
        {match.unresolvedIssueCount > 0 && (
          <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">{match.unresolvedIssueCount} issue{match.unresolvedIssueCount !== 1 ? "s" : ""}</span>
        )}
        {match.postMatchStatus === "COMPLETED" && (
          <span className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Reported</span>
        )}
        <Link href={`/matches/${match.id}/review`} className="text-[10px] text-zinc-400 hover:text-zinc-200">
          Review
        </Link>
        <Link href={`/matches/${match.id}/post-match`} className="text-[10px] text-zinc-400 hover:text-zinc-200">
          Post-match
        </Link>
      </div>
    </div>
  );
}

function RoundSection({ round }: { round: FixtureRound }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{round.title}</span>
          <ReadinessBadge state={round.readinessState} />
          {round.published && <span className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Finalized</span>}
          {!round.generated && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">Not generated</span>}
        </div>
        <div className="flex items-center gap-2">
          {round.unresolvedIssueCount > 0 && (
            <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">{round.unresolvedIssueCount} issue{round.unresolvedIssueCount !== 1 ? "s" : ""}</span>
          )}
          <Link href={`/rounds/${round.id}/review`} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700">
            Open round review
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        {round.matches.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">No matches in this round.</p>
        ) : (
          round.matches.map((match) => <MatchRow key={match.id} match={match} />)
        )}
      </div>
    </div>
  );
}

function PeriodSection({ period }: { period: FixturePeriod }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-100">{period.title}</h2>
          {period.dateRange && <span className="text-xs text-zinc-500">{period.dateRange}</span>}
          <ReadinessBadge state={period.readinessState} />
        </div>
        {period.unresolvedIssueCount > 0 && (
          <span className="rounded bg-amber-900/30 px-2 py-0.5 text-[10px] text-amber-300">
            {period.unresolvedIssueCount} unresolved issue{period.unresolvedIssueCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {period.rounds.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">No rounds in this period.</p>
        ) : (
          period.rounds.map((round) => <RoundSection key={round.id} round={round} />)
        )}
      </div>
    </div>
  );
}

export function FixturesPage() {
  const [data, setData] = useState<FixturesOverview | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchFixturesOverview();
      setData(result);
    });
  }, [startTransition]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Fixtures</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Plan rounds, review matches, and follow up after games.</p>
      </div>

      {isPending && !data ? (
        <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-500">
          Loading fixtures...
        </div>
      ) : !data || data.periods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No planning periods found.</p>
          <p className="text-xs text-zinc-500">Create a season and planning period to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {data.periods.map((period) => <PeriodSection key={period.id} period={period} />)}
        </div>
      )}
    </div>
  );
}