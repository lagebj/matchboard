"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users2 } from "lucide-react";
import type { PlayerCombinationRow } from "@/lib/insights/insights-types";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

function formatPartnership(subtype: string): string {
  const labels: Record<string, string> = {
    HORIZONTAL: "Horizontal",
    VERTICAL: "Vertical",
    GOALKEEPER_LINK: "GK link",
  };
  return labels[subtype] ?? subtype;
}

function formatConfidence(confidence: string): string {
  const labels: Record<string, string> = {
    INSUFFICIENT: "Insufficient",
    EMERGING: "Emerging",
    ESTABLISHED: "Established",
  };
  return labels[confidence] ?? confidence;
}

type PlayerCombinationsClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function PlayerCombinationsClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: PlayerCombinationsClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [rows, setRows] = useState<PlayerCombinationRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/player-combinations?leagueSeasonId=${selectedPeriodId}`,
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
            <Users2 className="h-5 w-5" />
            Player Combinations
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Co-selection and co-appearance frequency — frequency is not effectiveness
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="pc-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="pc-period-select"
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

      {isPending && !rows && <p className="text-sm text-zinc-500">Loading player combinations...</p>}

      {rows && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2">Position pairing</th>
                <th className="px-3 py-2">Partnership</th>
                <th className="px-3 py-2 text-right">Co-selected</th>
                <th className="px-3 py-2 text-right">Realised together</th>
                <th className="px-3 py-2 text-right">Minutes together</th>
                <th className="px-3 py-2 text-right">Confidence</th>
                <th className="px-3 py-2 text-right">Recent ({4})</th>
                <th className="px-3 py-2 text-right">Season total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.playerAId}-${row.playerBId}`} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="px-3 py-2">
                    {row.playerAName} &amp; {row.playerBName}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{row.positionPairing ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{row.partnershipSubtype ? formatPartnership(row.partnershipSubtype) : "—"}</td>
                  <td className="px-3 py-2 text-right">{row.coSelectionCount}</td>
                  <td className="px-3 py-2 text-right">{row.realisedCoAppearanceCount}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.minutesTogether != null ? `${Math.round(row.minutesTogether)}m` : "—"}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.confidence ? formatConfidence(row.confidence) : "—"}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.recentTotal}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{row.seasonTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No player combinations found for this league season.</p>
          )}
        </div>
      )}
    </div>
  );
}
