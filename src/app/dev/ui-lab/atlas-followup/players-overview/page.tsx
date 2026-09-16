"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { AppearanceControl } from "@/components/touchline";
import { MetricTile } from "@/components/ui/metric-tile";
import { Users, AlertTriangle, Shield, Target } from "lucide-react";
import { PlayerRosterTable } from "@/components/touchline/player/player-roster-table";
import { PlayerInspector } from "@/components/touchline/player/player-inspector";
import { PlayerCompactRow } from "@/components/touchline/player/player-compact-row";
import { buildPlayersOverviewViewModel } from "@/lib/touchline/presentation/players-overview-view-model";
import { buildPlayersCurrentRoundViewModel } from "@/lib/touchline/presentation/players-current-round-view-model";
import { buildPlayersDevelopmentViewModel } from "@/lib/touchline/presentation/players-development-view-model";
import { overviewRows, currentRoundRows, developmentRows, overviewStates, type OverviewStateKey } from "./fixtures";

type ModeKey = "overview" | "current-round" | "development";
const MODES: TabItem<ModeKey>[] = [
  { key: "overview", label: "Overview", href: "?mode=overview" },
  { key: "current-round", label: "Current round", href: "?mode=current-round" },
  { key: "development", label: "Development", href: "?mode=development" },
];

const overviewVm = buildPlayersOverviewViewModel({ leagueSeasonLabel: "Autumn 2026", rows: overviewRows });
const currentRoundVm = buildPlayersCurrentRoundViewModel({ roundLabel: "W34 2026", rows: currentRoundRows });
const developmentVm = buildPlayersDevelopmentViewModel({ rows: developmentRows });

const ATTENTION_LABEL: Record<string, string> = {
  COVERED: "Covered",
  DECISION_REQUIRED_NO_PLANNED_MATCH: "Decision required",
  BLOCKED_UNAVAILABLE_SELECTION: "Blocked",
  BLOCKED_INVALID_PLAN: "Blocked",
  NOT_AVAILABLE: "Not available",
  UNCONFIRMED: "Unconfirmed",
};

const DEFAULT_STATE: OverviewStateKey = "players-overview-selected";
const STATE_KEYS: OverviewStateKey[] = [
  "players-overview-selected",
  "players-overview-opportunity-gap",
  "players-overview-position-legacy",
  "players-overview-filtered",
  "players-overview-empty-filter",
  "players-overview-no-position-history",
  "players-overview-mobile",
];

/**
 * Real production Overview composition (mirrors `PlayersPageClient`'s Overview section) driven by
 * one of the seven required deterministic fixture states (`07_UI_LAB_AND_VISUAL_MERGE_GATE.md
 * §1`). Not a separate demo UI — same metric tiles, filter row, roster table, and inspector the
 * production route renders.
 */
function OverviewMode({ stateKey }: { stateKey: OverviewStateKey }) {
  const fixture = overviewStates[stateKey];
  const [selected, setSelected] = useState<string | null>(fixture.initialSelectedPlayerId);
  const [searchQuery, setSearchQuery] = useState(fixture.initialSearch);
  const [teamFilter, setTeamFilter] = useState(fixture.initialTeamFilter);
  const [positionFilter, setPositionFilter] = useState(fixture.initialPositionFilter);
  const [availabilityFilter, setAvailabilityFilter] = useState(fixture.initialAvailabilityFilter);

  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of fixture.rows) if (row.coreTeamName) seen.add(row.coreTeamName);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [fixture.rows]);

  const positionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of fixture.rows) {
      if (row.currentPrimaryPositionCode && row.currentPrimaryPosition) seen.set(row.currentPrimaryPositionCode, row.currentPrimaryPosition);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fixture.rows]);

  const availabilityOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of fixture.rows) seen.add(row.availabilityLabel);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [fixture.rows]);

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filtersActive = trimmedSearch !== "" || teamFilter !== "" || positionFilter !== "" || availabilityFilter !== "";
  const filteredRows = fixture.rows.filter((row) => {
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

  const effectiveSelectedRow =
    (selected ? filteredRows.find((r) => r.playerId === selected) : undefined) ?? filteredRows[0] ?? null;
  const inspectorData = effectiveSelectedRow ? (fixture.inspectorByPlayerId[effectiveSelectedRow.playerId] ?? null) : null;

  const supportUsageCount = fixture.rows.filter((r) => r.support > 0).length;
  const developmentFocusesCount = developmentRows.filter((r) => r.activeDevelopmentFocus != null).length;
  const selectClass =
    "h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <MetricTile icon={<Users className="h-4 w-4" />} label="Active players" value={fixture.activePlayerCount} />
        <MetricTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Opportunity gaps"
          value={fixture.opportunityGapsCount}
          tone={fixture.opportunityGapsCount > 0 ? "warning" : "neutral"}
          description="No planned match in W34 2026"
        />
        <MetricTile icon={<Shield className="h-4 w-4" />} label="Support usage" value={supportUsageCount} description="Players used in support" />
        <MetricTile icon={<Target className="h-4 w-4" />} label="Development focuses" value={developmentFocusesCount} description="Players with an active focus" />
        {fixture.removedPlayerCount > 0 && (
          <button
            type="button"
            className="ml-2 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
          >
            {`Show removed (${fixture.removedPlayerCount})`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search players"
          aria-label="Search players"
          className={`${selectClass} w-full max-w-none sm:w-[220px]`}
        />
        <label className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Core team:</span>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={selectClass}>
            <option value="">All teams</option>
            {teamOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Position:</span>
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className={selectClass}>
            <option value="">All positions</option>
            {positionOptions.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Availability:</span>
          <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)} className={selectClass}>
            <option value="">All availability</option>
            {availabilityOptions.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>

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
          {/* Desktop: dense table (~9/12) + inspector (~3/12). */}
          <div className="hidden medium:grid medium:grid-cols-[3fr_1fr] medium:gap-6">
            <PlayerRosterTable rows={filteredRows} selectedPlayerId={effectiveSelectedRow?.playerId ?? null} onSelectPlayer={setSelected} />
            <PlayerInspector data={inspectorData} />
          </div>
          {/* Mobile: compact rows, tap opens Player Detail (no inspector). */}
          <ul className="flex flex-col divide-y divide-[var(--border-soft)] medium:hidden">
            {filteredRows.map((row) => (
              <li key={row.playerId}>
                <PlayerCompactRow
                  playerId={row.playerId}
                  displayName={row.displayName}
                  shirtNumber={row.shirtNumber}
                  kitColor={row.kitColor}
                  primaryPosition={row.currentPrimaryPosition}
                  coreTeamName={row.coreTeamName}
                  href="/dev/ui-lab/atlas-followup/player-detail"
                  attentionMarker={row.attention}
                  trailing={<span>{row.hasOpportunityThisWeek === null ? "—" : row.hasOpportunityThisWeek ? "1/1" : "0/1"}</span>}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function CurrentRoundMode() {
  return (
    <>
      <div className="hidden overflow-x-auto medium:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
              <th className="py-2 pr-3 font-medium">Player</th>
              <th className="py-2 pr-3 font-medium">Availability</th>
              <th className="py-2 pr-3 font-medium">Current assignment</th>
              <th className="py-2 pr-3 font-medium">Attention</th>
            </tr>
          </thead>
          <tbody>
            {currentRoundVm.sortedRows.map((row) => (
              <tr key={row.playerId} className="border-b border-[var(--border-soft)]">
                <td className="py-2 pr-3 font-[600] text-[var(--foreground)]">{row.displayName}</td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">{row.availabilityLabel}</td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">
                  {row.currentAssignment ? `${row.currentAssignment.teamName} vs ${row.currentAssignment.opponent} (${row.currentAssignment.role})` : "—"}
                </td>
                <td className="py-2 pr-3 text-[var(--text-soft)]">{ATTENTION_LABEL[row.attentionState]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y divide-[var(--border-soft)] medium:hidden">
        {currentRoundVm.sortedRows.map((row) => (
          <li key={row.playerId}>
            <PlayerCompactRow
              playerId={row.playerId}
              displayName={row.displayName}
              shirtNumber={row.shirtNumber}
              kitColor={row.kitColor}
              primaryPosition={row.currentAssignment?.role ?? null}
              coreTeamName={row.coreTeamName}
              href="/dev/ui-lab/atlas-followup/player-detail"
              attentionMarker={row.attentionState !== "COVERED" && row.attentionState !== "NOT_AVAILABLE"}
              trailing={<span>{ATTENTION_LABEL[row.attentionState]}</span>}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function DevelopmentMode() {
  return (
    <ul className="flex flex-col divide-y divide-[var(--border-soft)]">
      {developmentVm.rows.map((row) => (
        <li key={row.playerId}>
          <PlayerCompactRow
            playerId={row.playerId}
            displayName={row.displayName}
            shirtNumber={row.shirtNumber}
            kitColor={row.kitColor}
            primaryPosition={row.effectivePositionSummary}
            coreTeamName={row.activeDevelopmentFocus ?? "No active focus"}
            href="/dev/ui-lab/atlas-followup/player-detail"
            trailing={row.decisionReviewState ? <span>{row.decisionReviewState}</span> : null}
          />
        </li>
      ))}
    </ul>
  );
}

function PlayersOverviewFixtureInner() {
  const searchParams = useSearchParams();
  const mode = (["overview", "current-round", "development"] as const).includes((searchParams.get("mode") as ModeKey) ?? "overview")
    ? ((searchParams.get("mode") as ModeKey) ?? "overview")
    : "overview";
  const rawState = searchParams.get("state");
  const stateKey: OverviewStateKey = STATE_KEYS.includes(rawState as OverviewStateKey) ? (rawState as OverviewStateKey) : DEFAULT_STATE;

  return (
    <div className="touchline mx-auto flex max-w-[440px] flex-col gap-6 px-4 py-6 medium:max-w-[900px] large:max-w-[1100px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Players</h1>
        <p className="text-[13px] text-[var(--text-muted)]">League season: {overviewVm.leagueSeasonLabel}</p>
      </div>

      {mode === "overview" && (
        <div className="flex flex-wrap gap-1">
          {STATE_KEYS.map((key) => (
            <Link
              key={key}
              href={`?mode=overview&state=${key}`}
              className={`rounded border px-2 py-1 text-[11px] ${
                key === stateKey
                  ? "border-[var(--accent-strong)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "border-[var(--border-soft)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {key}
            </Link>
          ))}
        </div>
      )}

      <TabRail items={MODES} activeKey={mode} ariaLabel="Players workspace modes" />

      {mode === "overview" ? <OverviewMode stateKey={stateKey} /> : null}
      {mode === "current-round" ? <CurrentRoundMode /> : null}
      {mode === "development" ? <DevelopmentMode /> : null}
    </div>
  );
}

/**
 * `/dev/ui-lab/atlas-followup/players-overview` — Phase F5 fixture, Hard Human Gate C.
 * Reference target: `04-atlas-planning-and-players.png` ("PLAYERS OVERVIEW (DESKTOP)" panel) for
 * density/composition — NOT for its literal 4-tab label set, which conflicts with the bundle's
 * own locked 3-mode contract (see `reference-decomposition/players-overview.md`).
 */
export default function PlayersOverviewFixturePage() {
  return (
    <Suspense fallback={<div className="touchline p-6 text-sm text-[var(--text-muted)]">Loading…</div>}>
      <PlayersOverviewFixtureInner />
    </Suspense>
  );
}
