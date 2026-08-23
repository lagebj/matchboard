"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";
import type { OpportunityQualityEntry } from "@/lib/insights/insights-types";
import { formatAttendanceLabel } from "@/lib/insights/opportunity-quality-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type OpportunityQualityClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function OpportunityQualityClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: OpportunityQualityClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [entries, setEntries] = useState<OpportunityQualityEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/opportunity-quality?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
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
            <ListChecks className="h-5 w-5" />
            Opportunity Quality
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Factual context for every planned opportunity — team, role, position, and realised attendance
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="oq-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="oq-period-select"
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

      {isPending && !entries && <p className="text-sm text-zinc-500">Loading opportunity quality...</p>}

      {entries && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Round</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Opponent</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Realised</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.playerId}-${e.matchId}-${i}`} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="px-3 py-2">{e.playerName}</td>
                  <td className="px-3 py-2 text-zinc-500">{e.matchRoundLabel}</td>
                  <td className="px-3 py-2 text-zinc-500">{e.teamName}</td>
                  <td className="px-3 py-2 text-zinc-500">{e.opponentName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {e.isCore ? "Core" : e.role === "DEVELOPMENT" ? "Development" : "Support"}
                    {e.cancelled && <span className="ml-1 text-[10px] text-zinc-600">(cancelled)</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{e.plannedPosition ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        e.realisedAttendance === "present"
                          ? "text-emerald-400"
                          : e.realisedAttendance === "no_show"
                            ? "text-red-400"
                            : "text-zinc-500"
                      }
                    >
                      {formatAttendanceLabel(e.realisedAttendance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No finalized selections found for this league season.</p>
          )}
        </div>
      )}
    </div>
  );
}
