"use client";

import Link from "next/link";
import type { OpponentHistoryData } from "@/lib/audit/opponent-history";
import { PREVIOUS_ENCOUNTERS_DISCLAIMER } from "@/lib/opponents/observation-labels";

type Props = {
  history: OpponentHistoryData | null;
  concernCount: number;
  latestConcernDate: string | null;
  opponentTeamId: string;
};

function formatResult(result: "won" | "drawn" | "lost" | null): string {
  if (result === "won") return "W";
  if (result === "drawn") return "D";
  if (result === "lost") return "L";
  return "—";
}

function resultColour(result: "won" | "drawn" | "lost" | null): string {
  if (result === "won") return "text-emerald-400";
  if (result === "lost") return "text-red-400";
  if (result === "drawn") return "text-zinc-400";
  return "text-zinc-500";
}

function formatScore(homeGoals: number | null, awayGoals: number | null): string {
  if (homeGoals === null || awayGoals === null) return "—";
  return `${homeGoals}–${awayGoals}`;
}

export function PreviousEncountersDisplay({ history, concernCount, latestConcernDate, opponentTeamId }: Props) {
  if (!history || history.matches.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">Previous encounters</h3>
        <p className="text-sm text-zinc-400">No previous encounters with this opponent.</p>
      </div>
    );
  }

  const recentMatches = history.matches.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-50">Previous encounters</h3>
        <Link
          href={`/opponents/${opponentTeamId}`}
          className="text-sm text-[var(--accent-strong)] hover:underline"
        >
          View encounter history
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Played</p>
          <p className="text-zinc-100 font-medium">{history.totalPlayed}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Record</p>
          <p className="text-zinc-100 font-medium">
            <span className="text-emerald-400">{history.totalWon}W</span>
            <span className="text-zinc-500 mx-0.5">–</span>
            <span className="text-zinc-400">{history.totalDrawn}D</span>
            <span className="text-zinc-500 mx-0.5">–</span>
            <span className="text-red-400">{history.totalLost}L</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Goals for/against</p>
          <p className="text-zinc-100 font-medium">{history.goalsFor}–{history.goalsAgainst}</p>
        </div>
        {concernCount > 0 && (
          <div>
            <p className="text-xs text-zinc-500">Environment concerns</p>
            <p className="text-amber-400 font-medium">{concernCount}{latestConcernDate ? ` · ${latestConcernDate}` : ""}</p>
          </div>
        )}
      </div>

      {recentMatches.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Recent matches</p>
          {recentMatches.map((m) => (
            <Link
              key={m.matchId}
              href={`/matches/${m.matchId}`}
              className="flex items-center justify-between text-sm border-b border-[var(--border-soft)] pb-2 last:border-b-0 last:pb-0 hover:bg-[var(--surface-hover)] rounded-md px-1.5 -mx-1.5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-bold w-5 text-center shrink-0 ${resultColour(m.result)}`}>
                  {formatResult(m.result)}
                </span>
                <span className="text-zinc-400 shrink-0">{m.matchDate ? new Date(m.matchDate).toLocaleDateString() : "—"}</span>
                <span className="text-zinc-200 truncate">{m.teamName}</span>
                <span className="text-zinc-500 shrink-0">{m.homeAway === "HOME" ? "H" : "A"}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-zinc-300 tabular-nums">{formatScore(m.homeGoals, m.awayGoals)}</span>
                {m.isCancelled && <span className="text-xs text-zinc-500">Cancelled</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500 italic">
        {PREVIOUS_ENCOUNTERS_DISCLAIMER}
      </p>
    </div>
  );
}