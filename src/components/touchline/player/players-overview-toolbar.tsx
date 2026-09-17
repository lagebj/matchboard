import { cn } from "@/lib/cn";
import { ROSTER_FILTER_OPTIONS, type PlayerRosterFilter } from "@/lib/players/roster-state";

/**
 * `PlayersOverviewToolbar` (Players Operating Surface visual-convergence follow-up §7/§22;
 * roster-state-and-mobile-convergence pass §12-13). One coherent, compact toolbar in a fixed
 * control order — league season, search, roster, core team, position, availability. Every
 * control keeps an accessible name via an `sr-only` label even though the visible chrome relies
 * on the selected value/placeholder to communicate the field.
 *
 * The roster filter, team, position and availability share one wrapper (`div.grid grid-cols-2 … medium:contents`)
 * so mobile gets an intentional 2×2 grid (roster+team, then position+availability) while desktop —
 * where the wrapper becomes `display: contents` and stops laying out its own box — exposes the
 * same four controls directly into the parent row, completing the fixed six-control order.
 */
export type PlayersOverviewSeasonOption = {
  id: string;
  label: string;
};

export type PlayersOverviewToolbarProps = {
  seasonOptions: PlayersOverviewSeasonOption[];
  selectedSeasonId: string;
  onSeasonChange: (seasonId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** The roster state — URL/server-backed, distinct from the client-local filters below (§14). */
  rosterFilter: PlayerRosterFilter;
  onRosterFilterChange: (filter: PlayerRosterFilter) => void;
  teamOptions: string[];
  teamFilter: string;
  onTeamFilterChange: (value: string) => void;
  positionOptions: Array<[code: string, label: string]>;
  positionFilter: string;
  onPositionFilterChange: (value: string) => void;
  availabilityOptions: string[];
  availabilityFilter: string;
  onAvailabilityFilterChange: (value: string) => void;
  className?: string;
};

const controlClass =
  "h-8 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]";

export function PlayersOverviewToolbar({
  seasonOptions,
  selectedSeasonId,
  onSeasonChange,
  searchQuery,
  onSearchChange,
  rosterFilter,
  onRosterFilterChange,
  teamOptions,
  teamFilter,
  onTeamFilterChange,
  positionOptions,
  positionFilter,
  onPositionFilterChange,
  availabilityOptions,
  availabilityFilter,
  onAvailabilityFilterChange,
  className,
}: PlayersOverviewToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-2 medium:flex-row medium:flex-wrap medium:items-center", className)}>
      {seasonOptions.length > 0 ? (
        <label className="contents">
          <span className="sr-only">League season</span>
          <select
            value={selectedSeasonId}
            onChange={(e) => onSeasonChange(e.target.value)}
            className={cn(controlClass, "medium:w-auto medium:max-w-[160px] medium:shrink-0")}
          >
            {seasonOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="contents">
        <span className="sr-only">Search players</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search players…"
          className={cn(controlClass, "medium:w-[200px] medium:flex-none")}
        />
      </label>

      {/* The roster filter / team / position / availability: one intentional 2×2 grid on mobile,
          four plain controls in the fixed desktop order once this wrapper becomes `display:
          contents`. */}
      <div className="grid grid-cols-2 gap-2 medium:contents">
        <label className="contents">
          {/* "Player status", not the banned synonym for match-day squad selection
              (`docs/domain/terminology.md`) — this control is Active/Inactive/Removed/All
              player-record status, a different concept from who's picked for a match. */}
          <span className="sr-only">Player status</span>
          <select
            value={rosterFilter}
            onChange={(e) => onRosterFilterChange(e.target.value as PlayerRosterFilter)}
            className={cn(controlClass, "medium:w-auto medium:max-w-[120px]")}
          >
            {ROSTER_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="contents">
          <span className="sr-only">Core team</span>
          <select
            value={teamFilter}
            onChange={(e) => onTeamFilterChange(e.target.value)}
            className={cn(controlClass, "medium:w-auto medium:max-w-[150px]")}
          >
            <option value="">All teams</option>
            {teamOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="contents">
          <span className="sr-only">Position</span>
          <select
            value={positionFilter}
            onChange={(e) => onPositionFilterChange(e.target.value)}
            className={cn(controlClass, "medium:w-auto medium:max-w-[150px]")}
          >
            <option value="">All positions</option>
            {positionOptions.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="contents">
          <span className="sr-only">Availability</span>
          <select
            value={availabilityFilter}
            onChange={(e) => onAvailabilityFilterChange(e.target.value)}
            className={cn(controlClass, "medium:w-auto medium:max-w-[150px]")}
          >
            <option value="">All availability</option>
            {availabilityOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
