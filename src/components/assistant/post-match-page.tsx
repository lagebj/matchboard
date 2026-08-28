"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatSelectionRole, formatUnplannedAppearanceReason, UNPLANNED_APPEARANCE_REASON_LABELS } from "@/lib/match-utils";
import type { SelectionRole, PostMatchAttendanceStatus } from "@/generated/prisma/client";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PostMatchReportShell } from "@/components/matches/post-match-report-shell";
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
} from "@/lib/reports/post-match-report-view-model";
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

const ABSENCE_REASON_LABELS: Record<string, string> = {
  NO_SHOW: "No-show",
  SICK: "Sick",
  INJURED: "Injured",
  DECLINED: "Declined",
  NO_RSVP: "No RSVP",
  OTHER: "Other",
  AWAY: "Away",
};

const CAPABILITIES: PostMatchReportCapabilities = { hasSubmitLockSteps: true, hasUnplannedReason: true };

function toViewModel(report: ReportData): PostMatchReportViewModel {
  const isHome = report.homeAway === "HOME";
  return {
    id: report.id,
    status: report.status,
    teamLabel: report.teamName,
    opponentLabel: report.opponent,
    ourScore: isHome ? report.homeGoals : report.awayGoals,
    opponentScore: isHome ? report.awayGoals : report.homeGoals,
    players: report.playerActuals.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: p.playerName,
      attendanceStatus: p.attendanceStatus,
      meta:
        p.source === "PLANNED"
          ? p.coreTeamName
          : `${p.coreTeamName} — added manually${p.unplannedAppearanceReason ? ` (${formatUnplannedAppearanceReason(p.unplannedAppearanceReason)})` : ""}`,
    })),
    goals: report.goals.map((g) => ({ ...g, playerName: g.playerName ?? null })),
    assists: report.assists.map((a) => ({ ...a, playerName: a.playerName ?? null })),
    completedBy: report.completedBy,
    completedAt: report.completedAt,
  };
}

export function PostMatchPage({ matchId, initialReport, allPlayers, hasFinalizedSelections }: { matchId: string; initialReport: ReportData | null; allPlayers: Array<{ id: string; name: string; teamName: string }>; hasFinalizedSelections?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [teamNote, setTeamNote] = useState(initialReport?.teamNote ?? "");
  const [newPlayerReason, setNewPlayerReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const report = initialReport;
  const status = report?.status ?? "NOT_STARTED";
  const isLocked = status === "LOCKED";
  const isDraft = status === "DRAFT";
  const isReported = status === "REPORTED";

  const handleSeed = () => {
    setError(null);
    startTransition(async () => {
      const result = await seedMatchReport(matchId);
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to create report.");
    });
  };

  const handleSaveTeamNote = () => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMatchResult(report.id, { teamNote: teamNote || undefined });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to save note.");
    });
  };

  const handleMarkAbsence = (playerId: string, reason: string) => {
    if (!report) return;
    setError(null);
    startTransition(async () => {
      const result = await markPlannedAbsence(report.id, { playerId, reason: reason as "NO_SHOW" | "SICK" | "INJURED" | "DECLINED" | "NO_RSVP" | "OTHER" });
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

  if (!report || report.status === "NOT_STARTED") {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
          &larr; Back to match
        </Link>
        <EmptyState
          title="No post-match report yet"
          description={hasFinalizedSelections ? "Seed from planned selections to begin recording actuals." : "No finalised squad was available. Add the players who actually played."}
          illustration="emptyStats"
          action={
            <Button variant="primary" size="md" disabled={isPending} onClick={handleSeed}>
              {isPending ? "Creating..." : "Start after-match report"}
            </Button>
          }
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  const absentPlayerIds = new Set(report.absences.map((a) => a.playerId));
  const isHome = report.homeAway === "HOME";

  const actions: PostMatchReportActions = {
    updateResult: async ({ ourScore, opponentScore }) =>
      updateMatchResult(report.id, {
        homeGoals: isHome ? ourScore : opponentScore,
        awayGoals: isHome ? opponentScore : ourScore,
      }),
    addGoal: (data) => addGoalToReport(report.id, { ...data, type: "NORMAL" }),
    removeGoal: (goalId) => removeGoalFromReport(goalId),
    addAssist: (data) => addAssistToReport(report.id, { ...data, type: "NORMAL" }),
    removeAssist: (assistId) => removeAssistFromReport(assistId),
    updateAttendance: (playerReportId, status) => updateAttendanceStatus(playerReportId, status as PostMatchAttendanceStatus),
    addPlayer: ({ playerId }) => addActualPlayer(report.id, { playerId, attendanceStatus: "PRESENT", unplannedAppearanceReason: newPlayerReason || undefined }),
    removePlayer: (playerReportId) => removeActualPlayer(playerReportId),
    complete: () => completeMatchReport(report.id),
    reopen: (target) => reopenMatchReport(report.id, target),
    submit: () => submitMatchReport(report.id),
    lock: () => lockMatchReport(report.id),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
          &larr; Back to match
        </Link>
        <span className="text-xs text-[var(--border-soft)]">|</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Post-match registration</p>
      </div>

      {/* Reason selector for manually-added players (League-only capability) feeds the shell's addPlayer call above. */}
      {!isLocked && (
        <div className="flex items-center gap-2 -mb-3">
          <label className="text-[10px] text-[var(--text-muted)]">New player reason (optional):</label>
          <select
            value={newPlayerReason}
            onChange={(e) => setNewPlayerReason(e.target.value)}
            className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            disabled={isPending}
          >
            <option value="">Reason...</option>
            {Object.entries(UNPLANNED_APPEARANCE_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <PostMatchReportShell
        report={toViewModel(report)}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={allPlayers.filter((p) => !report.playerActuals.some((a) => a.playerId === p.id))}
        onChanged={() => router.refresh()}
        extraSections={
          <>
            {/* Team notes */}
            <Surface variant="default" padding="lg">
              <SectionHeader title="Team notes" />
              {!isLocked ? (
                <>
                  <textarea
                    value={teamNote}
                    onChange={(e) => setTeamNote(e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    rows={3}
                  />
                  <Button variant="secondary" size="sm" disabled={isPending} onClick={handleSaveTeamNote} className="mt-2">
                    Save note
                  </Button>
                </>
              ) : (
                report.teamNote && <p className="text-sm text-[var(--text-soft)] mt-2">{report.teamNote}</p>
              )}
            </Surface>

            {/* Planned squad */}
            {report.plannedSelections.length > 0 && (
              <Surface variant="default" padding="lg">
                <SectionHeader title="Planned squad" />
                <div className="flex flex-col gap-1.5 mt-2">
                  {report.plannedSelections.map((s) => (
                    <div key={s.playerId} className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-soft)]">{s.playerName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">({s.coreTeamName})</span>
                      <StatusPill variant="neutral" size="sm">{formatSelectionRole(s.role as SelectionRole)}</StatusPill>
                      {absentPlayerIds.has(s.playerId) && <StatusPill variant="danger" size="sm">Absent</StatusPill>}
                    </div>
                  ))}
                </div>
              </Surface>
            )}

            {/* Absences */}
            {report.absences.length > 0 && (
              <Surface variant="default" padding="lg">
                <SectionHeader title="Planned absences" />
                <div className="flex flex-col gap-1.5 mt-2">
                  {report.absences.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-soft)]">{a.playerName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">({a.coreTeamName})</span>
                      <StatusPill variant="danger" size="sm">{ABSENCE_REASON_LABELS[a.reason] ?? a.reason}</StatusPill>
                      {a.note && <span className="text-xs text-[var(--text-muted)]">{a.note}</span>}
                      {!isLocked && (
                        <button
                          className="text-[var(--danger)]/60 hover:text-[var(--danger)] text-xs ml-auto"
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
              </Surface>
            )}

            {/* Mark absence (draft only) */}
            {isDraft && report.plannedSelections.length > 0 && (
              <Surface variant="default" padding="lg">
                <SectionHeader title="Mark planned absence" />
                <div className="flex flex-col gap-2 mt-2">
                  {report.plannedSelections
                    .filter((s) => !absentPlayerIds.has(s.playerId))
                    .filter((s) => !report.playerActuals.some((a) => a.playerId === s.playerId))
                    .map((s) => (
                      <div key={s.playerId} className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--text-soft)]">{s.playerName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">({s.coreTeamName})</span>
                        <select
                          className="rounded border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-1.5 py-0.5 text-xs text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleMarkAbsence(s.playerId, e.target.value);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">Mark absent...</option>
                          <option value="AWAY">Away</option>
                          <option value="SICK">Sick</option>
                          <option value="NO_SHOW">No-show</option>
                          <option value="DECLINED">Declined</option>
                          <option value="INJURED">Injured</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    ))}
                </div>
              </Surface>
            )}

            {/* Player stats (REPORTED or LOCKED) */}
            {(isReported || isLocked) && report.playerStats.length > 0 && (
              <Surface variant="default" padding="lg">
                <SectionHeader title="Player stats" />
                <div className="flex flex-col gap-1.5 mt-2">
                  {report.playerStats.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text-soft)]">{s.playerName}</span>
                      <span className="text-xs text-[var(--text-muted)]">{s.goals}G {s.assists}A</span>
                      {!isLocked && (
                        <>
                          <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]" onClick={() => handleUpdateStats(s.playerId, s.goals + 1, s.assists)} disabled={isPending} type="button">+Goal</button>
                          <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]" onClick={() => handleUpdateStats(s.playerId, Math.max(0, s.goals - 1), s.assists)} disabled={isPending} type="button">-Goal</button>
                          <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]" onClick={() => handleUpdateStats(s.playerId, s.goals, s.assists + 1)} disabled={isPending} type="button">+Assist</button>
                          <button className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]" onClick={() => handleUpdateStats(s.playerId, s.goals, Math.max(0, s.assists - 1))} disabled={isPending} type="button">-Assist</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Surface>
            )}
          </>
        }
      />
    </div>
  );
}
