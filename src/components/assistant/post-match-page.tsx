"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { PostMatchReport, PostMatchPlayerActual, AttendanceStatus } from "@/domain/assistant-manager/types";
import { getPostMatchReport, completePostMatchReport } from "@/domain/assistant-manager/service";
import { recordDecision } from "@/domain/assistant-manager/service";

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "NO_SHOW", "LATE_CANCELLATION", "ABSENT_CONFIRMED", "UNKNOWN"];

function attendanceLabel(status: string): string {
  switch (status) {
    case "PRESENT": return "Present";
    case "NO_SHOW": return "No-show";
    case "LATE_CANCELLATION": return "Late cancellation";
    case "ABSENT_CONFIRMED": return "Absent confirmed";
    case "UNKNOWN": return "Unknown";
    default: return status;
  }
}

function statusClasses(status: string): string {
  switch (status) {
    case "NOT_STARTED": return "border-zinc-700/40 bg-zinc-800/20 text-zinc-400";
    case "IN_PROGRESS": return "border-amber-700/40 bg-amber-900/15 text-amber-300";
    case "COMPLETED": return "border-emerald-700/40 bg-emerald-900/15 text-emerald-300";
    default: return "border-zinc-700/40 bg-zinc-800/20 text-zinc-400";
  }
}

export function PostMatchPage({ matchId }: { matchId: string }) {
  const [report, setReport] = useState<PostMatchReport | null>(null);
  const [teamNote, setTeamNote] = useState("");
  const [playerActuals, setPlayerActuals] = useState<PostMatchPlayerActual[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getPostMatchReport(matchId);
      setReport(data);
    });
  }, [matchId, startTransition]);

  if (!report) {
    return <div className="p-4 text-sm text-zinc-500">Loading post-match report...</div>;
  }

  const addPlayer = () => {
    setPlayerActuals([...playerActuals, { playerId: "", attendanceStatus: "UNKNOWN" }]);
  };

  const updatePlayer = (index: number, field: keyof PostMatchPlayerActual, value: string) => {
    const updated = [...playerActuals];
    updated[index] = { ...updated[index], [field]: value };
    setPlayerActuals(updated);
  };

  const removePlayer = (index: number) => {
    setPlayerActuals(playerActuals.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    startTransition(async () => {
      await completePostMatchReport(matchId, {
        teamNote: teamNote || undefined,
        playerActuals: playerActuals.filter((p) => p.playerId.trim()),
      });
      await recordDecision({
        decisionType: "POST_MATCH",
        entityType: "MATCH",
        entityId: matchId,
        action: "MARK_MATCH_COMPLETE",
      });
      const updated = await getPostMatchReport(matchId);
      setReport(updated);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Post-match</p>
        <Link href="/matches" className="text-[10px] text-zinc-500 hover:text-zinc-300">Back to matches</Link>
      </div>

      <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-200">{matchId}</p>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClasses(report.status)}`}>
            {report.status === "NOT_STARTED" ? "Not started" : report.status === "IN_PROGRESS" ? "In progress" : "Completed"}
          </span>
        </div>
      </div>

      {report.status === "COMPLETED" ? (
        <div className="rounded-md border border-emerald-700/40 bg-emerald-900/15 p-3">
          <p className="text-xs text-emerald-300">Post-match report completed.</p>
          {report.completedBy && <p className="text-[10px] text-zinc-500 mt-0.5">Completed by {report.completedBy}</p>}
          {report.completedAt && <p className="text-[10px] text-zinc-500">{new Date(report.completedAt).toLocaleString()}</p>}
        </div>
      ) : (
        <>
          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Team note</p>
            <textarea
              value={teamNote}
              onChange={(e) => setTeamNote(e.target.value)}
              placeholder="Optional team note..."
              className="mt-1 w-full rounded-md border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              rows={3}
            />
          </div>

          <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Player actuals</p>
              <button
                type="button"
                onClick={addPlayer}
                className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
              >
                Add player
              </button>
            </div>

            {playerActuals.length === 0 ? (
              <p className="text-xs text-zinc-500 mt-2">No player actuals added yet. Click &ldquo;Add player&rdquo; to begin.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {playerActuals.map((player, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={player.playerId}
                      onChange={(e) => updatePlayer(index, "playerId", e.target.value)}
                      placeholder="Player ID"
                      className="flex-1 rounded border border-zinc-700/40 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                    <select
                      value={player.attendanceStatus}
                      onChange={(e) => updatePlayer(index, "attendanceStatus", e.target.value)}
                      className="rounded border border-zinc-700/40 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                    >
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{attendanceLabel(opt)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      className="text-red-400/60 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="h-8 rounded border border-emerald-700/40 bg-emerald-900/20 px-4 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
          >
            {isPending ? "Completing..." : "Complete report"}
          </button>
        </>
      )}
    </div>
  );
}