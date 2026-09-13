import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import type { PlayersOverviewRow } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * `PlayerRosterTable` (Atlas Follow-up, `03_PLAYER_OVERVIEW_CONTRACT.md §3`). The dense
 * roster/table half of the desktop Overview mode (~9/12 columns; the selected-player inspector
 * takes the remaining ~3/12 — composed at the page level, not owned by this component). Columns
 * intentionally limited (contract's own instruction) — internal player rating is never the
 * dominant ordering/comparison dimension.
 */
export type PlayerRosterTableProps = {
  rows: PlayersOverviewRow[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  className?: string;
};

export function PlayerRosterTable({ rows, selectedPlayerId, onSelectPlayer, className }: PlayerRosterTableProps) {
  return (
    // tabIndex={0} — the horizontal scroll container must be keyboard-focusable (axe
    // `scrollable-region-focusable`, WCAG 2.1.1/2.1.3). The browser's default focus outline
    // is kept.
    <div tabIndex={0} className={`overflow-x-auto ${className ?? ""}`}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-soft)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            <th className="py-2 pr-3 font-medium">Player</th>
            <th className="py-2 pr-3 font-medium">Core team</th>
            <th className="py-2 pr-3 font-medium">Position</th>
            <th className="py-2 pr-3 font-medium">Availability</th>
            <th className="py-2 pr-3 text-right font-medium">Played</th>
            <th className="py-2 pr-3 text-right font-medium">Goals</th>
            <th className="py-2 pr-3 text-right font-medium">Assists</th>
            <th className="py-2 pr-3 text-right font-medium">Core</th>
            <th className="py-2 pr-3 text-right font-medium">Support</th>
            <th className="py-2 pr-3 text-right font-medium">Dev.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.playerId === selectedPlayerId;
            return (
              <tr
                key={row.playerId}
                onClick={() => onSelectPlayer(row.playerId)}
                aria-selected={isSelected}
                className={`cursor-pointer border-b border-[var(--border-soft)] transition-colors ${
                  isSelected ? "bg-[var(--tl-pitch-selected)]" : "hover:bg-[var(--surface-hover)]"
                }`}
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <TeamKitMark color={row.kitColor} number={row.shirtNumber} size="xs" ariaLabel={`${row.displayName}'s shirt`} />
                    <span className="flex items-center gap-1.5 font-[600] text-[var(--foreground)]">
                      {row.displayName}
                      {row.attention ? (
                        <span title="Needs attention">
                          {/* Visually-hidden text, not aria-label — aria-label is prohibited on
                              a span with no role (axe `aria-prohibited-attr`, WCAG 4.1.2). */}
                          <span className="sr-only">Needs attention</span>
                          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">{row.coreTeamName ?? "—"}</td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">{row.currentPrimaryPosition ?? "—"}</td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">{row.availabilityLabel}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{row.played}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{row.goals}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{row.assists}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--text-soft)]">{row.core}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--text-soft)]">{row.support}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--text-soft)]">{row.development}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
