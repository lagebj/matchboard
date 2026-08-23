"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Repeat } from "lucide-react";
import type { PositionExposureRow } from "@/lib/insights/insights-types";
import { topPosition, formatEvidenceCompleteness } from "@/lib/insights/position-exposure-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type PositionExposureClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function PositionExposureClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: PositionExposureClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [rows, setRows] = useState<PositionExposureRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/position-exposure?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows ?? []);
      }
    });
  }, [selectedPeriodId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/insights" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Position &amp; Formation Exposure
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Planned lineup slots and realised positions — unused lineup assignments are not realised exposure
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="pe-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="pe-period-select"
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

      {isPending && !rows && <p className="text-sm text-zinc-500">Loading position exposure...</p>}

      {rows && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Sample size</th>
                <th className="px-3 py-2">Most planned position</th>
                <th className="px-3 py-2">Most realised position</th>
                <th className="px-3 py-2">Formations experienced</th>
                <th className="px-3 py-2 text-right">Evidence completeness</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="px-3 py-2">{row.playerName}</td>
                  <td className="px-3 py-2 text-zinc-500">{row.coreTeamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.sampleSize}</td>
                  <td className="px-3 py-2 text-zinc-400">{topPosition(row.plannedPositions) ?? "Not assigned"}</td>
                  <td className="px-3 py-2 text-zinc-400">{topPosition(row.realisedPositions) ?? "Not recorded"}</td>
                  <td className="px-3 py-2 text-zinc-500">{row.formationsExperienced.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{formatEvidenceCompleteness(row.evidenceCompleteness)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No finalized selections found for this league season.</p>
          )}
        </div>
      )}
    </div>
  );
}
