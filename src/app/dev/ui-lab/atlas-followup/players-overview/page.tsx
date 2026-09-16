"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { AppearanceControl } from "@/components/touchline";
import { PlayerCompactRow } from "@/components/touchline/player/player-compact-row";
import { PlayersOverviewSurface } from "@/components/touchline/player/players-overview-surface";
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
 * Real shared Overview composition — renders the same `PlayersOverviewSurface` production uses,
 * driven by one of the seven required deterministic fixture states
 * (`07_UI_LAB_AND_VISUAL_MERGE_GATE.md §1`). Not a separate demo UI (§4 of the visual-convergence
 * follow-up) — UI-Lab must never manually rebuild this composition again.
 */
function OverviewMode({ stateKey }: { stateKey: OverviewStateKey }) {
  const fixture = overviewStates[stateKey];
  const [removed, setRemoved] = useState(false);

  return (
    <PlayersOverviewSurface
      rows={fixture.rows}
      resolveInspectorData={(playerId) => fixture.inspectorByPlayerId[playerId] ?? null}
      summary={{
        activePlayerCount: fixture.activePlayerCount,
        opportunityGapsCount: fixture.opportunityGapsCount,
        opportunityGapsDescription: "No planned match in W34 2026",
        supportUsageCount: fixture.supportUsageCount,
        developmentFocusesCount: fixture.developmentFocusesCount,
      }}
      seasonOptions={[{ id: "autumn-2026", label: "Autumn 2026" }]}
      selectedSeasonId="autumn-2026"
      onSeasonChange={() => {}}
      removedPlayerCount={fixture.removedPlayerCount}
      includeRemoved={removed}
      onToggleRemoved={() => setRemoved((v) => !v)}
      mobilePlayerHref={() => "/dev/ui-lab/atlas-followup/player-detail"}
      initialSelectedPlayerId={fixture.initialSelectedPlayerId}
      initialSearch={fixture.initialSearch}
      initialTeamFilter={fixture.initialTeamFilter}
      initialPositionFilter={fixture.initialPositionFilter}
      initialAvailabilityFilter={fixture.initialAvailabilityFilter}
    />
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
