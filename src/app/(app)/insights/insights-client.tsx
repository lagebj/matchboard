"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Eye,
  GitCompare,
  ShieldAlert,
  Table2,
  ListChecks,
  TrendingDown,
  Repeat,
  Users2,
  Shuffle,
  Activity,
  Clock,
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

type OverviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: InsightOverview }
  | { status: "error"; message: string };

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
  {
    href: "/insights/opportunity-quality",
    icon: ListChecks,
    label: "Opportunity Quality",
    description: "Factual context for every planned opportunity — team, role, position, and realised attendance",
  },
  {
    href: "/insights/opportunity-gap",
    icon: TrendingDown,
    label: "Opportunity Gap",
    description: "Planned vs realised opportunity over a period — descriptive, not a debt score",
  },
  {
    href: "/insights/position-exposure",
    icon: Repeat,
    label: "Position & Formation Exposure",
    description: "Planned lineup slots and realised positions per player — unused assignments don't count",
  },
  {
    href: "/insights/player-combinations",
    icon: Users2,
    label: "Player Combinations",
    description: "Co-selection and co-appearance frequency between players — frequency is not effectiveness",
  },
  {
    href: "/insights/continuity",
    icon: Shuffle,
    label: "Continuity vs Exploration",
    description: "Round-over-round retained vs new players and formation repeats per team",
  },
  {
    href: "/insights/operational-health",
    icon: Activity,
    label: "Operational Health",
    description: "Concrete grouped facts about planning state — incomplete lineups, missing reports, stale assignments",
  },
  {
    href: "/insights/match-phase-patterns",
    icon: Clock,
    label: "Match Timing Patterns",
    description: "Repeated goal patterns by match phase (opening minutes, late period) — descriptive, with confidence",
  },
];

function isNumericOverview(data: unknown): data is InsightOverview {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  const numericFields: (keyof InsightOverview)[] = [
    "totalPlayers",
    "playersWithNoOpportunity",
    "playersWithHighLoad",
    "matchesWithMissingReports",
    "matchesWithCoverageWarnings",
    "policyWarningsCount",
    "plannedActualDeltasCount",
    "conflictsCount",
  ];
  return numericFields.every((field) => typeof obj[field] === "number" && Number.isFinite(obj[field] as number));
}

export function InsightsOverviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: InsightsOverviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [overviewState, setOverviewState] = useState<OverviewState>({ status: "idle" });
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedPeriodId) return;

    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const loadOverview = async () => {
      setOverviewState({ status: "loading" });

      try {
        const res = await fetch(
          `/api/insights/overview?leagueSeasonId=${selectedPeriodId}`,
          { signal: controller.signal },
        );

        if (cancelled) return;

        if (res.status === 401) {
          setOverviewState({ status: "error", message: "You are not authorized to view insights." });
          return;
        }

        if (!res.ok) {
          setOverviewState({ status: "error", message: "Failed to load insights overview. Try again." });
          return;
        }

        const data = await res.json();

        if (cancelled) return;

        if (!isNumericOverview(data)) {
          setOverviewState({
            status: "error",
            message: "Received an invalid response from the server. Please try again.",
          });
          return;
        }

        setOverviewState({ status: "success", data });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (cancelled) return;
        setOverviewState({ status: "error", message: "Failed to load insights overview. Try again." });
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedPeriodId, retryKey]);

  const handleRetry = () => {
    setRetryKey((k) => k + 1);
  };

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

      {overviewState.status === "success" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Players with no opportunity"
            value={overviewState.data.playersWithNoOpportunity}
            accent={overviewState.data.playersWithNoOpportunity > 0}
          />
          <SummaryCard
            label="Players with high load"
            value={overviewState.data.playersWithHighLoad}
            accent={overviewState.data.playersWithHighLoad > 0}
          />
          <SummaryCard
            label="Missing reports"
            value={overviewState.data.matchesWithMissingReports}
            accent={overviewState.data.matchesWithMissingReports > 0}
          />
          <SummaryCard
            label="Policy warnings"
            value={overviewState.data.policyWarningsCount}
            accent={overviewState.data.policyWarningsCount > 0}
          />
        </div>
      )}

      {overviewState.status === "loading" && (
        <p className="text-sm text-zinc-500">Loading insights...</p>
      )}

      {overviewState.status === "error" && (
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
          <p className="text-sm text-red-300">{overviewState.message}</p>
          <button
            onClick={handleRetry}
            className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACE_CARDS.map((card) => (
          <Link
            key={card.href}
            href={`${card.href}?leagueSeasonId=${encodeURIComponent(selectedPeriodId)}`}
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