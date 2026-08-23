"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";
import type { OperationalHealthGroup } from "@/lib/insights/insights-types";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type OperationalHealthClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

export function OperationalHealthClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: OperationalHealthClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [groups, setGroups] = useState<OperationalHealthGroup[] | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/operational-health?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    });
  }, [selectedPeriodId]);

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
            <Activity className="h-5 w-5" />
            Operational Health
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Concrete grouped facts about planning state — not a composite score
          </p>
        </div>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="ophealth-period-select" className="text-xs text-zinc-500">
            League season
          </label>
          <select
            id="ophealth-period-select"
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

      {isPending && !groups && (
        <p className="text-sm text-zinc-500">Loading operational health...</p>
      )}

      {groups && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <button
              key={group.category}
              type="button"
              onClick={() => setExpandedCategory(expandedCategory === group.category ? null : group.category)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                group.count > 0
                  ? "border-amber-800/30 bg-amber-900/10 hover:bg-amber-900/20"
                  : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50"
              }`}
            >
              <div className={`text-xs ${group.count > 0 ? "text-amber-400" : "text-zinc-500"}`}>{group.label}</div>
              <div className={`text-2xl font-semibold mt-1 ${group.count > 0 ? "text-amber-300" : "text-zinc-400"}`}>
                {group.count}
              </div>
            </button>
          ))}
        </div>
      )}

      {groups && expandedCategory && (
        <div className="flex flex-col gap-2">
          {groups
            .find((g) => g.category === expandedCategory)
            ?.entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-300">{entry.detail}</p>
                {entry.matchRoundLabel && (
                  <p className="text-[10px] text-zinc-600 mt-1">Round: {entry.matchRoundLabel}</p>
                )}
              </div>
            ))}
          {groups.find((g) => g.category === expandedCategory)?.entries.length === 0 && (
            <p className="text-xs text-zinc-500">No entries in this category.</p>
          )}
        </div>
      )}
    </div>
  );
}
