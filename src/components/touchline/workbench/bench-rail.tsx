import { cn } from "@/lib/cn";
import { PitchPlayerToken, type PitchPlayerTokenStatus } from "@/components/touchline/pitch/pitch-player-token";

/**
 * BenchRail (Touchline Finish & Visual Convergence follow-up,
 * `03_CODE_CHANGE_MAP.md §H`) — a horizontal scrollable rail of bench /
 * candidate players, directly adjacent to the pitch on both compact and
 * desktop lineup/tactics surfaces (`06_TACTICS_LINEUP_AND_PITCH.md §6 §7`).
 * Reuses `PitchPlayerToken` so the bench and the pitch share one player
 * representation.
 */
export type BenchRailPlayer = {
  id: string;
  name: string;
  role?: string;
  number?: string | number | null;
  status?: PitchPlayerTokenStatus;
};

type Props = {
  players: BenchRailPlayer[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  emptyLabel?: string;
};

export function BenchRail({ players, selectedId, onSelect, className, emptyLabel = "No players" }: Props) {
  if (players.length === 0) {
    return <p className={cn("text-[13px] text-[var(--text-muted)]", className)}>{emptyLabel}</p>;
  }
  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {players.map((p) => (
        <PitchPlayerToken
          key={p.id}
          name={p.name}
          role={p.role}
          number={p.number}
          status={p.status}
          selected={p.id === selectedId}
          onClick={onSelect ? () => onSelect(p.id) : undefined}
          compact
          className="shrink-0"
        />
      ))}
    </div>
  );
}
