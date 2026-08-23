"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shuffle } from "lucide-react";
import type { ContinuityRow } from "@/lib/insights/insights-types";
import { formatFormationChange } from "@/lib/insights/continuity-review-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type ContinuityReviewClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function ContinuityReviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: ContinuityReviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [rows, setRows] = useState<ContinuityRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/continuity?leagueSeasonId=${selectedPeriodId}`,
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
            <Shuffle className="h-5 w-5" />
            Continuity vs Exploration
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Round-over-round comparison — facts only, no prescribed ideal balance
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="cr-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="cr-period-select"
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

      {isPending && !rows && <p className="text-sm text-zinc-500">Loading continuity review...</p>}

      {rows && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Round</th>
                <th className="px-3 py-2 text-right">Retained</th>
                <th className="px-3 py-2 text-right">New</th>
                <th className="px-3 py-2 text-right">Role changes</th>
                <th className="px-3 py-2">Formation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.teamId}-${row.matchRoundId}-${i}`} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="px-3 py-2">{row.teamName}</td>
                  <td className="px-3 py-2 text-zinc-500">{row.matchRoundLabel}</td>
                  <td className="px-3 py-2 text-right">{row.retainedStarterCount}</td>
                  <td className="px-3 py-2 text-right">{row.newPlayerCount}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.supportPlayerChanges}</td>
                  <td className="px-3 py-2 text-zinc-500">{formatFormationChange(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No round-over-round data found for this league season.</p>
          )}
        </div>
      )}
    </div>
  );
}
