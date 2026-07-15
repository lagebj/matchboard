"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Eye,
  GitCompare,
  ShieldAlert,
  Table2,
} from "lucide-react";
import type { InsightOverview } from "@/lib/insights/insights-types";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type InsightsOverviewClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

const SURFACE_CARDS = [
  {
    href: "/insights/opportunity",
    icon: Table2,
    label: "Opportunity Matrix",
    description: "Player participation by round — who gets match opportunities, who doesn't, and why",
  },
  {
    href: "/insights/load",
    icon: BarChart3,
    label: "Load Timeline",
    description: "Match load per player over time — identify high recent load and rest patterns",
  },
  {
    href: "/insights/coverage",
    icon: ShieldAlert,
    label: "Squad Coverage",
    description: "Goalkeeper and position coverage per squad — spot structural gaps before matchday",
  },
  {
    href: "/insights/policy-warnings",
    icon: Eye,
    label: "Policy Warning Review",
    description: "Blocked conditions, decision-required flags, and planning notes from policy evaluation",
  },
  {
    href: "/insights/planned-vs-actual",
    icon: GitCompare,
    label: "Planned vs Actual",
    description: "Compare planned squads with actual participation — unplanned additions, absences, role changes",
  },
  {
    href: "/insights/conflicts",
    icon: CalendarRange,
    label: "Conflict Review",
    description: "Overlapping selections, helper conflicts, and double-planned players across rounds",
  },
];

export function InsightsOverviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: InsightsOverviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [overview, setOverview] = useState<InsightOverview | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/overview?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    });
  }, [selectedPeriodId]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Insights</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Visual decision review and coaching insight surfaces
        </p>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-3">
          <label htmlFor="league-season-select" className="text-sm text-zinc-400">
            League season
          </label>
          <select
            id="league-season-select"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
          >
            {leagueSeasons.map((ls) => (
              <option key={ls.id} value={ls.id}>
                {ls.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Players with no opportunity"
            value={overview.playersWithNoOpportunity}
            accent={overview.playersWithNoOpportunity > 0}
          />
          <SummaryCard
            label="Players with high load"
            value={overview.playersWithHighLoad}
            accent={overview.playersWithHighLoad > 0}
          />
          <SummaryCard
            label="Missing reports"
            value={overview.matchesWithMissingReports}
            accent={overview.matchesWithMissingReports > 0}
          />
          <SummaryCard
            label="Policy warnings"
            value={overview.policyWarningsCount}
            accent={overview.policyWarningsCount > 0}
          />
        </div>
      )}

      {isPending && !overview && (
        <p className="text-sm text-zinc-500">Loading insights...</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACE_CARDS.map((card) => (
          <Link
            key={card.href}
            href={`${card.href}?leagueSeasonId=${selectedPeriodId}`}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <card.icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-200" />
              <h2 className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                {card.label}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`text-2xl font-semibold mt-1 ${
          accent ? "text-amber-400" : "text-zinc-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}