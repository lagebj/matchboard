import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { RoundPlayerRow } from "./round-player-row";
import type { RoundBoardMatchLane, RoundBoardPlayerRow } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `RoundMatchLane` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §4`). Team identity via
 * `TeamKitMark`, opponent, kickoff, target/capacity, readiness state, dense squad rows.
 */
export type RoundMatchLaneProps = {
  lane: RoundBoardMatchLane;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  onDropPlayer?: (playerId: string) => void;
  onAddPlayer?: () => void;
  className?: string;
};

export function RoundMatchLane({ lane, selectedPlayerId, onSelectPlayer, onDropPlayer, onAddPlayer, className }: RoundMatchLaneProps) {
  const progressPct = lane.targetCount > 0 ? Math.min(100, Math.round((lane.squadCount / lane.targetCount) * 100)) : 0;
  const grouped: Record<string, RoundBoardPlayerRow[]> = { CORE: [], SUPPORT: [], DEVELOPMENT: [] };
  for (const p of lane.players) grouped[p.role].push(p);

  return (
    <div
      className={className}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const playerId = e.dataTransfer.getData("text/plain");
        if (playerId) onDropPlayer?.(playerId);
      }}
    >
      <TouchlineWidget padding="compact">
        <div className="flex items-center gap-2">
          <TeamKitMark color={lane.teamKitColor} size="sm" ariaLabel={`${lane.teamName} shirt`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-[700] text-[var(--foreground)]">{lane.teamName}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              vs {lane.opponent} · {lane.kickoffLabel}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-strong)]">
            Squad ({lane.squadCount})
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              lane.laneState === "COMPLETE" ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "bg-[var(--warning-subtle)] text-[var(--warning)]"
            }`}
          >
            {lane.laneStateDetail}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border-soft)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="mt-2 flex flex-col gap-0.5">
          {grouped.CORE.map((p) => (
            <RoundPlayerRow key={p.playerId} player={p} selected={p.playerId === selectedPlayerId} onSelect={onSelectPlayer} draggable />
          ))}
          {grouped.SUPPORT.length > 0 || grouped.DEVELOPMENT.length > 0 ? <div className="my-1 h-px bg-[var(--border-soft)]" /> : null}
          {[...grouped.SUPPORT, ...grouped.DEVELOPMENT].map((p) => (
            <RoundPlayerRow key={p.playerId} player={p} selected={p.playerId === selectedPlayerId} onSelect={onSelectPlayer} draggable />
          ))}
        </div>

        {onAddPlayer ? (
          <button
            type="button"
            onClick={onAddPlayer}
            className="mt-2 w-full rounded-md border border-dashed border-[var(--border-soft)] py-1.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            + Add player
          </button>
        ) : null}
      </TouchlineWidget>
    </div>
  );
}
