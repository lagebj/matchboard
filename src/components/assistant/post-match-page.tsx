"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SelectionRole } from "@/generated/prisma/client";
import {
  seedPostMatchReport,
  addGoalToReport,
  removeGoalFromReport,
  updateMatchResult,
  addPlayerAppearance,
  removePlayerAppearance,
  finalizePostMatchReport,
} from "@/app/(app)/matches/[matchId]/post-match/actions";

type PlayerActual = {
  id: string;
  playerId: string;
  playerName: string;
  coreTeamName: string;
  source: string;
  attendanceStatus: string;
  selectionRole?: string;
};

type GoalData = {
  id: string;
  playerId: string | null;
  playerName?: string;
  minute: number | null;
  type: string;
};

type ReportData = {
  id: string;
  matchId: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  teamNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
  playerActuals: PlayerActual[];
  goals: GoalData[];
  teamName: string;
  opponent: string;
  homeAway: string;
  plannedSelections: PlannedSelection[];
};

type PlannedSelection = {
  playerId: string;
  playerName: string;
  coreTeamName: string;
  role: SelectionRole;
};

const _ATTENDANCE_OPTIONS = ["PRESENT", "NO_SHOW", "LATE_CANCELLATION", "ABSENT_CONFIRMED", "UNKNOWN"] as const;

function _attendanceLabel(status: string): string {
  const map: Record<string, string> = {
    PRESENT: "Present",
    NO_SHOW: "No-show",
    LATE_CANCELLATION: "Late cancellation",
    ABSENT_CONFIRMED: "Absent confirmed",
    UNKNOWN: "Unknown",
  };
  return map[status] ?? status;
}

function sourceLabel(source: string): string {
  return source === "PLANNED" ? "From plan" : "Added manually";
}

const ROLE_ORDER: SelectionRole[] = ["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT"];

const ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  BACKFILL: "Squad repair",
  DEVELOPMENT: "Development",
};

export function PostMatchPage({ matchId, initialReport }: { matchId: string; initialReport: ReportData | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const report = initialReport;
  const [homeGoals, setHomeGoals] = useState(initialReport?.homeGoals?.toString() ?? "");
  const [awayGoals, setAwayGoals] = useState(initialReport?.awayGoals?.toString() ?? "");
  const [teamNote, setTeamNote] = useState(initialReport?.teamNote ?? "");
  const [newPlayerId, setNewPlayerId] = useState("");
  const [newGoalPlayerId, setNewGoalPlayerId] = useState("");
  const [newGoalMinute, setNewGoalMinute] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSeed = () => {
    setError(null);
    startTransition(async () => {
      const result = await seedPostMatchReport(matchId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to create report.");
      }
    });
  };

  const handleSaveResult = () => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMatchResult(report.id, {
        homeGoals: homeGoals === "" ? undefined : parseInt(homeGoals, 10),
        awayGoals: awayGoals === "" ? undefined : parseInt(awayGoals, 10),
        teamNote: teamNote || undefined,
      });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to save result.");
      }
    });
  };

  const handleAddPlayer = () => {
    if (!report || !newPlayerId.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addPlayerAppearance(report.id, {
        playerId: newPlayerId.trim(),
        attendanceStatus: "PRESENT",
      });
      if (result.success) {
        setNewPlayerId("");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to add player.");
      }
    });
  };

  const handleRemovePlayer = (appearanceId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removePlayerAppearance(appearanceId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to remove player.");
      }
    });
  };

  const handleAddGoal = () => {
    if (!report || !newGoalPlayerId) return;
    setError(null);
    startTransition(async () => {
      const result = await addGoalToReport(report.id, {
        playerId: newGoalPlayerId || undefined,
        minute: newGoalMinute ? parseInt(newGoalMinute, 10) : undefined,
        type: "NORMAL",
      });
      if (result.success) {
        setNewGoalPlayerId("");
        setNewGoalMinute("");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to add goal.");
      }
    });
  };

  const handleRemoveGoal = (goalId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeGoalFromReport(goalId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to remove goal.");
      }
    });
  };

  const handleFinalize = () => {
    if (!report) return;
    if (!confirm("Finalize this post-match report? It cannot be edited after finalization.")) return;
    setError(null);
    startTransition(async () => {
      const result = await finalizePostMatchReport(report.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to finalize report.");
      }
    });
  };

  if (!report) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
            &larr; Back to match
          </Link>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-5 py-6 text-center">
          <p className="text-sm text-zinc-300">No post-match report yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Seed from planned selections to begin recording actuals.</p>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 transition disabled:opacity-50"
            disabled={isPending}
            onClick={handleSeed}
            type="button"
          >
            {isPending ? "Seeding..." : "Seed from plan"}
          </button>
        </div>
        {error && (
          <div className="rounded-lg border border-red-700/40 bg-red-900/15 px-4 py-2 text-sm text-red-300">{error}</div>
        )}
      </div>
    );
  }

  const isCompleted = report.status === "COMPLETED";
  const plannedByRole = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role] ?? role,
    players: report.plannedSelections.filter((s) => s.role === role),
  })).filter((g) => g.players.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
          &larr; Back to match
        </Link>
        <span className="text-xs text-[var(--text-muted)]">|</span>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Post-match registration</p>
      </div>

      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-zinc-50">{report.teamName} vs {report.opponent}</p>
            <p className="text-sm text-[var(--text-muted)]">{report.homeAway === "HOME" ? "Home" : "Away"} match</p>
          </div>
          <span className={`rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isCompleted
              ? "border-emerald-700/40 bg-emerald-900/15 text-emerald-300"
              : "border-amber-700/40 bg-amber-900/15 text-amber-300"
          }`}>
            {isCompleted ? "Completed" : "In progress"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/15 px-4 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Result */}
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-3">Result</h2>
        {isCompleted ? (
          <p className="text-lg font-bold text-zinc-50">
            {report.homeGoals ?? 0} &ndash; {report.awayGoals ?? 0}
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">{report.homeAway === "HOME" ? report.teamName : report.opponent}:</label>
              <input
                type="number"
                min="0"
                value={homeGoals}
                onChange={(e) => setHomeGoals(e.target.value)}
                className="w-16 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-sm text-zinc-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">{report.homeAway === "HOME" ? report.opponent : report.teamName}:</label>
              <input
                type="number"
                min="0"
                value={awayGoals}
                onChange={(e) => setAwayGoals(e.target.value)}
                className="w-16 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-sm text-zinc-50"
              />
            </div>
            <button
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
              disabled={isPending}
              onClick={handleSaveResult}
              type="button"
            >
              Save
            </button>
          </div>
        )}

        {/* Goals */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Goals</h3>
          {report.goals.length > 0 && (
            <ul className="flex flex-col gap-1">
              {report.goals.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm text-zinc-200">
                  <span className="font-medium">{g.playerName ?? "Unknown"}</span>
                  {g.minute !== null && <span className="text-xs text-[var(--text-muted)]">{g.minute}&apos;</span>}
                  {!isCompleted && (
                    <button
                      className="text-red-400/60 hover:text-red-300 text-xs ml-auto"
                      onClick={() => handleRemoveGoal(g.id)}
                      disabled={isPending}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!isCompleted && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={newGoalPlayerId}
                onChange={(e) => setNewGoalPlayerId(e.target.value)}
                className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-50"
              >
                <option value="">Select scorer</option>
                {report.playerActuals.filter((p) => p.attendanceStatus === "PRESENT").map((p) => (
                  <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="120"
                placeholder="Min"
                value={newGoalMinute}
                onChange={(e) => setNewGoalMinute(e.target.value)}
                className="w-14 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-50"
              />
              <button
                className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
                disabled={isPending || !newGoalPlayerId}
                onClick={handleAddGoal}
                type="button"
              >
                Add goal
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        {!isCompleted && (
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">Team notes</label>
            <textarea
              value={teamNote}
              onChange={(e) => setTeamNote(e.target.value)}
              placeholder="Optional notes..."
              className="w-full rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              rows={3}
            />
          </div>
        )}
        {isCompleted && report.teamNote && (
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">Team notes</label>
            <p className="text-sm text-zinc-200">{report.teamNote}</p>
          </div>
        )}
      </div>

      {/* Planned vs Actual */}
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-3">Actual squad</h2>

        {plannedByRole.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Planned squad</p>
            {plannedByRole.map((group) => (
              <div key={group.role} className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0 w-20">{group.label}:</span>
                {group.players.map((p) => (
                  <span key={p.playerId} className="text-xs text-zinc-300">{p.playerName}</span>
                ))}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Actual attendance</p>
        {report.playerActuals.length === 0 ? (
          <p className="text-xs text-zinc-500">No player actuals recorded.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {report.playerActuals.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{p.playerName}</span>
                <span className="text-[10px] text-[var(--text-muted)]">({p.coreTeamName})</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${p.source === "PLANNED" ? "border-zinc-600/40 bg-zinc-800/30 text-zinc-400" : "border-amber-700/40 bg-amber-900/15 text-amber-300"}`}>
                  {sourceLabel(p.source)}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">{_attendanceLabel(p.attendanceStatus)}</span>
                {!isCompleted && (
                  <button
                    className="text-red-400/60 hover:text-red-300 text-xs ml-auto"
                    onClick={() => handleRemovePlayer(p.id)}
                    disabled={isPending}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isCompleted && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={newPlayerId}
              onChange={(e) => setNewPlayerId(e.target.value)}
              placeholder="Player ID (use player name in future)"
              className="flex-1 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-50 placeholder:text-zinc-600"
            />
            <button
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
              disabled={isPending || !newPlayerId.trim()}
              onClick={handleAddPlayer}
              type="button"
            >
              Add player
            </button>
          </div>
        )}
      </div>

      {/* Finalize */}
      {!isCompleted && (
        <button
          className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
          disabled={isPending}
          onClick={handleFinalize}
          type="button"
        >
          {isPending ? "Finalizing..." : "Finalize post-match report"}
        </button>
      )}

      {isCompleted && report.completedAt && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/15 px-4 py-2 text-sm text-emerald-300">
          Report finalized{report.completedBy ? ` by ${report.completedBy}` : ""} on {new Date(report.completedAt).toLocaleDateString()}.
        </div>
      )}
    </div>
  );
}