"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import type { ConflictEntry } from "@/lib/insights/insights-types";
import { getConflictTypeLabel, getConflictTypeStyle } from "@/lib/insights/conflict-review-helpers";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type ConflictReviewClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

type SeverityFilter = "all" | "blocked" | "decision_required" | "planning_note";

export function ConflictReviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: ConflictReviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [conflicts, setConflicts] = useState<ConflictEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/conflicts?leagueSeasonId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setConflicts(data.conflicts ?? []);
      }
    });
  }, [selectedPeriodId]);

  const filteredConflicts = (conflicts ?? []).filter((c) => {
    if (severityFilter === "all") return true;
    return c.severity === severityFilter;
  });

  const blockedCount = (conflicts ?? []).filter((c) => c.severity === "blocked").length;
  const decisionRequiredCount = (conflicts ?? []).filter((c) => c.severity === "decision_required").length;
  const planningNoteCount = (conflicts ?? []).filter((c) => c.severity === "planning_note").length;

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
            <CalendarRange className="h-5 w-5" />
            Conflict Review
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Overlapping selections, helper conflicts, and double-planned players across rounds
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="conflict-period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="conflict-period-select"
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
          <label htmlFor="conflict-severity-filter" className="text-xs text-zinc-500">
            Severity
          </label>
          <select
            id="conflict-severity-filter"
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

      {conflicts && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-900/30 bg-red-900/10 px-4 py-3">
            <div className="text-xs text-red-400">Blocked</div>
            <div className="text-2xl font-semibold text-red-300 mt-1">{blockedCount}</div>
          </div>
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-3">
            <div className="text-xs text-amber-400">Decision required</div>
            <div className="text-2xl font-semibold text-amber-300 mt-1">{decisionRequiredCount}</div>
          </div>
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/30 px-4 py-3">
            <div className="text-xs text-zinc-500">Planning notes</div>
            <div className="text-2xl font-semibold text-zinc-400 mt-1">{planningNoteCount}</div>
          </div>
        </div>
      )}

      {isPending && !conflicts && (
        <p className="text-sm text-zinc-500">Loading conflicts...</p>
      )}

      {conflicts && conflicts.length === 0 && (
        <div className="rounded-2xl border border-emerald-900/30 bg-emerald-900/10 p-6 text-center">
          <p className="text-sm text-emerald-300">No conflicts detected. All selections are valid.</p>
        </div>
      )}

      {filteredConflicts.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredConflicts.map((conflict, i) => (
            <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium border ${getConflictTypeStyle(conflict.conflictType)}`}>
                  {getConflictTypeLabel(conflict.conflictType)}
                </span>
                {conflict.playerName && (
                  <span className="text-sm font-medium text-zinc-200">{conflict.playerName}</span>
                )}
                {conflict.teamName && (
                  <span className="text-xs text-zinc-500">{conflict.teamName}</span>
                )}
              </div>
              <p className="text-xs text-zinc-400">{conflict.detail}</p>
              {conflict.matchRoundLabel && (
                <p className="text-[10px] text-zinc-600 mt-1">Round: {conflict.matchRoundLabel}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}