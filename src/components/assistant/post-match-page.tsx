"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatSelectionRole, formatAttendanceStatus, formatUnplannedAppearanceReason, UNPLANNED_APPEARANCE_REASON_LABELS } from "@/lib/match-utils";
import type { SelectionRole } from "@/generated/prisma/client";
import {
  seedMatchReport,
  addGoalToReport,
  removeGoalFromReport,
  addAssistToReport,
  removeAssistFromReport,
  updateMatchResult,
  addActualPlayer,
  removeActualPlayer,
  submitMatchReport,
  lockMatchReport,
  completeMatchReport,
  reopenMatchReport,
  markPlannedAbsence,
  removePlannedAbsence,
  updateAttendanceStatus,
  updatePlayerStats,
} from "@/app/(app)/matches/[matchId]/post-match/actions";
import type { MatchReportDetail } from "@/app/(app)/matches/[matchId]/post-match/actions";

type ReportData = MatchReportDetail;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not started", color: "border-zinc-600/40 bg-zinc-800/30 text-zinc-400" },
  DRAFT: { label: "Draft", color: "border-amber-700/40 bg-amber-900/15 text-amber-300" },
  REPORTED: { label: "Reported", color: "border-blue-700/40 bg-blue-900/15 text-blue-300" },
  LOCKED: { label: "Locked", color: "border-emerald-700/40 bg-emerald-900/15 text-emerald-300" },
};

const ABSENCE_REASON_LABELS: Record<string, string> = {
  NO_SHOW: "No-show",
  SICK: "Sick",
  INJURED: "Injured",
  DECLINED: "Declined",
  NO_RSVP: "No RSVP",
  OTHER: "Other",
};

function sourceLabel(source: string): string {
  return source === "PLANNED" ? "From plan" : "Added manually";
}

export function PostMatchPage({ matchId, initialReport, allPlayers, hasFinalizedSelections }: { matchId: string; initialReport: ReportData | null; allPlayers: Array<{ id: string; name: string; teamName: string }>; hasFinalizedSelections?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [homeGoals, setHomeGoals] = useState(initialReport?.homeGoals?.toString() ?? "");
  const [awayGoals, setAwayGoals] = useState(initialReport?.awayGoals?.toString() ?? "");
  const [teamNote, setTeamNote] = useState(initialReport?.teamNote ?? "");
  const [newPlayerId, setNewPlayerId] = useState("");
  const [newPlayerReason, setNewPlayerReason] = useState<string>("");
  const [newGoalPlayerId, setNewGoalPlayerId] = useState("");
  const [newGoalMinute, setNewGoalMinute] = useState("");
  const [newAssistPlayerId, setNewAssistPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const report = initialReport;
  const status = report?.status ?? "NOT_STARTED";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
  const isLocked = status === "LOCKED";
  const isDraft = status === "DRAFT";
  const isReported = status === "REPORTED";
  const _isEditable = isDraft;

  const handleSeed = () => {
    setError(null);
    startTransition(async () => {
      const result = await seedMatchReport(matchId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to create report.");
    });
  };

  const handleCreateEmpty = () => {
    setError(null);
    startTransition(async () => {
      const result = await seedMatchReport(matchId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to create report.");
    });
  };

  const handleComplete = () => {
    if (!report || report.status === "NOT_STARTED") return;
    if (!confirm("Complete this post-match report? It will be locked and cannot be further edited.")) return;
    setError(null);
    startTransition(async () => {
      const result = await completeMatchReport(report.id);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to complete report.");
    });
  };

  const handleSaveResult = () => {
    if (!report || report.status === "NOT_STARTED") return;
    setError(null);
    startTransition(async () => {
      const result = await updateMatchResult(report.id, {
        homeGoals: homeGoals === "" ? undefined : parseInt(homeGoals, 10),
        awayGoals: awayGoals === "" ? undefined : parseInt(awayGoals, 10),
        teamNote: teamNote || undefined,
      });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to save result.");
    });
  };

  const handleAddPlayer = () => {
    if (!report || !newPlayerId) return;
    setError(null);
    startTransition(async () => {
      const result = await addActualPlayer(report.id, {
        playerId: newPlayerId,
        attendanceStatus: "PRESENT",
        unplannedAppearanceReason: newPlayerReason || undefined,
      });
      if (result.success) { setNewPlayerId(""); setNewPlayerReason(""); router.refresh(); }
      else setError(result.error ?? "Failed to add player.");
    });
  };

  const handleRemovePlayer = (appearanceId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeActualPlayer(appearanceId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to remove player.");
    });
  };

  const handleAttendanceChange = (appearanceId: string, newStatus: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAttendanceStatus(appearanceId, newStatus);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to update attendance.");
    });
  };

  const handleMarkAbsence = (playerId: string, reason: string, note?: string) => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await markPlannedAbsence(report.id, { playerId, reason: reason as "NO_SHOW" | "SICK" | "INJURED" | "DECLINED" | "NO_RSVP" | "OTHER", note });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to mark absence.");
    });
  };

  const handleRemoveAbsence = (absenceId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removePlannedAbsence(absenceId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to remove absence.");
    });
  };

  const handleUpdateStats = (playerId: string, goals: number, assists: number) => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await updatePlayerStats(report.id, { playerId, goals, assists });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to update stats.");
    });
  };

  const handleAddGoal = () => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await addGoalToReport(report.id, {
        playerId: newGoalPlayerId || undefined,
        minute: newGoalMinute ? parseInt(newGoalMinute, 10) : undefined,
        type: "NORMAL",
      });
      if (result.success) { setNewGoalPlayerId(""); setNewGoalMinute(""); router.refresh(); }
      else setError(result.error ?? "Failed to add goal.");
    });
  };

  const handleRemoveGoal = (goalId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeGoalFromReport(goalId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to remove goal.");
    });
  };

  const handleAddAssist = () => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await addAssistToReport(report.id, {
        playerId: newAssistPlayerId,
        type: "NORMAL",
      });
      if (result.success) { setNewAssistPlayerId(""); router.refresh(); }
      else setError(result.error ?? "Failed to add assist.");
    });
  };

  const handleRemoveAssist = (assistId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeAssistFromReport(assistId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to remove assist.");
    });
  };

  const handleSubmit = () => {
    if (!report) return;
    if (!confirm("Submit this post-match report? It will be marked as REPORTED.")) return;
    setError(null);
    startTransition(async () => {
      const result = await submitMatchReport(report.id);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to submit report.");
    });
  };

  const handleLock = () => {
    if (!report) return;
    if (!confirm("Lock this report? It cannot be edited after locking.")) return;
    setError(null);
    startTransition(async () => {
      const result = await lockMatchReport(report.id);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to lock report.");
    });
  };

  const handleReopen = (targetStatus?: "DRAFT" | "REPORTED") => {
    if (!report) return;
    const label = targetStatus === "DRAFT" ? "draft" : "reported";
    if (!confirm(`Reopen this report to ${label} status?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await reopenMatchReport(report.id, targetStatus);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to reopen report.");
    });
  };

  if (!report || report.status === "NOT_STARTED") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
            &larr; Back to match
          </Link>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-5 py-6 text-center">
          <p className="text-sm text-zinc-300">No post-match report yet.</p>
          {hasFinalizedSelections ? (
            <>
              <p className="text-xs text-[var(--text-muted)] mt-1">Seed from planned selections to begin recording actuals.</p>
              <button
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 transition disabled:opacity-50"
                disabled={isPending}
                onClick={handleSeed}
                type="button"
              >
                {isPending ? "Creating..." : "Start after-match report"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--text-muted)] mt-1">No finalised squad was available. Add the players who actually played.</p>
              <button
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 transition disabled:opacity-50"
                disabled={isPending}
                onClick={handleCreateEmpty}
                type="button"
              >
                {isPending ? "Creating..." : "Start after-match report"}
              </button>
            </>
          )}
        </div>
        {error && (
          <div className="rounded-lg border border-red-700/40 bg-red-900/15 px-4 py-2 text-sm text-red-300">{error}</div>
        )}
      </div>
    );
  }

  const _plannedPlayerIds = new Set(report.plannedSelections.map((s) => s.playerId));
  const absentPlayerIds = new Set(report.absences.map((a) => a.playerId));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
          &larr; Back to match
        </Link>
        <span className="text-xs text-[var(--text-muted)]">|</span>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Post-match registration</p>
      </div>

      {/* Header */}
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-zinc-50">{report.teamName} vs {report.opponent}</p>
            <p className="text-sm text-[var(--text-muted)]">{report.homeAway === "HOME" ? "Home" : "Away"} match</p>
          </div>
          <span className={`rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Lifecycle actions */}
        <div className="flex items-center gap-2 mt-3">
          {isDraft && (
            <button
              className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
              disabled={isPending}
              onClick={handleComplete}
              type="button"
            >
              Complete report
            </button>
          )}
          {(isDraft || isReported) && !isLocked && (
            <details className="group relative">
              <summary className="cursor-pointer rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                More actions
              </summary>
              <div className="absolute left-0 top-full mt-1 z-10 flex flex-col gap-1 rounded-lg border border-zinc-700/60 bg-zinc-900 p-2 shadow-lg">
                {isDraft && (
                  <button
                    className="rounded px-3 py-1 text-xs text-blue-300 hover:bg-zinc-800 text-left whitespace-nowrap"
                    disabled={isPending}
                    onClick={handleSubmit}
                    type="button"
                  >
                    Submit (DRAFT → REPORTED)
                  </button>
                )}
                {isReported && (
                  <button
                    className="rounded px-3 py-1 text-xs text-blue-300 hover:bg-zinc-800 text-left whitespace-nowrap"
                    disabled={isPending}
                    onClick={handleLock}
                    type="button"
                  >
                    Lock (REPORTED → LOCKED)
                  </button>
                )}
              </div>
            </details>
          )}
          {isLocked && (
            <>
              <button
                className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => handleReopen("DRAFT")}
                type="button"
              >
                Reopen as draft
              </button>
              <button
                className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={() => handleReopen("REPORTED")}
                type="button"
              >
                Reopen (reported)
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/15 px-4 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Result */}
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-3">Result</h2>
        {isLocked ? (
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
                  {!isLocked && (
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
          {!isLocked && (
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

        {/* Assists */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Assists</h3>
          {report.assists.length > 0 && (
            <ul className="flex flex-col gap-1">
              {report.assists.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm text-zinc-200">
                  <span className="font-medium">{a.playerName}</span>
                  {!isLocked && (
                    <button
                      className="text-red-400/60 hover:text-red-300 text-xs ml-auto"
                      onClick={() => handleRemoveAssist(a.id)}
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
          {!isLocked && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={newAssistPlayerId}
                onChange={(e) => setNewAssistPlayerId(e.target.value)}
                className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-50"
              >
                <option value="">Select assist</option>
                {report.playerActuals.filter((p) => p.attendanceStatus === "PRESENT").map((p) => (
                  <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                ))}
              </select>
              <button
                className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
                disabled={isPending || !newAssistPlayerId}
                onClick={handleAddAssist}
                type="button"
              >
                Add assist
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        {!isLocked && (
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
        {isLocked && report.teamNote && (
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1">Team notes</label>
            <p className="text-sm text-zinc-200">{report.teamNote}</p>
          </div>
        )}
      </div>

      {/* Planned squad */}
      {report.plannedSelections.length > 0 && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h2 className="text-sm font-semibold text-zinc-100 mb-3">Planned squad</h2>
          <div className="flex flex-col gap-1">
            {report.plannedSelections.map((s) => (
              <div key={s.playerId} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{s.playerName}</span>
                <span className="text-[10px] text-[var(--text-muted)]">({s.coreTeamName})</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-600/40 bg-zinc-800/30 text-zinc-400">{formatSelectionRole(s.role as SelectionRole)}</span>
                {absentPlayerIds.has(s.playerId) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/40 bg-red-900/15 text-red-300">Absent</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Absences */}
      {report.absences.length > 0 && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h2 className="text-sm font-semibold text-zinc-100 mb-3">Planned absences</h2>
          <div className="flex flex-col gap-1">
            {report.absences.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{a.playerName}</span>
                <span className="text-[10px] text-[var(--text-muted)]">({a.coreTeamName})</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/40 bg-red-900/15 text-red-300">
                  {ABSENCE_REASON_LABELS[a.reason] ?? a.reason}
                </span>
                {a.note && <span className="text-xs text-[var(--text-muted)]">{a.note}</span>}
                {!isLocked && (
                  <button
                    className="text-red-400/60 hover:text-red-300 text-xs ml-auto"
                    onClick={() => handleRemoveAbsence(a.id)}
                    disabled={isPending}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mark absence (draft only) */}
      {isDraft && report.plannedSelections.length > 0 && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h2 className="text-sm font-semibold text-zinc-100 mb-3">Mark planned absence</h2>
          <div className="flex flex-col gap-2">
            {report.plannedSelections
              .filter((s) => !absentPlayerIds.has(s.playerId))
              .filter((s) => !report.playerActuals.some((a) => a.playerId === s.playerId))
              .map((s) => (
                <div key={s.playerId} className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-200">{s.playerName}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({s.coreTeamName})</span>
                  <select
                    className="rounded border app-hairline bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 text-xs text-zinc-50"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleMarkAbsence(s.playerId, e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Mark absent...</option>
                    <option value="NO_SHOW">No-show</option>
                    <option value="SICK">Sick</option>
                    <option value="INJURED">Injured</option>
                    <option value="DECLINED">Declined</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actual squad */}
      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <h2 className="text-sm font-semibold text-zinc-100 mb-3">Actual squad</h2>
        {report.playerActuals.length === 0 ? (
          <p className="text-xs text-zinc-500">No player actuals recorded.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {report.playerActuals.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-zinc-200">{p.playerName}</span>
                <span className="text-[10px] text-[var(--text-muted)]">({p.coreTeamName})</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${p.source === "PLANNED" ? "border-zinc-600/40 bg-zinc-800/30 text-zinc-400" : "border-amber-700/40 bg-amber-900/15 text-amber-300"}`}>
                  {sourceLabel(p.source)}
                </span>
                {p.source !== "PLANNED" && p.unplannedAppearanceReason && (
                  <span className="text-[10px] text-zinc-400">
                    {formatUnplannedAppearanceReason(p.unplannedAppearanceReason)}
                  </span>
                )}
                {!isLocked && (
                  <select
                    value={p.attendanceStatus}
                    onChange={(e) => handleAttendanceChange(p.id, e.target.value)}
                    className="rounded border app-hairline bg-[rgba(255,255,255,0.03)] px-1 py-0.5 text-[10px] text-zinc-50"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="NO_SHOW">No-show</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                )}
                {isLocked && (
                   <span className="text-[10px] text-[var(--text-muted)]">{formatAttendanceStatus(p.attendanceStatus)}</span>
                )}
                {!isLocked && (
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

        {!isLocked && (
          <div className="flex items-center gap-2 mt-3">
            <select
              value={newPlayerId}
              onChange={(e) => setNewPlayerId(e.target.value)}
              className="flex-1 rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-100"
              disabled={isPending}
            >
              <option value="">Add player…</option>
              {allPlayers
                .filter((p) => !report?.playerActuals.some((a) => a.playerId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.teamName})</option>
                ))}
            </select>
            <select
              value={newPlayerReason}
              onChange={(e) => setNewPlayerReason(e.target.value)}
              className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs text-zinc-100"
              disabled={isPending}
            >
              <option value="">Reason…</option>
              {Object.entries(UNPLANNED_APPEARANCE_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              className="rounded-lg border border-zinc-600/50 bg-zinc-800/30 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700/30 transition-colors disabled:opacity-50"
              disabled={isPending || !newPlayerId}
              onClick={handleAddPlayer}
              type="button"
            >
              Add player
            </button>
          </div>
        )}
      </div>

      {/* Player stats (REPORTED or LOCKED) */}
      {(isReported || isLocked) && report.playerStats.length > 0 && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h2 className="text-sm font-semibold text-zinc-100 mb-3">Player stats</h2>
          <div className="flex flex-col gap-1">
            {report.playerStats.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="text-zinc-200">{s.playerName}</span>
                <span className="text-xs text-[var(--text-muted)]">{s.goals}G {s.assists}A</span>
                {!isLocked && (
                  <>
                    <button
                      className="text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleUpdateStats(s.playerId, s.goals + 1, s.assists)}
                      disabled={isPending}
                      type="button"
                    >
                      +Goal
                    </button>
                    <button
                      className="text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleUpdateStats(s.playerId, Math.max(0, s.goals - 1), s.assists)}
                      disabled={isPending}
                      type="button"
                    >
                      -Goal
                    </button>
                    <button
                      className="text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleUpdateStats(s.playerId, s.goals, s.assists + 1)}
                      disabled={isPending}
                      type="button"
                    >
                      +Assist
                    </button>
                    <button
                      className="text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleUpdateStats(s.playerId, s.goals, Math.max(0, s.assists - 1))}
                      disabled={isPending}
                      type="button"
                    >
                      -Assist
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lock info */}
      {isLocked && report.completedAt && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/15 px-4 py-2 text-sm text-emerald-300">
          Report locked{report.completedBy ? ` by ${report.completedBy}` : ""} on {new Date(report.completedAt).toLocaleDateString()}.
        </div>
      )}
    </div>
  );
}