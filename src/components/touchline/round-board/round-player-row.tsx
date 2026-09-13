import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import type { RoundBoardPlayerRow, RoundPlayerRole } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `RoundPlayerRow` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §4`) — dense squad row, no
 * per-player card wrapper (contract's own explicit instruction).
 */
export type RoundPlayerRowProps = {
  player: RoundBoardPlayerRow;
  selected?: boolean;
  onSelect: (playerId: string) => void;
  /** Desktop drag accelerator — optional, never required to complete the workflow (contract §3). */
  draggable?: boolean;
  onDragStart?: (playerId: string) => void;
  className?: string;
};

const ROLE_LABEL: Record<RoundPlayerRole, string> = { CORE: "Core", SUPPORT: "Support", DEVELOPMENT: "Development" };

export function RoundPlayerRow({ player, selected, onSelect, draggable, onDragStart, className }: RoundPlayerRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(player.playerId)}
      draggable={draggable}
      onDragStart={() => onDragStart?.(player.playerId)}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors ${
        selected ? "bg-[var(--tl-pitch-selected)]" : "hover:bg-[var(--surface-hover)]"
      } ${className ?? ""}`}
    >
      <TeamKitMark color={player.kitColor} number={player.shirtNumber} size="xs" ariaLabel={`${player.displayName}'s shirt`} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-[600] text-[var(--foreground)]">{player.displayName}</span>
      <span className="w-8 shrink-0 text-[11px] text-[var(--text-muted)]">{player.position ?? "—"}</span>
      <span className="shrink-0 rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
        {ROLE_LABEL[player.role]}
      </span>
      {player.attention ? (
        <span title="Needs attention" className="shrink-0">
          {/* Visually-hidden text, not aria-label — aria-label is prohibited on a span with no
              role (axe `aria-prohibited-attr`, WCAG 4.1.2). */}
          <span className="sr-only">Needs attention</span>
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        </span>
      ) : null}
    </button>
  );
}
