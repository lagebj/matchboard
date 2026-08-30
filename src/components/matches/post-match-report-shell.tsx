"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { MetricTile } from "@/components/ui/metric-tile";
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
  PostMatchAvailablePlayer,
} from "@/lib/reports/post-match-report-view-model";

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

type Props = {
  report: PostMatchReportViewModel;
  actions: PostMatchReportActions;
  capabilities: PostMatchReportCapabilities;
  availablePlayers: PostMatchAvailablePlayer[];
  onChanged: () => void;
  /** Rendered after the shared Attendance section -- League's planned-squad/absences/stats. */
  extraSections?: React.ReactNode;
};

/**
 * The shared post-match report shell (ARR-0034 resolution): status/lifecycle actions, result,
 * goals, assists, attendance (with add/remove) -- the genuinely common surface between League
 * and Event post-match reporting. League and Event each adapt their own data/server actions
 * into `PostMatchReportViewModel`/`PostMatchReportActions` and supply League-only sections
 * (planned squad, structured absence, player stats) via `extraSections`, since those have no
 * Event equivalent (a deliberate, documented decision -- see ARR-0034, not silent scope-narrowing).
 */
export function PostMatchReportShell({ report, actions, capabilities, availablePlayers, onChanged, extraSections }: Props) {
  const [isPending, startTransition] = useTransition();
  const [ourScore, setOurScore] = useState(report.ourScore?.toString() ?? "");
  const [opponentScore, setOpponentScore] = useState(report.opponentScore?.toString() ?? "");
  const [newPlayerId, setNewPlayerId] = useState("");
  const [newGoalPlayerId, setNewGoalPlayerId] = useState("");
  const [newGoalMinute, setNewGoalMinute] = useState("");
  const [newAssistPlayerId, setNewAssistPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const status = report.status;
  const isLocked = status === "LOCKED";
  const isDraft = status === "DRAFT";
  const isReported = status === "REPORTED";

  function run(fn: () => Promise<{ success: boolean; error?: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        onSuccess?.();
        onChanged();
      } else {
        setError(result.error ?? "Action failed.");
      }
    });
  }

  const presentPlayers = report.players.filter((p) => p.attendanceStatus === "PRESENT");

  return (
    <div className="flex flex-col gap-5">
      <Surface variant="default" padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-zinc-50">
              {report.teamLabel} vs {report.opponentLabel}
            </p>
          </div>
          <StatusPill variant={STATUS_VARIANT_MAP[status] ?? "neutral"} size="md">
            {STATUS_LABEL[status] ?? status}
          </StatusPill>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {(isDraft || isReported) && (
            <Button
              variant="primary"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Complete this post-match report? It will be locked and cannot be further edited.")) return;
                run(actions.complete);
              }}
            >
              Complete report
            </Button>
          )}
          {isLocked && (
            <Button
              variant="warning"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (!confirm("Reopen this report for correction?")) return;
                run(() => actions.reopen("DRAFT"));
              }}
            >
              Reopen report
            </Button>
          )}
        </div>
      </Surface>

      {error && <DecisionBanner variant="blocked" title={error} />}

      <div className="flex flex-wrap gap-2">
        <MetricTile label="Present" value={presentPlayers.length} tone="success" />
        <MetricTile label="Goals" value={report.goals.length} />
        <MetricTile label="Assists" value={report.assists.length} />
      </div>

      {/* Result */}
      <Surface variant="default" padding="lg">
        <SectionHeader title="Result" />
        {isLocked ? (
          <p className="text-lg font-bold text-zinc-50 mt-3">
            {report.ourScore ?? 0} &ndash; {report.opponentScore ?? 0}
          </p>
        ) : (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{report.teamLabel}</span>
              <input
                type="number"
                min="0"
                value={ourScore}
                onChange={(e) => setOurScore(e.target.value)}
                className="w-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-sm text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{report.opponentLabel}</span>
              <input
                type="number"
                min="0"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
                className="w-16 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-1 text-sm text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  actions.updateResult({
                    ourScore: ourScore === "" ? undefined : parseInt(ourScore, 10),
                    opponentScore: opponentScore === "" ? undefined : parseInt(opponentScore, 10),
                  }),
                )
              }
            >
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
                      onClick={() => run(() => actions.removeGoal(g.id))}
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
                {presentPlayers.map((p) => (
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
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending || !newGoalPlayerId}
                onClick={() =>
                  run(
                    () =>
                      actions.addGoal({
                        playerId: newGoalPlayerId || undefined,
                        minute: newGoalMinute ? parseInt(newGoalMinute, 10) : undefined,
                      }),
                    () => {
                      setNewGoalPlayerId("");
                      setNewGoalMinute("");
                    },
                  )
                }
              >
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
                      onClick={() => run(() => actions.removeAssist(a.id))}
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
                {presentPlayers.map((p) => (
                  <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending || !newAssistPlayerId}
                onClick={() =>
                  run(() => actions.addAssist({ playerId: newAssistPlayerId }), () => setNewAssistPlayerId(""))
                }
              >
                Add assist
              </Button>
            </div>
          )}
        </div>
      </Surface>

      {/* Attendance */}
      <Surface variant="default" padding="lg">
        <SectionHeader title="Attendance" />
        {report.players.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">No players recorded.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mt-2">
            {report.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--text-soft)]">{p.playerName}</span>
                {p.meta && <span className="text-[10px] text-[var(--text-muted)]">({p.meta})</span>}
                {!isLocked ? (
                  <select
                    value={p.attendanceStatus}
                    onChange={(e) => run(() => actions.updateAttendance(p.id, e.target.value))}
                    className="rounded border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-1 py-0.5 text-[10px] text-zinc-50 focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="NO_SHOW">No-show</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)]">{p.attendanceStatus}</span>
                )}
                {!isLocked && (
                  <button
                    className="text-[var(--danger)]/60 hover:text-[var(--danger)] text-xs ml-auto"
                    onClick={() => run(() => actions.removePlayer(p.id))}
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
              {availablePlayers
                .filter((p) => !report.players.some((r) => r.playerId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.teamName ? ` (${p.teamName})` : ""}</option>
                ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending || !newPlayerId}
              onClick={() => run(() => actions.addPlayer({ playerId: newPlayerId }), () => setNewPlayerId(""))}
            >
              Add player
            </Button>
          </div>
        )}
      </Surface>

      {extraSections}

      {isLocked && report.completedAt && (
        <DecisionBanner
          variant="success"
          title={`Report complete${report.completedBy ? ` by ${report.completedBy}` : ""} on ${new Date(report.completedAt).toLocaleDateString()}.`}
        />
      )}
    </div>
  );
}
