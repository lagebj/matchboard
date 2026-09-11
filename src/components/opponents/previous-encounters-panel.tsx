import { db } from "@/lib/db";
import Link from "next/link";
import { PREVIOUS_ENCOUNTERS_DISCLAIMER } from "@/lib/opponents/observation-labels";
import { getOpponentHistory } from "@/lib/audit/opponent-history";
import { formatKickoffDate } from "@/lib/date-utils";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

type Props = {
  opponentTeamId: string;
  footballGroupId: string;
  orgFilter: OrgFilterMode;
};

export async function PreviousEncountersPanel({ opponentTeamId, footballGroupId, orgFilter }: Props) {
  const history = await getOpponentHistory(opponentTeamId, footballGroupId, orgFilter);

  if (!history || history.matches.length === 0) {
    return (
      <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-5 space-y-3">
        <h3 className="text-base font-semibold text-[var(--foreground)]">Previous encounters</h3>
        <p className="text-sm text-[var(--text-muted)]">No previous encounters with this opponent.</p>
      </div>
    );
  }

  const concernCount = await db.opponentEncounterObservation.count({
    where: {
      opponentTeamId,
      overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] },
    },
  });

  const latestConcern = await db.opponentEncounterObservation.findFirst({
    where: {
      opponentTeamId,
      overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const recentMatches = history.matches.slice(0, 5);

  function formatResult(result: "won" | "drawn" | "lost" | null): string {
    if (result === "won") return "W";
    if (result === "drawn") return "D";
    if (result === "lost") return "L";
    return "—";
  }

  // Weight, not colour, is the outcome cue (ADR-0130) — a loss is not danger red, a win is not
  // a success fill. Mirrors match-presentation.tsx's own outcomeTint pairing.
  function resultColour(result: "won" | "drawn" | "lost" | null): string {
    if (result === "won") return "text-[var(--foreground)]";
    if (result === "lost") return "text-[var(--text-muted)] font-medium";
    if (result === "drawn") return "text-[var(--text-soft)]";
    return "text-[var(--text-muted)]";
  }

  function formatScore(match: { homeGoals: number | null; awayGoals: number | null; homeAway: string; result: "won" | "drawn" | "lost" | null }): string {
    if (match.homeGoals === null || match.awayGoals === null) return "—";
    return `${match.homeGoals}–${match.awayGoals}`;
  }

  return (
    <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--foreground)]">Previous encounters</h3>
        <Link
          href={`/opponents/${opponentTeamId}`}
          className="text-sm text-[var(--accent-strong)] hover:underline"
        >
          View encounter history
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Played</p>
          <p className="text-[var(--foreground)] font-medium">{history.totalPlayed}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Record</p>
          <p className="text-[var(--foreground)] font-medium">
            <span>{history.totalWon}W</span>
            <span className="text-[var(--text-muted)] mx-0.5">–</span>
            <span className="text-[var(--text-soft)]">{history.totalDrawn}D</span>
            <span className="text-[var(--text-muted)] mx-0.5">–</span>
            <span className="text-[var(--text-muted)]">{history.totalLost}L</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Goals for/against</p>
          <p className="text-[var(--foreground)] font-medium">{history.goalsFor}–{history.goalsAgainst}</p>
        </div>
        {concernCount > 0 && (
          <div>
            <p className="text-xs text-[var(--text-muted)]">Environment concerns</p>
            <p className="text-[var(--warning)] font-medium">{concernCount}{latestConcern && ` · ${latestConcern.createdAt.toLocaleDateString()}`}</p>
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
                <span className="text-[var(--text-muted)] shrink-0">{m.matchDate ? formatKickoffDate(m.matchDate) : "—"}</span>
                <span className="text-[var(--foreground)] truncate">{m.teamName}</span>
                <span className="text-[var(--text-muted)] shrink-0">{m.homeAway === "HOME" ? "H" : "A"}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[var(--text-soft)] tabular-nums">{formatScore(m)}</span>
                {m.isCancelled && <span className="text-xs text-[var(--text-muted)]">Cancelled</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] italic">
        {PREVIOUS_ENCOUNTERS_DISCLAIMER}
      </p>
    </div>
  );
}