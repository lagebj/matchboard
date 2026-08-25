"use client";

import { useState, useTransition, useRef, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatSelectionRole, formatAttendanceStatus, formatUnplannedAppearanceReason, UNPLANNED_APPEARANCE_REASON_LABELS } from "@/lib/match-utils";
import type { SelectionRole, PostMatchAttendanceStatus } from "@/generated/prisma/client";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { MetricTile } from "@/components/ui/metric-tile";
import { TeamShield } from "@/components/ui/team-shield";
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

const STATUS_VARIANT_MAP: Record<string, "neutral" | "warning" | "info" | "success"> = {
  NOT_STARTED: "neutral",
  DRAFT: "warning",
  REPORTED: "info",
  LOCKED: "success",
};

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  REPORTED: "Reported",
  LOCKED: "Locked",
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

function MetaTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>
      {children}
    </div>
  );
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
  const [showMoreActions, setShowMoreActions] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  useEffect(() => {
    if (!showMoreActions) return;
    const btn = moreActionsRef.current?.querySelector("button");
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 50,
      });
    }
    function handleClickOutside(e: MouseEvent) {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setShowMoreActions(false);
      }
    }
    function handleClose() {
      setShowMoreActions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [showMoreActions]);

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

  const handleAttendanceChange = (appearanceId: string, newStatus: PostMatchAttendanceStatus) => {
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
    if (!confirm("Submit this post-match report? It will be marked as Reported.")) return;
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
        {error && (
          <DecisionBanner variant="blocked" title={error} />
        )}
      </div>
    );
  }

  const absentPlayerIds = new Set(report.absences.map((a) => a.playerId));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link href={`/matches/${matchId}`} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors">
          &larr; Back to match
        </Link>
        <span className="text-xs text-[var(--border-soft)]">|</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Post-match registration</p>
      </div>

      {/* Header */}
      <TacticalSurface variant="hero" pitch padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <TeamShield teamName={report.teamName} size="lg" />
            <div>
              <p className="text-base font-semibold text-zinc-50">{report.teamName} vs {report.opponent}</p>
              <p className="text-sm text-[var(--text-muted)]">{report.homeAway === "HOME" ? "Home" : "Away"} match</p>
            </div>
          </div>
          <StatusPill variant={STATUS_VARIANT_MAP[status] ?? "neutral"} size="md">
            {STATUS_LABEL[status] ?? status}
          </StatusPill>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {isDraft && (
            <Button variant="primary" size="sm" disabled={isPending} onClick={handleComplete}>
              Complete report
            </Button>
          )}
          {(isDraft || isReported) && !isLocked && (
            <div ref={moreActionsRef}>
              <Button variant="secondary" size="sm" onClick={() => setShowMoreActions((v) => !v)}>
                More actions
              </Button>
              {showMoreActions && (
                <div style={dropdownStyle} className="flex flex-col gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] p-2 shadow-lg">
                  {isDraft && (
                    <button
                      className="rounded px-3 py-1.5 text-xs text-[var(--info)] hover:bg-[var(--surface-hover)] text-left whitespace-nowrap"
                      disabled={isPending}
                      onClick={() => { setShowMoreActions(false); handleSubmit(); }}
                      type="button"
                    >
                      Submit (Draft → Reported)
                    </button>
                  )}
                  {isReported && (
                    <button
                      className="rounded px-3 py-1.5 text-xs text-[var(--info)] hover:bg-[var(--surface-hover)] text-left whitespace-nowrap"
                      disabled={isPending}
                      onClick={() => { setShowMoreActions(false); handleLock(); }}
                      type="button"
                    >
                      Lock (Reported → Locked)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {isLocked && (
            <>
              <Button variant="warning" size="sm" disabled={isPending} onClick={() => handleReopen("DRAFT")}>
                Reopen as draft
              </Button>
              <Button variant="secondary" size="sm" disabled={isPending} onClick={() => handleReopen("REPORTED")}>
                Reopen (reported)
              </Button>
            </>
          )}
        </div>
      </TacticalSurface>

      {error && <DecisionBanner variant="blocked" title={error} />}

      <div className="flex flex-wrap gap-2">
        <MetricTile
          label="Present"
          value={report.playerActuals.filter((p) => p.attendanceStatus === "PRESENT").length}
          tone="success"
        />
        <MetricTile
          label="Absent"
          value={report.absences.length}
          tone={report.absences.length > 0 ? "warning" : "neutral"}
        />
        <MetricTile
          label="Goals"
          value={report.goals.length}
        />
        <MetricTile
          label="Assists"
          value={report.assists.length}
        />
      </div>

      {/* Result */}
      <Surface variant="default" padding="lg">
        <SectionHeader title="Result" />
        {isLocked ? (
          <p className="text-lg font-bold text-zinc-50 mt-3">
            {report.homeGoals ?? 0} &ndash; {report.awayGoals ?? 0}
          </p>
        ) : (
          <div className="flex items-center gap-3 mt-3">
            <MetaTile label={report.homeAway === "HOME" ? report.teamName : report.opponent}>
              <input
                type="number"
                min="0"
                value={homeGoals}
                onChange={(e) => setHomeGoals(e.target.value)}
                className="w-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-sm text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              />
            </MetaTile>
            <MetaTile label={report.homeAway === "HOME" ? report.opponent : report.teamName}>
              <input
                type="number"
                min="0"
                value={awayGoals}
                onChange={(e) => setAwayGoals(e.target.value)}
                className="w-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-sm text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              />
            </MetaTile>
            <Button variant="secondary" size="sm" disabled={isPending} onClick={handleSaveResult}>
              Save
            </Button>
          </div>
        )}

        {/* Goals */}
        <div className="mt-5">
          <SectionHeader title="Goals" eyebrow="Events" />
          {report.goals.length > 0 && (
            <ul className="flex flex-col gap-1 mt-2">
              {report.goals.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <span className="font-medium text-zinc-100">{g.playerName ?? "Unknown"}</span>
                  {g.minute !== null && <span className="text-xs text-[var(--text-muted)]">{g.minute}&apos;</span>}
                  {!isLocked && (
                    <button
                      className="text-[var(--danger)]/60 hover:text-[var(--danger)] text-xs ml-auto"
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
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-xs text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
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
                className="w-14 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-xs text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              />
              <Button variant="secondary" size="sm" disabled={isPending || !newGoalPlayerId} onClick={handleAddGoal}>
                Add goal
              </Button>
            </div>
          )}
        </div>

        {/* Assists */}
        <div className="mt-5">
          <SectionHeader title="Assists" eyebrow="Events" />
          {report.assists.length > 0 && (
            <ul className="flex flex-col gap-1 mt-2">
              {report.assists.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <span className="font-medium text-zinc-100">{a.playerName}</span>
                  {!isLocked && (
                    <button
                      className="text-[var(--danger)]/60 hover:text-[var(--danger)] text-xs ml-auto"
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
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-xs text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select assist</option>
                {report.playerActuals.filter((p) => p.attendanceStatus === "PRESENT").map((p) => (
                  <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" disabled={isPending || !newAssistPlayerId} onClick={handleAddAssist}>
                Add assist
              </Button>
            </div>
          )}
        </div>

        {/* Notes */}
        {!isLocked && (
          <div className="mt-5">
            <SectionHeader title="Team notes" />
            <textarea
              value={teamNote}
              onChange={(e) => setTeamNote(e.target.value)}
              placeholder="Optional notes..."
              className="w-full mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              rows={3}
            />
          </div>
        )}
        {isLocked && report.teamNote && (
          <div className="mt-5">
            <SectionHeader title="Team notes" />
            <p className="text-sm text-[var(--text-soft)] mt-2">{report.teamNote}</p>
          </div>
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
                {absentPlayerIds.has(s.playerId) && (
                  <StatusPill variant="danger" size="sm">Absent</StatusPill>
                )}
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
                    <option value="NO_SHOW">No-show</option>
                    <option value="SICK">Sick</option>
                    <option value="INJURED">Injured</option>
                    <option value="DECLINED">Declined</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              ))}
          </div>
        </Surface>
      )}

      {/* Actual squad */}
      <Surface variant="default" padding="lg">
        <SectionHeader title="Actual squad" />
        {report.playerActuals.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">No player actuals recorded.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mt-2">
            {report.playerActuals.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--text-soft)]">{p.playerName}</span>
                <span className="text-[10px] text-[var(--text-muted)]">({p.coreTeamName})</span>
                <StatusPill variant={p.source === "PLANNED" ? "neutral" : "warning"} size="sm">
                  {sourceLabel(p.source)}
                </StatusPill>
                {p.source !== "PLANNED" && p.unplannedAppearanceReason && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatUnplannedAppearanceReason(p.unplannedAppearanceReason)}
                  </span>
                )}
                {!isLocked && (
                  <select
                    value={p.attendanceStatus}
                    onChange={(e) => handleAttendanceChange(p.id, e.target.value as PostMatchAttendanceStatus)}
                    className="rounded border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-1 py-0.5 text-[10px] text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
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
                    className="text-[var(--danger)]/60 hover:text-[var(--danger)] text-xs ml-auto"
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
              className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              disabled={isPending}
            >
              <option value="">Add player...</option>
              {allPlayers
                .filter((p) => !report?.playerActuals.some((a) => a.playerId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.teamName})</option>
                ))}
            </select>
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
            <Button variant="secondary" size="sm" disabled={isPending || !newPlayerId} onClick={handleAddPlayer}>
              Add player
            </Button>
          </div>
        )}
      </Surface>

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
                    <button
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]"
                      onClick={() => handleUpdateStats(s.playerId, s.goals + 1, s.assists)}
                      disabled={isPending}
                      type="button"
                    >
                      +Goal
                    </button>
                    <button
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]"
                      onClick={() => handleUpdateStats(s.playerId, Math.max(0, s.goals - 1), s.assists)}
                      disabled={isPending}
                      type="button"
                    >
                      -Goal
                    </button>
                    <button
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]"
                      onClick={() => handleUpdateStats(s.playerId, s.goals, s.assists + 1)}
                      disabled={isPending}
                      type="button"
                    >
                      +Assist
                    </button>
                    <button
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]"
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
        </Surface>
      )}

      {/* Lock info */}
      {isLocked && report.completedAt && (
        <DecisionBanner
          variant="success"
          title={`Report complete${report.completedBy ? ` by ${report.completedBy}` : ""} on ${new Date(report.completedAt).toLocaleDateString()}.`}
        />
      )}
    </div>
  );
}