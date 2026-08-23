"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingDown } from "lucide-react";
import type { OpportunityGapRow } from "@/lib/insights/insights-types";
import { sortByGapDescending } from "@/lib/insights/opportunity-gap-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type OpportunityGapClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function OpportunityGapClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: OpportunityGapClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [rows, setRows] = useState<OpportunityGapRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/opportunity-gap?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows ?? []);
      }
    });
  }, [selectedPeriodId]);

  const sortedRows = rows ? sortByGapDescending(rows) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/insights" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Opportunity Gap
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Planned vs realised opportunity — descriptive context, not a debt score
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="gap-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="gap-period-select"
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

      {isPending && !rows && <p className="text-sm text-zinc-500">Loading opportunity gap...</p>}

      {rows && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Planned</th>
                <th className="px-3 py-2 text-right">Realised</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2 text-right">Unavailable rounds</th>
                <th className="px-3 py-2 text-right">Cancelled matches</th>
                <th className="px-3 py-2 text-right">No-shows</th>
                <th className="px-3 py-2 text-right">Unknown attendance</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.playerId} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="px-3 py-2">{row.playerName}</td>
                  <td className="px-3 py-2 text-zinc-500">{row.coreTeamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.plannedOpportunities}</td>
                  <td className="px-3 py-2 text-right">{row.realisedOpportunities}</td>
                  <td className={`px-3 py-2 text-right ${row.gap > 0 ? "text-amber-400" : "text-zinc-500"}`}>{row.gap}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.unavailableRounds}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.cancelledMatches}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.noShowCount}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.unknownAttendanceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedRows.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No players found for this league season.</p>
          )}
        </div>
      )}
    </div>
  );
}
