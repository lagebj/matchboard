"use client";

import { useEffect, useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import { getRotationVsActualAction } from "@/app/(app)/matches/rotation-vs-actual-actions";
import type { MinuteDeviation, RotationVsActualSummary } from "@/lib/planned-rotation/rotation-vs-actual";

type FetchState =
  | { status: "loading" }
  | { status: "no-plan" }
  | { status: "error"; message: string }
  | { status: "ready"; summary: RotationVsActualSummary };

function formatPositions(positions: string[]): string {
  return positions.length > 0 ? positions.join(" → ") : "—";
}

function formatMinutes(minutes: number | null): string {
  return minutes == null ? "Unknown" : `${Math.round(minutes)}′`;
}

/**
 * Bar row for one player: planned exposure vs. recorded actual exposure
 * (`08_COMPLETED_MATCH.md` "Plan vs reality"). Bars are lengths for exact recorded values, never
 * a rating/score -- scaled against the match's own total duration so every row shares one honest
 * denominator. An unknown actual (no closed `ActualPositionInterval`, e.g. an open/incomplete
 * interval) renders no actual bar at all and says "Unknown" rather than guessing a length.
 */
function MinuteDeviationRow({ row, totalMatchSeconds }: { row: MinuteDeviation; totalMatchSeconds: number | null }) {
  const totalMinutes = totalMatchSeconds ? totalMatchSeconds / 60 : null;
  const plannedPct = totalMinutes ? Math.min(100, (row.plannedMinutes / totalMinutes) * 100) : 0;
  const realisedPct = totalMinutes && row.realisedMinutes != null ? Math.min(100, (row.realisedMinutes / totalMinutes) * 100) : 0;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{row.playerName}</span>
        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
          {formatPositions(row.plannedPositions)} vs {formatPositions(row.realisedPositions)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Planned</span>
        <div className="h-1.5 flex-1 rounded-full bg-[var(--surface-sunken)]">
          <div className="h-1.5 rounded-full bg-[var(--text-muted)]" style={{ width: `${plannedPct}%` }} />
        </div>
        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--foreground)]">{formatMinutes(row.plannedMinutes)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Actual</span>
        <div className="h-1.5 flex-1 rounded-full bg-[var(--surface-sunken)]">
          {row.realisedMinutes != null && <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${realisedPct}%` }} />}
        </div>
        <span
          className={cn(
            "w-12 shrink-0 text-right text-[11px] tabular-nums",
            row.realisedMinutes == null ? "text-[var(--text-muted)]" : "text-[var(--foreground)]",
          )}
        >
          {formatMinutes(row.realisedMinutes)}
        </span>
      </div>
    </div>
  );
}

/**
 * Completed Match "Plan vs reality" (ADR-0157 C6): planned minutes/positions come from
 * `getPlannedMinutesProjectionForMatch()` (the required correction — never the previous
 * hardcoded zero), actual minutes/positions come only from `ActualPositionInterval` (ARR-0052).
 * Self-fetches, same reasoning as `PlannedPlayingTimePanel`.
 */
export function PlanVsRealityPanel({ matchId, teamId }: { matchId: string; teamId: string }) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      const result = await getRotationVsActualAction(matchId, teamId);
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error", message: result.error });
      } else if (!result.summary || result.summary.minuteDeviations.length === 0) {
        setState({ status: "no-plan" });
      } else {
        setState({ status: "ready", summary: result.summary });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, teamId]);

  return (
    <Surface padding="md">
      <SectionHeader title="Plan vs reality" description="Planned minutes/position compared with recorded actual exposure." />
      <div className="mt-2">
        {state.status === "loading" && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {state.status === "error" && <p className="text-xs text-[var(--danger)]">{state.message}</p>}
        {state.status === "no-plan" && (
          <p className="text-xs text-[var(--text-muted)]">No line-up or planned rotation recorded for this match.</p>
        )}
        {state.status === "ready" && (
          <div className="flex flex-col divide-y divide-[var(--border-soft)]">
            {state.summary.minuteDeviations.map((row) => (
              <MinuteDeviationRow key={row.playerId} row={row} totalMatchSeconds={state.summary.totalMatchSeconds} />
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}
