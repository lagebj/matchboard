"use client";

import { useEffect, useState } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { getPlannedPlayingTimeAction } from "@/app/(app)/matches/planned-rotation-actions";
import type { PlannedMinutesProjection } from "@/lib/planned-rotation/planned-rotation";

/**
 * Renders a player's on-pitch position history (`projectPlannedMinutesForSquad` already excludes
 * bench segments and keeps entries time-ordered) as a compact arrow-joined summary, collapsing
 * consecutive identical positions -- subbed off and later subbed back on at the same spot reads
 * as one label, not a repeated one. "—" for a player never on the pitch at all (0 planned
 * minutes, e.g. a sub who's never brought on, or every non-starter with no rotation plan
 * configured).
 */
export function formatPlannedPositionSummary(positions: Array<{ position: string }>): string {
  if (positions.length === 0) return "—";
  const labels: string[] = [];
  for (const p of positions) {
    if (labels[labels.length - 1] !== p.position) labels.push(p.position);
  }
  return labels.join(" → ");
}

type SquadPlayerRef = { playerId: string; playerName: string };

type FetchState =
  | { status: "loading" }
  | { status: "no-lineup" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: PlannedMinutesProjection[] };

/**
 * Match Detail Overview — planned playing time per squad player, per position (feature request,
 * 2026-09-24): "if rotations are planned this will be most helpful, if no rotations are
 * configured, then the starting line-up will have a generic half-length view only, starting subs
 * will have 0." Both halves of that behaviour come straight from
 * `projectPlannedMinutesForSquad` (`planned-rotation.ts`) -- this component only fetches and
 * renders its result, no domain logic of its own.
 *
 * Self-fetches on mount, the same reasoning `MatchInsights` documents for its own self-fetch: the
 * rotation plan is edited on a completely separate tab (Rotations), which fully unmounts this
 * component rather than sharing live state with it -- data threaded down from the page-load-time
 * server render would go stale the moment a coach edits the plan and switches back to Overview.
 */
export function PlannedPlayingTimePanel({
  matchId,
  teamId,
  squadPlayers,
}: {
  matchId: string;
  teamId: string;
  squadPlayers: SquadPlayerRef[];
}) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      const result = await getPlannedPlayingTimeAction(matchId, teamId);
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error", message: result.error });
      } else if (!result.hasLineup) {
        setState({ status: "no-lineup" });
      } else {
        setState({ status: "ready", rows: result.rows });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, teamId]);

  const nameById = new Map(squadPlayers.map((p) => [p.playerId, p.playerName]));

  return (
    <Surface padding="md">
      <SectionHeader
        title="Planned playing time"
        description="Minutes and position(s) each squad player is planned to be on the pitch."
      />
      <div className="mt-3">
        {state.status === "loading" && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {state.status === "error" && <p className="text-xs text-[var(--danger)]">{state.message}</p>}
        {state.status === "no-lineup" && (
          <p className="text-xs text-[var(--text-muted)]">Set a starting line-up to see planned playing time.</p>
        )}
        {state.status === "ready" && (
          <div className="flex flex-col gap-1">
            {state.rows.map((row) => (
              <div key={row.playerId} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs">
                <span className="truncate font-medium text-[var(--foreground)]">{nameById.get(row.playerId) ?? "—"}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-[var(--text-muted)]">{formatPlannedPositionSummary(row.positions)}</span>
                  <span className="w-8 text-right tabular-nums text-[var(--foreground)]">{`${Math.round(row.plannedMinutes)}'`}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}
