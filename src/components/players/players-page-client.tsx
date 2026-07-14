"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PlayersModeTabs, usePlayersMode } from "./players-mode-tabs";
import { SeasonOverviewTable } from "./season-overview-table";
import { CurrentRoundAttentionTable } from "./current-round-attention-table";
import { ManageBaseGroupsView } from "./manage-base-groups-view";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow } from "@/lib/players/get-players-overview";
import type { RatingSummary } from "@/lib/ratings/player-rating";
import { formatLeagueSeasonDisplay } from "@/lib/date/format-phase-display";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { MetricTile } from "@/components/ui/metric-tile";
import { Users } from "lucide-react";

type PlayersPageClientProps = {
  players: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    coreTeamId: string | null;
    coreTeam: { id: string; name: string } | null;
    primaryPosition: string | null;
    currentAvailability: string;
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
  selectedPeriodId: string;
  selectedRoundId?: string;
  includeRemoved?: boolean;
  removedPlayerCount?: number;
  initialMode?: string;
  error?: string;
  saved?: string;
};

export function PlayersPageClient({
  players,
  teams,
  leagueSeasons,
  matchRounds,
  seasonRows,
  currentRoundRows,
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
  const { mode, setMode } = usePlayersMode(
    (initialMode === "attention" ? "attention" : initialMode === "groups" ? "groups" : "season") as "season" | "attention" | "groups",
  );

  const selectedPeriod = leagueSeasons.find((p) => p.id === selectedPeriodId);
  const selectedRound = matchRounds.find((r) => r.id === selectedRoundId);
  const periodLabel = selectedPeriod ? formatLeagueSeasonDisplay({ seasonName: selectedPeriod.name, leagueSeasonName: selectedPeriod.name, startDate: new Date(selectedPeriod.startDate), endDate: new Date(selectedPeriod.endDate) }).combinedLabel : "No league season";
  const roundLabel = selectedRound?.name ?? "No round selected";

  const roundsForPeriod = matchRounds.filter((r) => r.leagueSeasonId === selectedPeriodId);

  function navigate(params: Record<string, string | undefined>) {
    const all = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") {
        all.delete(key);
      } else {
        all.set(key, value);
      }
    }
    router.push(`/players?${all.toString()}`);
  }

  const selectClass =
    "h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs text-zinc-300 outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)] max-w-[180px] sm:max-w-none";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Players"
        description="Participation, movement and current planning attention."
        actions={
          teams.length > 0 ? (
            <Button variant="primary" size="sm" as="a" href="/players/new">
              Add player
            </Button>
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
                ? "border-amber-700/50 bg-amber-950/30 text-amber-300"
                : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50"
            }`}
          >
            {includeRemoved ? "Hide removed" : `Show removed (${removedPlayerCount})`}
          </button>
        )}
      </div>

      <PlayersModeTabs mode={mode} onModeChange={setMode} />

      {mode === "season" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">League season:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "season" })}
                className={selectClass}
              >
                {leagueSeasons.map((p) => (
                  <option key={p.id} value={p.id}>{formatLeagueSeasonDisplay({ seasonName: p.name, leagueSeasonName: p.name, startDate: new Date(p.startDate), endDate: new Date(p.endDate) }).combinedLabel}</option>
                ))}
              </select>
            </label>
          </div>
          <SeasonOverviewTable
            rows={seasonRows}
            leagueSeasonLabel={periodLabel}
            teams={teams}
          />
        </>
      )}

      {mode === "attention" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">League season:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "attention" })}
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
                onChange={(e) => navigate({ roundId: e.target.value, mode: "attention" })}
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
          <CurrentRoundAttentionTable
            rows={currentRoundRows}
            roundLabel={roundLabel}
            roundId={selectedRoundId ?? ""}
            teams={teams}
          />
        </>
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