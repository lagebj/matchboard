"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlayersModeTabs, usePlayersMode } from "./players-mode-tabs";
import { SeasonOverviewTable } from "./season-overview-table";
import { CurrentRoundAttentionTable } from "./current-round-attention-table";
import { ManageBaseGroupsView } from "./manage-base-groups-view";
import type { PlayerSeasonOverviewRow, PlayerCurrentRoundAttentionRow } from "@/lib/players/get-players-overview";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";

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
  }>;
  teams: Array<{ id: string; name: string }>;
  planningPeriods: Array<{ id: string; name: string; startDate: Date; endDate: Date }>;
  matchRounds: Array<{ id: string; name: string; planningPeriodId?: string | null }>;
  seasonRows: PlayerSeasonOverviewRow[];
  roundColumns: Array<{ id: string; name: string }>;
  currentRoundRows: PlayerCurrentRoundAttentionRow[];
  selectedPeriodId: string;
  selectedRoundId?: string;
  initialMode?: string;
  error?: string;
  saved?: string;
};

export function PlayersPageClient({
  players,
  teams,
  planningPeriods,
  matchRounds,
  seasonRows,
  roundColumns,
  currentRoundRows,
  selectedPeriodId,
  selectedRoundId,
  initialMode,
  error,
  saved,
}: PlayersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, setMode } = usePlayersMode(
    (initialMode === "attention" ? "attention" : initialMode === "groups" ? "groups" : "season") as "season" | "attention" | "groups",
  );

  const selectedPeriod = planningPeriods.find((p) => p.id === selectedPeriodId);
  const selectedRound = matchRounds.find((r) => r.id === selectedRoundId);
  const periodLabel = selectedPeriod ? formatPhaseDisplay({ seasonName: selectedPeriod.name, phaseName: selectedPeriod.name, startDate: new Date(selectedPeriod.startDate), endDate: new Date(selectedPeriod.endDate) }).combinedLabel : "No phase";
  const roundLabel = selectedRound?.name ?? "No round selected";

  const roundsForPeriod = matchRounds.filter((r) => r.planningPeriodId === selectedPeriodId);

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
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Players</h1>
        <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">
          Participation, movement and current planning attention.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {saved === "created" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Player created.</div>
      )}
      {saved === "removed" && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Player removed.</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-500">{players.length} player{players.length !== 1 ? "s" : ""}</span>
        </div>
        {teams.length > 0 && (
          <Link
            href="/players/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] shrink-0"
          >
            Add player
          </Link>
        )}
      </div>

      <PlayersModeTabs mode={mode} onModeChange={setMode} />

      {mode === "season" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Phase:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "season" })}
                className={selectClass}
              >
                {planningPeriods.map((p) => (
                  <option key={p.id} value={p.id}>{formatPhaseDisplay({ seasonName: p.name, phaseName: p.name, startDate: new Date(p.startDate), endDate: new Date(p.endDate) }).combinedLabel}</option>
                ))}
              </select>
            </label>
          </div>
          <SeasonOverviewTable
            rows={seasonRows}
            roundColumns={roundColumns}
            planningPeriodLabel={periodLabel}
            teams={teams}
          />
        </>
      )}

      {mode === "attention" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Phase:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => navigate({ periodId: e.target.value, mode: "attention" })}
                className={selectClass}
              >
                {planningPeriods.map((p) => (
                  <option key={p.id} value={p.id}>{formatPhaseDisplay({ seasonName: p.name, phaseName: p.name, startDate: new Date(p.startDate), endDate: new Date(p.endDate) }).combinedLabel}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Round:</span>
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
          }))}
          teams={teams}
        />
      )}
    </div>
  );
}