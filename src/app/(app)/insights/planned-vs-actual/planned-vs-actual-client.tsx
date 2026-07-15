"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompare } from "lucide-react";
import type { PlannedActualDelta } from "@/lib/insights/insights-types";
import { getDeltaTypeLabel, getDeltaTypeStyle } from "@/lib/insights/planned-vs-actual-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type PlannedVsActualClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: Array<{ id: string; name: string }>;
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reported: "Reported",
  locked: "Locked",
  missing: "No report",
};

const REPORT_STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-900/25 text-amber-300",
  reported: "bg-emerald-900/25 text-emerald-300",
  locked: "bg-emerald-800/40 text-emerald-200",
  missing: "bg-red-900/25 text-red-300",
};

type TeamFilter = "all" | string;

export function PlannedVsActualClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: PlannedVsActualClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [deltas, setDeltas] = useState<PlannedActualDelta[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const params = new URLSearchParams({
        leagueSeasonId: selectedPeriodId,
        scope: "full_year",
        context: "league",
      });
      if (teamFilter !== "all") {
        params.set("teamId", teamFilter);
      }
      const res = await fetch(`/api/insights/planned-vs-actual?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDeltas(data.deltas ?? []);
      }
    });
  }, [selectedPeriodId, teamFilter]);

  const filteredDeltas = (deltas ?? []).filter((d) =>
    teamFilter === "all" ? true : d.teamId === teamFilter,
  );

  const deltasWithDifferences = filteredDeltas.filter((d) => d.deltas.length > 0);
  const totalDeltas = filteredDeltas.reduce((sum, d) => sum + d.deltas.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/insights"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Planned vs Actual
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Compare planned squads with actual participation — unplanned additions, absences, role changes
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="pva-period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="pva-period-select"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
            >
              {leagueSeasons.map((ls) => (
                <option key={ls.id} value={ls.id}>
                  {ls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="pva-team-filter" className="text-xs text-zinc-500">
            Team
          </label>
          <select
            id="pva-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {deltas && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div className="text-xs text-zinc-500">Matches</div>
            <div className="text-2xl font-semibold text-zinc-200 mt-1">
              {filteredDeltas.length}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div className="text-xs text-zinc-500">With differences</div>
            <div className="text-2xl font-semibold text-amber-300 mt-1">
              {deltasWithDifferences.length}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div className="text-xs text-zinc-500">Total deltas</div>
            <div className="text-2xl font-semibold text-zinc-200 mt-1">
              {totalDeltas}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div className="text-xs text-zinc-500">Missing reports</div>
            <div className="text-2xl font-semibold text-red-300 mt-1">
              {filteredDeltas.filter((d) => d.reportStatus === "missing").length}
            </div>
          </div>
        </div>
      )}

      {isPending && !deltas && (
        <p className="text-sm text-zinc-500">Loading planned vs actual data...</p>
      )}

      {deltas && deltas.length === 0 && (
        <p className="text-sm text-zinc-500">
          No match data found for the selected season.
        </p>
      )}

      {deltasWithDifferences.length > 0 && (
        <div className="flex flex-col gap-4">
          {deltasWithDifferences.map((delta) => (
            <div key={delta.matchId} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-zinc-200">{delta.teamName}</span>
                <span className="text-xs text-zinc-500">Round: {delta.matchRoundLabel}</span>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${REPORT_STATUS_STYLES[delta.reportStatus] ?? ""}`}>
                  {REPORT_STATUS_LABELS[delta.reportStatus] ?? delta.reportStatus}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {delta.deltas.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getDeltaTypeStyle(entry.deltaType)}`}>
                      {getDeltaTypeLabel(entry.deltaType)}
                    </span>
                    <span className="font-medium text-zinc-200">{entry.playerName}</span>
                    {entry.plannedRole && (
                      <span className="text-zinc-500">Planned: {entry.plannedRole}</span>
                    )}
                    {entry.detail && (
                      <span className="text-zinc-500">{entry.detail}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {deltas && deltas.length > 0 && deltasWithDifferences.length === 0 && (
        <div className="rounded-2xl border border-emerald-900/30 bg-emerald-900/10 p-6 text-center">
          <p className="text-sm text-emerald-300">All planned squads match actual participation. No differences found.</p>
        </div>
      )}
    </div>
  );
}