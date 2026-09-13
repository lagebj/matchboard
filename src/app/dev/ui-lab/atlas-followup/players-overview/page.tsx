"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { AppearanceControl } from "@/components/touchline";
import { PlayerRosterTable } from "@/components/touchline/player/player-roster-table";
import { PlayerInspector } from "@/components/touchline/player/player-inspector";
import { PlayerCompactRow } from "@/components/touchline/player/player-compact-row";
import { buildPlayersOverviewViewModel } from "@/lib/touchline/presentation/players-overview-view-model";
import { buildPlayersCurrentRoundViewModel } from "@/lib/touchline/presentation/players-current-round-view-model";
import { buildPlayersDevelopmentViewModel } from "@/lib/touchline/presentation/players-development-view-model";
import { overviewRows, inspectorByPlayerId, currentRoundRows, developmentRows } from "./fixtures";

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

function OverviewMode() {
  const [selected, setSelected] = useState<string | null>("4");
  const inspectorData = selected ? (inspectorByPlayerId[selected] ?? null) : null;

  return (
    <>
      {/* Desktop: dense table (~9/12) + inspector (~3/12). */}
      <div className="hidden medium:grid medium:grid-cols-[3fr_1fr] medium:gap-6">
        <PlayerRosterTable rows={overviewVm.rows} selectedPlayerId={selected} onSelectPlayer={setSelected} />
        <PlayerInspector data={inspectorData} />
      </div>
      {/* Mobile: compact rows, tap opens Player Detail (no inspector). */}
      <ul className="flex flex-col divide-y divide-[var(--border-soft)] medium:hidden">
        {overviewVm.rows.map((row) => (
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
              trailing={<span>{row.hasOpportunityThisWeek ? "1/1" : "0/1"}</span>}
            />
          </li>
        ))}
      </ul>
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

      <TabRail items={MODES} activeKey={mode} ariaLabel="Players workspace modes" />

      {mode === "overview" ? <OverviewMode /> : null}
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
