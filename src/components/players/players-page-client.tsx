"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManageBaseGroupsView } from "./manage-base-groups-view";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow, PlayerDevelopmentOverviewRow } from "@/lib/players/get-players-overview";
import type { RatingSummary } from "@/lib/ratings/player-rating";
import { formatLeagueSeasonDisplay } from "@/lib/date/format-phase-display";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { MetricTile } from "@/components/ui/metric-tile";
import { Users } from "lucide-react";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { PlayerRosterTable } from "@/components/touchline/player/player-roster-table";
import { PlayerInspector } from "@/components/touchline/player/player-inspector";
import { PlayerCompactRow } from "@/components/touchline/player/player-compact-row";
import {
  buildPlayersOverviewRows,
  buildPlayersOverviewInspectorData,
  buildPlayersCurrentRoundRows,
  buildPlayersDevelopmentRows,
  type PlayerIdentityInput,
} from "@/lib/touchline/presentation/players-overview-production-adapter";
import { buildPlayersCurrentRoundViewModel } from "@/lib/touchline/presentation/players-current-round-view-model";

/**
 * Atlas Follow-up Phase F8 (Production Players migration, `03_PLAYER_OVERVIEW_CONTRACT.md`).
 * Four modes, per the resolved open decision from the Phase F0 audit (production migration PR):
 * Overview / Current round / Development / Manage base groups — the last preserving the
 * pre-existing "Manage base groups" capability the bundle's own written contract's 3-mode lock
 * never addressed (a real, load-bearing, org-wide core-team-assignment tool with no equivalent
 * in the new "Development" mode).
 */
type PlayersMode = "overview" | "current-round" | "development" | "groups";

const MODE_TABS: { mode: PlayersMode; label: string }[] = [
  { mode: "overview", label: "Overview" },
  { mode: "current-round", label: "Current round" },
  { mode: "development", label: "Development" },
  { mode: "groups", label: "Manage base groups" },
];

const ATTENTION_LABEL: Record<string, string> = {
  COVERED: "Covered",
  DECISION_REQUIRED_NO_PLANNED_MATCH: "Decision required",
  BLOCKED_UNAVAILABLE_SELECTION: "Blocked",
  BLOCKED_INVALID_PLAN: "Blocked",
  NOT_AVAILABLE: "Not available",
  UNCONFIRMED: "Unconfirmed",
};

type PlayersPageClientProps = {
  players: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    coreTeamId: string | null;
    coreTeam: { id: string; name: string } | null;
    coreTeamKitColor: string | null;
    primaryPosition: string | null;
    currentAvailability: string;
    shirtNumber: number | null;
    nonRotatable: boolean;
    reducedMatchLoadAllowed: boolean;
    overallRating: RatingSummary;
    removed?: boolean;
  }>;
  teams: Array<{ id: string; name: string }>;
  leagueSeasons: Array<{ id: string; name: string; startDate: Date; endDate: Date }>;
  matchRounds: Array<{ id: string; name: string; leagueSeasonId?: string | null }>;
  seasonRows: PlayerSeasonOverviewRow[];
  currentRoundRows: PlayerCurrentRoundAttentionRow[];
  developmentRows: PlayerDevelopmentOverviewRow[];
  selectedPeriodId: string;
  selectedRoundId?: string;
  includeRemoved?: boolean;
  removedPlayerCount?: number;
  initialMode?: string;
  error?: string;
  saved?: string;
};

function resolveMode(value: string | undefined): PlayersMode {
  return value === "current-round" || value === "development" || value === "groups" ? value : "overview";
}

export function PlayersPageClient({
  players,
  teams,
  leagueSeasons,
  matchRounds,
  seasonRows,
  currentRoundRows,
  developmentRows,
  selectedPeriodId,
  selectedRoundId,
  includeRemoved,
  removedPlayerCount = 0,
  initialMode,
  error,
  saved,
}: PlayersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgUrl = useOrgUrl();
  const mode = resolveMode(initialMode);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const selectedPeriod = leagueSeasons.find((p) => p.id === selectedPeriodId);
  const selectedRound = matchRounds.find((r) => r.id === selectedRoundId);
  const periodLabel = selectedPeriod ? formatLeagueSeasonDisplay({ seasonName: selectedPeriod.name, leagueSeasonName: selectedPeriod.name, startDate: new Date(selectedPeriod.startDate), endDate: new Date(selectedPeriod.endDate) }).combinedLabel : "No league season";
  const roundLabel = selectedRound?.name ?? "No round selected";

  const roundsForPeriod = matchRounds.filter((r) => r.leagueSeasonId === selectedPeriodId);

  function paramsWith(params: Record<string, string | undefined>): string {
    const all = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") {
        all.delete(key);
      } else {
        all.set(key, value);
      }
    }
    return all.toString();
  }

  function navigate(params: Record<string, string | undefined>) {
    router.push(`/players?${paramsWith(params)}`);
  }

  const tabItems: TabItem<PlayersMode>[] = MODE_TABS.map((t) => ({
    key: t.mode,
    label: t.label,
    href: `?${paramsWith({ mode: t.mode })}`,
  }));

  const selectClass =
    "h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-[var(--text-soft)] outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)] max-w-[180px] sm:max-w-none";

  const identities: PlayerIdentityInput[] = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    shirtNumber: p.shirtNumber,
    coreTeamKitColor: p.coreTeamKitColor,
    primaryPosition: p.primaryPosition,
    currentAvailability: p.currentAvailability,
  }));

  const overviewRows = buildPlayersOverviewRows(identities, seasonRows, currentRoundRows);
  const currentRoundRowsVm = buildPlayersCurrentRoundViewModel({
    roundLabel,
    rows: buildPlayersCurrentRoundRows(identities, currentRoundRows),
  });
  const developmentRowsVm = buildPlayersDevelopmentRows(identities, developmentRows);

  const selectedRow = selectedPlayerId ? overviewRows.find((r) => r.playerId === selectedPlayerId) ?? null : null;
  const inspectorData = selectedRow ? buildPlayersOverviewInspectorData(selectedRow, orgUrl) : null;

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8).
    <div className="touchline flex flex-col gap-4">
      <TouchlinePageHeader
        title="Players"
        context="Participation, movement and current planning attention."
        actions={
          teams.length > 0 ? (
            <TouchlineButton variant="primary" size="sm" as="a" href={orgUrl("/players/new")}>
              Add player
            </TouchlineButton>
          ) : undefined
        }
      />

      {error && <DecisionBanner variant="blocked" title={error} />}
      {saved === "created" && <DecisionBanner variant="success" title="Player created." />}
      {saved === "removed" && <DecisionBanner variant="success" title="Player removed." />}
      {saved === "restored" && <DecisionBanner variant="success" title="Player restored." />}

      <div className="flex flex-wrap items-center gap-2">
        <MetricTile
          icon={<Users className="h-4 w-4" />}
          label="Players"
          value={players.length}
        />
        {removedPlayerCount > 0 && (
          <button
            type="button"
            onClick={() => navigate({ showRemoved: includeRemoved ? undefined : "1" })}
            className={`ml-2 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              includeRemoved
                ? "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] text-[var(--warning)]"
                : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            }`}
          >
            {includeRemoved ? "Hide removed" : `Show removed (${removedPlayerCount})`}
          </button>
        )}
      </div>

      <TabRail items={tabItems} activeKey={mode} ariaLabel="Players workspace modes" />

      {mode === "overview" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">League season:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "overview" })}
                className={selectClass}
              >
                {leagueSeasons.map((p) => (
                  <option key={p.id} value={p.id}>{formatLeagueSeasonDisplay({ seasonName: p.name, leagueSeasonName: p.name, startDate: new Date(p.startDate), endDate: new Date(p.endDate) }).combinedLabel}</option>
                ))}
              </select>
            </label>
            <span className="text-xs text-[var(--text-muted)]">{periodLabel}</span>
          </div>

          <div className="hidden medium:grid medium:grid-cols-[3fr_1fr] medium:gap-6">
            <PlayerRosterTable rows={overviewRows} selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId} />
            <PlayerInspector data={inspectorData} />
          </div>
          <ul className="flex flex-col divide-y divide-[var(--border-soft)] medium:hidden">
            {overviewRows.map((row) => (
              <li key={row.playerId}>
                <PlayerCompactRow
                  playerId={row.playerId}
                  displayName={row.displayName}
                  shirtNumber={row.shirtNumber}
                  kitColor={row.kitColor}
                  primaryPosition={row.currentPrimaryPosition}
                  coreTeamName={row.coreTeamName}
                  href={orgUrl(`/players/${row.playerId}`)}
                  attentionMarker={row.attention}
                  trailing={<span>{row.hasOpportunityThisWeek === null ? "—" : row.hasOpportunityThisWeek ? "1/1" : "0/1"}</span>}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {mode === "current-round" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">League season:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "current-round" })}
                className={selectClass}
              >
                {leagueSeasons.map((p) => (
                  <option key={p.id} value={p.id}>{formatLeagueSeasonDisplay({ seasonName: p.name, leagueSeasonName: p.name, startDate: new Date(p.startDate), endDate: new Date(p.endDate) }).combinedLabel}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Round:</span>
              <select
                value={selectedRoundId ?? ""}
                onChange={(e) => navigate({ roundId: e.target.value, mode: "current-round" })}
                className={selectClass}
              >
                {roundsForPeriod.length === 0 && (
                  <option value="">No rounds available</option>
                )}
                {roundsForPeriod.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="hidden overflow-x-auto medium:block" tabIndex={0} role="region" aria-label="Current round attention table">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">Player</th>
                  <th className="py-2 pr-3 font-medium">Core team</th>
                  <th className="py-2 pr-3 font-medium">Availability</th>
                  <th className="py-2 pr-3 font-medium">Current assignment</th>
                  <th className="py-2 pr-3 font-medium">Attention</th>
                </tr>
              </thead>
              <tbody>
                {currentRoundRowsVm.sortedRows.map((row) => (
                  <tr key={row.playerId} className="border-b border-[var(--border-soft)]">
                    <td className="py-2 pr-3 font-[600] text-[var(--foreground)]">{row.displayName}</td>
                    <td className="py-2 pr-3 text-[var(--text-soft)]">{row.coreTeamName ?? "—"}</td>
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
            {currentRoundRowsVm.sortedRows.map((row) => (
              <li key={row.playerId}>
                <PlayerCompactRow
                  playerId={row.playerId}
                  displayName={row.displayName}
                  shirtNumber={row.shirtNumber}
                  kitColor={row.kitColor}
                  primaryPosition={row.currentAssignment?.role ?? null}
                  coreTeamName={row.coreTeamName}
                  href={orgUrl(`/players/${row.playerId}`)}
                  attentionMarker={row.attentionState !== "COVERED" && row.attentionState !== "NOT_AVAILABLE"}
                  trailing={<span>{ATTENTION_LABEL[row.attentionState]}</span>}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {mode === "development" && (
        <ul className="flex flex-col divide-y divide-[var(--border-soft)]">
          {developmentRowsVm.map((row) => (
            <li key={row.playerId}>
              <PlayerCompactRow
                playerId={row.playerId}
                displayName={row.displayName}
                shirtNumber={row.shirtNumber}
                kitColor={row.kitColor}
                primaryPosition={row.effectivePositionSummary}
                coreTeamName={row.activeDevelopmentFocus ?? "No active focus"}
                href={orgUrl(`/players/${row.playerId}`)}
                trailing={row.decisionReviewState ? <span>{row.decisionReviewState}</span> : null}
              />
            </li>
          ))}
        </ul>
      )}

      {mode === "groups" && (
        <ManageBaseGroupsView
          players={players.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            coreTeam: p.coreTeam,
            primaryPosition: p.primaryPosition,
            currentAvailability: p.currentAvailability,
            nonRotatable: p.nonRotatable,
            reducedMatchLoadAllowed: p.reducedMatchLoadAllowed,
            overallRating: p.overallRating,
            removed: p.removed,
          }))}
          teams={teams}
        />
      )}
    </div>
  );
}
