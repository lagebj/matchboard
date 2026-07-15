"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import type { PolicyWarningGroup } from "@/lib/insights/insights-types";
import { getSeverityLabel, getSeverityStyle } from "@/lib/insights/policy-warning-review-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type PolicyWarningReviewClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

type SeverityFilter = "all" | "blocked" | "decision_required" | "planning_note";

export function PolicyWarningReviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: PolicyWarningReviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [groups, setGroups] = useState<PolicyWarningGroup[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/policy-warnings?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    });
  }, [selectedPeriodId]);

  const filteredGroups = (groups ?? []).filter((g) => {
    if (severityFilter === "all") return true;
    const groupSeverity = g.entries[0]?.severity;
    return groupSeverity === severityFilter;
  });

  const totalBlocked = (groups ?? []).reduce(
    (sum, g) => sum + g.entries.filter((e) => e.severity === "blocked").length,
    0,
  );
  const totalDecisionRequired = (groups ?? []).reduce(
    (sum, g) => sum + g.entries.filter((e) => e.severity === "decision_required").length,
    0,
  );
  const totalPlanningNotes = (groups ?? []).reduce(
    (sum, g) => sum + g.entries.filter((e) => e.severity === "planning_note").length,
    0,
  );

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
            <Eye className="h-5 w-5" />
            Policy Warning Review
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Blocked conditions, decision-required flags, and planning notes from policy evaluation
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="policy-period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="policy-period-select"
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
          <label htmlFor="severity-filter" className="text-xs text-zinc-500">
            Severity
          </label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="all">All</option>
            <option value="blocked">Blocked</option>
            <option value="decision_required">Decision required</option>
            <option value="planning_note">Planning notes</option>
          </select>
        </div>
      </div>

      {groups && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-900/30 bg-red-900/10 px-4 py-3">
            <div className="text-xs text-red-400">Blocked</div>
            <div className="text-2xl font-semibold text-red-300 mt-1">{totalBlocked}</div>
          </div>
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-3">
            <div className="text-xs text-amber-400">Decision required</div>
            <div className="text-2xl font-semibold text-amber-300 mt-1">{totalDecisionRequired}</div>
          </div>
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/30 px-4 py-3">
            <div className="text-xs text-zinc-500">Planning notes</div>
            <div className="text-2xl font-semibold text-zinc-400 mt-1">{totalPlanningNotes}</div>
          </div>
        </div>
      )}

      {isPending && !groups && (
        <p className="text-sm text-zinc-500">Loading policy warnings...</p>
      )}

      {groups && groups.length === 0 && (
        <p className="text-sm text-zinc-500">
          No policy warnings found for the selected season.
        </p>
      )}

      {filteredGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredGroups.map((group) => {
            const groupSeverity = group.entries[0]?.severity ?? "planning_note";
            return (
              <div key={group.code} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium border ${getSeverityStyle(groupSeverity)}`}>
                    {getSeverityLabel(groupSeverity)}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-200">{group.label}</h3>
                  <span className="text-xs text-zinc-500">({group.count})</span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.entries.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                      {entry.playerName && (
                        <span className="font-medium text-zinc-200">{entry.playerName}</span>
                      )}
                      {entry.teamName && (
                        <span className="text-zinc-500">{entry.teamName}</span>
                      )}
                      <span className="text-zinc-600">{entry.sourceLabel}</span>
                      {entry.message && (
                        <span className="text-zinc-400">{entry.message}</span>
                      )}
                    </div>
                  ))}
                  {group.entries.length > 10 && (
                    <p className="text-xs text-zinc-500">
                      + {group.entries.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}