"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import type { MatchPhasePatternRow } from "@/lib/evidence/match-phase-pattern-evidence";

type LeagueSeasonOption = { id: string; name: string; startDate: string; endDate: string };
type TeamOption = { id: string; name: string };

type MatchPhasePatternsClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: TeamOption[];
  activeTeamId: string | null;
};

const PERIOD_LABELS: Record<string, string> = {
  FIRST_HALF: "First half",
  SECOND_HALF: "Second half",
  EXTRA_FIRST_HALF: "ET — 1st half",
  EXTRA_SECOND_HALF: "ET — 2nd half",
};

const PHASE_LABELS: Record<string, string> = {
  OPENING_5: "Opening 5",
  OPENING_10: "Opening 10",
  IMMEDIATELY_AFTER_RESTART: "Immediately after restart",
  LATE_PERIOD: "Late period",
  FINAL_10: "Final 10",
  FINAL_5: "Final 5",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  INSUFFICIENT: "Insufficient",
  EMERGING: "Emerging",
  ESTABLISHED: "Established",
};

/**
 * Evidence-Informed Match Planning programme, Bundle 3: "do we repeatedly concede in the
 * opening ten minutes?"-style historical patterns for one team's League season, with explicit
 * exposure (matches, minutes) and confidence — never an opaque score (PROGRAMME.md's
 * observability requirement, ADR-0114 for the underlying aggregation).
 */
export function MatchPhasePatternsClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
  activeTeamId,
}: MatchPhasePatternsClientProps) {
  const [selectedLeagueSeasonId, setSelectedLeagueSeasonId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [selectedTeamId, setSelectedTeamId] = useState(activeTeamId ?? teams[0]?.id ?? "");
  const [patterns, setPatterns] = useState<MatchPhasePatternRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedLeagueSeasonId || !selectedTeamId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/insights/match-phase-patterns?leagueSeasonId=${selectedLeagueSeasonId}&teamId=${selectedTeamId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns ?? []);
      }
    });
  }, [selectedLeagueSeasonId, selectedTeamId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/insights" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Match Timing Patterns
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Repeated goal patterns by match phase, with exposure and confidence — a descriptive record, not a prediction.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="mpp-season-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="mpp-season-select"
              value={selectedLeagueSeasonId}
              onChange={(e) => setSelectedLeagueSeasonId(e.target.value)}
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
        {teams.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="mpp-team-select" className="text-xs text-zinc-500">
              Team
            </label>
            <select
              id="mpp-team-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isPending && !patterns && <p className="text-sm text-zinc-500">Loading match phase patterns...</p>}

      {patterns && patterns.length === 0 && (
        <p className="text-sm text-zinc-400">No completed matches yet for this team and league season.</p>
      )}

      {patterns && patterns.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Window</th>
                <th className="px-3 py-2">Matches</th>
                <th className="px-3 py-2">Exposure (min)</th>
                <th className="px-3 py-2">Goals for</th>
                <th className="px-3 py-2">Goals against</th>
                <th className="px-3 py-2">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {patterns.map((row) => (
                <tr key={`${row.period}:${row.phase}`} className="text-zinc-200">
                  <td className="px-3 py-2 whitespace-nowrap">{PERIOD_LABELS[row.period] ?? row.period}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{PHASE_LABELS[row.phase] ?? row.phase}</td>
                  <td className="px-3 py-2">{row.matches}</td>
                  <td className="px-3 py-2">{row.exposureMinutes}</td>
                  <td className="px-3 py-2">{row.goalsFor}</td>
                  <td className="px-3 py-2">{row.goalsAgainst}</td>
                  <td className="px-3 py-2">{CONFIDENCE_LABELS[row.confidence] ?? row.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
