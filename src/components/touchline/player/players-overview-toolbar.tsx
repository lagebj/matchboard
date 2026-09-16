import { cn } from "@/lib/cn";

/**
 * `PlayersOverviewToolbar` (Players Operating Surface visual-convergence follow-up §7 and §22).
 * One coherent, compact toolbar row combining league-season selection, search, and the three
 * roster filters — replacing what used to be two separately-spaced rows (a standalone "League
 * season:" row, then a second filters row). Every control keeps an accessible name via an
 * `sr-only` label even though the visible chrome relies on the selected value/placeholder to
 * communicate the field.
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
  "h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]";

export function PlayersOverviewToolbar({
  seasonOptions,
  selectedSeasonId,
  onSeasonChange,
  searchQuery,
  onSearchChange,
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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {seasonOptions.length > 0 ? (
        <label className="contents">
          <span className="sr-only">League season</span>
          <select
            value={selectedSeasonId}
            onChange={(e) => onSeasonChange(e.target.value)}
            className={cn(controlClass, "max-w-[160px] shrink-0")}
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
          className={cn(controlClass, "w-full min-w-[140px] flex-1 sm:w-[200px] sm:flex-none")}
        />
      </label>

      <label className="contents">
        <span className="sr-only">Core team</span>
        <select value={teamFilter} onChange={(e) => onTeamFilterChange(e.target.value)} className={cn(controlClass, "max-w-[150px]")}>
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
        <select value={positionFilter} onChange={(e) => onPositionFilterChange(e.target.value)} className={cn(controlClass, "max-w-[150px]")}>
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
          className={cn(controlClass, "max-w-[150px]")}
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
  );
}
