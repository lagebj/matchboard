import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";

/**
 * `AllocationMatrix` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §8`). Desktop-only optional
 * secondary mode — a player × match matrix, for difficult rounds, not the default view. Must use
 * the same assignment command/validations as the normal board (contract's own explicit rule) —
 * this component only renders state and reports cell clicks; the page composing it calls the
 * exact same `onAssign`-style command the board's drag/drop and click-to-assign already use.
 */
export type AllocationMatrixRow = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  kitColor: string | null;
  /** matchId -> assigned (true when this player is in that match's squad). */
  assignments: Record<string, boolean>;
  total: number;
  target: number;
  status: "OK" | "NEEDS_ASSIGNMENT";
};

export type AllocationMatrixColumn = {
  matchId: string;
  teamName: string;
  teamKitColor: string | null;
};

export type AllocationMatrixProps = {
  columns: AllocationMatrixColumn[];
  rows: AllocationMatrixRow[];
  onToggleCell?: (playerId: string, matchId: string) => void;
  className?: string;
};

export function AllocationMatrix({ columns, rows, onToggleCell, className }: AllocationMatrixProps) {
  return (
    <div className={`overflow-x-auto ${className ?? ""}`}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-soft)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            <th className="py-2 pr-3 font-medium">Player</th>
            {columns.map((c) => (
              <th key={c.matchId} className="px-2 py-2 text-center font-medium">
                <TeamKitMark color={c.teamKitColor} size="xs" ariaLabel={`${c.teamName} shirt`} className="mx-auto" />
              </th>
            ))}
            <th className="px-2 py-2 text-right font-medium">Total</th>
            <th className="px-2 py-2 text-right font-medium">Target</th>
            <th className="px-2 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId} className={`border-b border-[var(--border-soft)] ${row.status === "NEEDS_ASSIGNMENT" ? "bg-[var(--warning-subtle)]" : ""}`}>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <TeamKitMark color={row.kitColor} number={row.shirtNumber} size="xs" ariaLabel={`${row.displayName}'s shirt`} />
                  <span className="font-[600] text-[var(--foreground)]">{row.displayName}</span>
                </div>
              </td>
              {columns.map((c) => (
                <td key={c.matchId} className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleCell?.(row.playerId, c.matchId)}
                    aria-label={`${row.displayName} in ${c.teamName}${row.assignments[c.matchId] ? "" : ", not assigned"}`}
                    className="inline-flex h-5 w-5 items-center justify-center"
                  >
                    {row.assignments[c.matchId] ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.teamKitColor ?? "var(--accent)" }} /> : null}
                  </button>
                </td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums text-[var(--foreground)]">{row.total}</td>
              <td className="px-2 py-2 text-right tabular-nums text-[var(--text-muted)]">{row.target}</td>
              <td className="px-2 py-2">
                <span className={row.status === "NEEDS_ASSIGNMENT" ? "text-[var(--warning)]" : "text-[var(--text-soft)]"}>
                  {row.status === "NEEDS_ASSIGNMENT" ? "Needs assignment" : "OK"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
