"use client";

import { useMemo, useState } from "react";
import { Users, AlertTriangle, Shield, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { PlayersSummaryStrip, type PlayersSummaryStripItem } from "./players-summary-strip";
import { PlayersOverviewToolbar, type PlayersOverviewSeasonOption } from "./players-overview-toolbar";
import { PlayerRosterTable } from "./player-roster-table";
import { PlayerInspector } from "./player-inspector";
import { PlayerCompactRow } from "./player-compact-row";
import type { PlayerRosterFilter } from "@/lib/players/roster-state";
import { overviewMobileTrailingLabel, overviewMobileTrailingTone } from "@/lib/touchline/presentation/players-overview-production-adapter";
import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * `PlayersOverviewSurface` (Players Operating Surface visual-convergence follow-up, §3). The one
 * shared Overview-mode body composition — summary strip, toolbar, desktop table/inspector grid,
 * mobile compact list, filtered-empty state, and selected-player fallback. Both production
 * (`PlayersPageClient`) and the UI-Lab fixture render this same component; UI-Lab must never
 * manually rebuild this composition again (§4).
 *
 * Pure presentation: receives already-resolved row/inspector data and callbacks. No DB access,
 * no domain calculation — filtering and the selected-player fallback are the only local state this
 * component owns, and both are pure UI-list operations over data already provided by the caller.
 */
export type PlayersOverviewSummary = {
  activePlayerCount: number;
  opportunityGapsCount: number;
  opportunityGapsDescription: string;
  supportUsageCount: number;
  developmentFocusesCount: number;
};

export type PlayersOverviewSurfaceProps = {
  rows: PlayersOverviewRow[];
  /** Resolves the inspector snapshot for a player id — a function rather than a pre-built map so
      production can build it lazily (it needs positions/development-focus lookups the row itself
      doesn't carry) while fixtures can just look one up in a static table. */
  resolveInspectorData: (playerId: string) => PlayersOverviewInspectorData | null;
  summary: PlayersOverviewSummary;
  seasonOptions: PlayersOverviewSeasonOption[];
  selectedSeasonId: string;
  onSeasonChange: (seasonId: string) => void;
  /** The roster state — URL/server-backed navigation, distinct from the client-local filters this
      component still owns below (roster-state-and-mobile-convergence pass §14). */
  rosterFilter: PlayerRosterFilter;
  onRosterFilterChange: (filter: PlayerRosterFilter) => void;
  /** Builds the Player Detail href for a given player id — mobile rows tap straight through. */
  mobilePlayerHref: (playerId: string) => string;
  initialSelectedPlayerId?: string | null;
  initialSearch?: string;
  initialTeamFilter?: string;
  initialPositionFilter?: string;
  initialAvailabilityFilter?: string;
  className?: string;
};

export function PlayersOverviewSurface({
  rows,
  resolveInspectorData,
  summary,
  seasonOptions,
  selectedSeasonId,
  onSeasonChange,
  rosterFilter,
  onRosterFilterChange,
  mobilePlayerHref,
  initialSelectedPlayerId = null,
  initialSearch = "",
  initialTeamFilter = "",
  initialPositionFilter = "",
  initialAvailabilityFilter = "",
  className,
}: PlayersOverviewSurfaceProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialSelectedPlayerId);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState(initialTeamFilter);
  const [positionFilter, setPositionFilter] = useState(initialPositionFilter);
  const [availabilityFilter, setAvailabilityFilter] = useState(initialAvailabilityFilter);

  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.coreTeamName) seen.add(row.coreTeamName);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const positionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.currentPrimaryPositionCode && row.currentPrimaryPosition) {
        seen.set(row.currentPrimaryPositionCode, row.currentPrimaryPosition);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const availabilityOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) seen.add(row.availabilityLabel);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filtersActive = trimmedSearch !== "" || teamFilter !== "" || positionFilter !== "" || availabilityFilter !== "";
  const filteredRows = rows.filter((row) => {
    if (trimmedSearch && !row.displayName.toLowerCase().includes(trimmedSearch)) return false;
    if (teamFilter && row.coreTeamName !== teamFilter) return false;
    if (positionFilter && row.currentPrimaryPositionCode !== positionFilter) return false;
    if (availabilityFilter && row.availabilityLabel !== availabilityFilter) return false;
    return true;
  });

  function clearFilters() {
    setSearchQuery("");
    setTeamFilter("");
    setPositionFilter("");
    setAvailabilityFilter("");
  }

  // Selected-player fallback (§8 of 05_INTERACTION_FILTER_AND_RESPONSIVE_CONTRACT.md): locally
  // selected player if still present in filtered rows, else first filtered row, else null. Never
  // persisted — filtering the selected player out previews the first remaining row.
  const effectiveSelectedRow =
    (selectedPlayerId ? filteredRows.find((r) => r.playerId === selectedPlayerId) : undefined) ?? filteredRows[0] ?? null;

  const inspectorData = effectiveSelectedRow ? resolveInspectorData(effectiveSelectedRow.playerId) : null;

  const summaryItems: PlayersSummaryStripItem[] = [
    { key: "active", icon: <Users className="h-4 w-4" />, label: "Active players", value: summary.activePlayerCount },
    {
      key: "opportunity",
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Opportunity gaps",
      value: summary.opportunityGapsCount,
      description: summary.opportunityGapsDescription,
      tone: summary.opportunityGapsCount > 0 ? "warning" : "neutral",
    },
    {
      key: "support",
      icon: <Shield className="h-4 w-4" />,
      label: "Support usage",
      value: summary.supportUsageCount,
      description: "Players used in support",
    },
    {
      key: "development",
      icon: <Target className="h-4 w-4" />,
      label: "Development focuses",
      value: summary.developmentFocusesCount,
      description: "Players with an active focus",
    },
  ];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <PlayersSummaryStrip items={summaryItems} />

      <PlayersOverviewToolbar
        seasonOptions={seasonOptions}
        selectedSeasonId={selectedSeasonId}
        onSeasonChange={onSeasonChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        rosterFilter={rosterFilter}
        onRosterFilterChange={onRosterFilterChange}
        teamOptions={teamOptions}
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
        positionOptions={positionOptions}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        availabilityOptions={availabilityOptions}
        availabilityFilter={availabilityFilter}
        onAvailabilityFilterChange={setAvailabilityFilter}
      />

      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-[13px] text-[var(--text-soft)]">
          <p>No players match these filters.</p>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: dense table gets the remaining width; the inspector holds a stable,
              useful rail (300–330px) rather than an unconstrained 3fr/1fr split. */}
          <div className="hidden medium:grid medium:grid-cols-[minmax(0,1fr)_minmax(300px,330px)] medium:gap-4">
            <PlayerRosterTable
              rows={filteredRows}
              selectedPlayerId={effectiveSelectedRow?.playerId ?? null}
              onSelectPlayer={setSelectedPlayerId}
              className="min-w-0"
            />
            <PlayerInspector data={inspectorData} />
          </div>
          {/* Mobile: compact rows only, tap opens Player Detail — no inspector duplication. */}
          <ul className="flex flex-col divide-y divide-[var(--border-soft)] medium:hidden">
            {filteredRows.map((row) => {
              const trailingLabel = overviewMobileTrailingLabel(row.rosterState, row.hasOpportunityThisWeek);
              // A non-default football availability is worth surfacing on an otherwise-ordinary
              // active row; "Available" itself is the common case and stays silent (§20).
              const availabilityNote =
                row.rosterState === "ACTIVE" && row.availabilityLabel !== "Available" ? row.availabilityLabel : null;
              return (
                <li key={row.playerId}>
                  <PlayerCompactRow
                    playerId={row.playerId}
                    displayName={row.displayName}
                    shirtNumber={row.shirtNumber}
                    kitColor={row.kitColor}
                    primaryPosition={row.currentPrimaryPosition}
                    coreTeamName={row.coreTeamName}
                    href={mobilePlayerHref(row.playerId)}
                    attentionMarker={row.attention}
                    availabilityNote={availabilityNote}
                    trailing={trailingLabel ? <span>{trailingLabel}</span> : null}
                    trailingTone={overviewMobileTrailingTone(row.rosterState, row.hasOpportunityThisWeek)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
