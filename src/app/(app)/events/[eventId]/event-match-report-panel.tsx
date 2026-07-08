'use client';

import { useState, useTransition } from 'react';
import {
  updateEventMatchResultAction,
  updateEventPlayerAttendanceAction,
  addEventGoalAction,
  removeEventGoalAction,
  addEventAssistAction,
  removeEventAssistAction,
} from '../event-post-match-actions';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';

interface PlayerReport {
  id: string;
  playerId: string;
  playerName: string;
  attendanceStatus: string;
  source: string;
  role: string | null;
}

interface GoalEvent {
  id: string;
  playerId: string | null;
  playerName: string | null;
  minute: number | null;
  type: string;
  note: string | null;
}

interface AssistEvent {
  id: string;
  playerId: string;
  playerName: string | null;
  type: string;
}

interface ReportData {
  id: string;
  status: string;
  ourScore: number | null;
  opponentScore: number | null;
  teamReflection: string | null;
  opponentObservation: string | null;
  notes: string | null;
  playerReports: PlayerReport[];
  goalEvents: GoalEvent[];
  assistEvents: AssistEvent[];
}

interface EventMatchReportPanelProps {
  report: ReportData;
  isLocked: boolean;
  onRefresh: () => void;
}

const ATTENDANCE_OPTIONS = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export function EventMatchReportPanel({ report, isLocked, onRefresh }: EventMatchReportPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [ourScore, setOurScore] = useState(report.ourScore?.toString() ?? '');
  const [opponentScore, setOpponentScore] = useState(report.opponentScore?.toString() ?? '');
  const [teamReflection, setTeamReflection] = useState(report.teamReflection ?? '');
  const [opponentObservation, setOpponentObservation] = useState(report.opponentObservation ?? '');
  const [notes, setNotes] = useState(report.notes ?? '');
  const [goalPlayerId, setGoalPlayerId] = useState('');
  const [goalMinute, setGoalMinute] = useState('');
  const [goalType, setGoalType] = useState('NORMAL');
  const [assistPlayerId, setAssistPlayerId] = useState('');
  const [showResultForm, setShowResultForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAssistForm, setShowAssistForm] = useState(false);

  function handleSaveResult() {
    startTransition(async () => {
      await updateEventMatchResultAction(report.id, {
        ourScore: ourScore === '' ? undefined : parseInt(ourScore, 10),
        opponentScore: opponentScore === '' ? undefined : parseInt(opponentScore, 10),
        teamReflection: teamReflection || undefined,
        opponentObservation: opponentObservation || undefined,
        notes: notes || undefined,
      });
      setShowResultForm(false);
      onRefresh();
    });
  }

  function handleAttendanceChange(playerReportId: string, status: string) {
    startTransition(async () => {
      await updateEventPlayerAttendanceAction(playerReportId, status);
      onRefresh();
    });
  }

  function handleAddGoal() {
    startTransition(async () => {
      await addEventGoalAction(report.id, {
        playerId: goalPlayerId || undefined,
        minute: goalMinute ? parseInt(goalMinute, 10) : undefined,
        type: goalType,
      });
      setGoalPlayerId('');
      setGoalMinute('');
      setGoalType('NORMAL');
      setShowGoalForm(false);
      onRefresh();
    });
  }

  function handleRemoveGoal(goalId: string) {
    startTransition(async () => {
      await removeEventGoalAction(goalId);
      onRefresh();
    });
  }

  function handleAddAssist() {
    startTransition(async () => {
      await addEventAssistAction(report.id, {
        playerId: assistPlayerId,
      });
      setAssistPlayerId('');
      setShowAssistForm(false);
      onRefresh();
    });
  }

  function handleRemoveAssist(assistId: string) {
    startTransition(async () => {
      await removeEventAssistAction(assistId);
      onRefresh();
    });
  }

  const presentPlayers = report.playerReports.filter((pr) => pr.attendanceStatus === 'PRESENT');

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-2">
        <StatusPill variant={isLocked ? 'success' : 'neutral'}>
          {isLocked ? 'Completed' : 'Draft'}
        </StatusPill>
        {report.ourScore !== null && report.opponentScore !== null && (
          <span className="text-sm font-mono font-semibold text-zinc-100">
            {report.ourScore}–{report.opponentScore}
          </span>
        )}
      </div>

      {!isLocked && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowResultForm(!showResultForm)}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
            >
              {showResultForm ? 'Hide' : 'Edit'} result
            </button>
            <button
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
            >
              {showGoalForm ? 'Hide' : 'Add'} goal
            </button>
            <button
              onClick={() => setShowAssistForm(!showAssistForm)}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
            >
              {showAssistForm ? 'Hide' : 'Add'} assist
            </button>
          </div>

          {showResultForm && (
            <Surface variant="default" padding="md">
              <SectionHeader title="Match result" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Our score</label>
                  <input
                    type="number"
                    min="0"
                    value={ourScore}
                    onChange={(e) => setOurScore(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Opponent score</label>
                  <input
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Team reflection (optional)</label>
                <textarea
                  value={teamReflection}
                  onChange={(e) => setTeamReflection(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Opponent observation (optional)</label>
                <textarea
                  value={opponentObservation}
                  onChange={(e) => setOpponentObservation(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <button
                onClick={handleSaveResult}
                disabled={isPending}
                className="mt-3 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Save result
              </button>
            </Surface>
          )}

          {showGoalForm && (
            <Surface variant="default" padding="md">
              <SectionHeader title="Add goal" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Scorer</label>
                  <select
                    value={goalPlayerId}
                    onChange={(e) => setGoalPlayerId(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  >
                    <option value="">— Unknown / team goal —</option>
                    {presentPlayers.map((pr) => (
                      <option key={pr.playerId} value={pr.playerId}>{pr.playerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Minute</label>
                  <input
                    type="number"
                    min="0"
                    value={goalMinute}
                    onChange={(e) => setGoalMinute(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Type</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="PENALTY">Penalty</option>
                    <option value="OWN_GOAL">Own goal</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddGoal}
                disabled={isPending}
                className="mt-3 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Add goal
              </button>
            </Surface>
          )}

          {showAssistForm && (
            <Surface variant="default" padding="md">
              <SectionHeader title="Add assist" />
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Assist by</label>
                <select
                  value={assistPlayerId}
                  onChange={(e) => setAssistPlayerId(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                  required
                >
                  <option value="">— Select player —</option>
                  {presentPlayers.map((pr) => (
                    <option key={pr.playerId} value={pr.playerId}>{pr.playerName}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddAssist}
                disabled={isPending || !assistPlayerId}
                className="mt-3 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Add assist
              </button>
            </Surface>
          )}
        </div>
      )}

      <Surface variant="default" padding="md">
        <SectionHeader title="Attendance" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="py-2 pr-3 text-left text-xs font-medium text-[var(--text-muted)]">Player</th>
                <th className="py-2 pr-3 text-left text-xs font-medium text-[var(--text-muted)]">Source</th>
                <th className="py-2 text-left text-xs font-medium text-[var(--text-muted)]">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {report.playerReports.map((pr) => (
                <tr key={pr.id} className="border-b border-[var(--border-soft)]">
                  <td className="py-2 pr-3 text-zinc-100">
                    {pr.playerName}
                    {pr.role && pr.role.startsWith('Planned helper') && (
                      <span className="ml-1 text-[10px] text-[var(--text-muted)]">({pr.role})</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[var(--text-muted)]">{pr.source}</td>
                  <td className="py-2">
                    {isLocked ? (
                      <StatusPill variant={pr.attendanceStatus === 'PRESENT' ? 'success' : pr.attendanceStatus === 'NO_SHOW' ? 'danger' : 'neutral'}>
                        {ATTENDANCE_OPTIONS.find((o) => o.value === pr.attendanceStatus)?.label ?? pr.attendanceStatus}
                      </StatusPill>
                    ) : (
                      <select
                        value={pr.attendanceStatus}
                        onChange={(e) => handleAttendanceChange(pr.id, e.target.value)}
                        className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-zinc-200"
                      >
                        {ATTENDANCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <Surface variant="default" padding="md">
        <SectionHeader title="Goals" />
        {report.goalEvents.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No goals recorded</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {report.goalEvents.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm text-zinc-200">
                <span>{g.playerName ?? 'Team goal'}</span>
                {g.minute !== null && <span className="text-xs text-[var(--text-muted)]">{g.minute}&apos;</span>}
                <StatusPill variant="neutral">{g.type === 'NORMAL' ? 'Goal' : g.type === 'PENALTY' ? 'Penalty' : 'Own goal'}</StatusPill>
                {!isLocked && (
                  <button
                    onClick={() => handleRemoveGoal(g.id)}
                    className="text-[10px] text-[var(--danger)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface variant="default" padding="md">
        <SectionHeader title="Assists" />
        {report.assistEvents.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No assists recorded</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {report.assistEvents.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm text-zinc-200">
                <span>{a.playerName ?? 'Unknown'}</span>
                {!isLocked && (
                  <button
                    onClick={() => handleRemoveAssist(a.id)}
                    className="text-[10px] text-[var(--danger)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {report.teamReflection && (
        <Surface variant="default" padding="md">
          <SectionHeader title="Team reflection" />
          <p className="mt-2 text-sm text-zinc-200">{report.teamReflection}</p>
        </Surface>
      )}

      {report.opponentObservation && (
        <Surface variant="default" padding="md">
          <SectionHeader title="Opponent observation" />
          <p className="mt-2 text-sm text-zinc-200">{report.opponentObservation}</p>
        </Surface>
      )}

      {report.notes && (
        <Surface variant="default" padding="md">
          <SectionHeader title="Notes" />
          <p className="mt-2 text-sm text-zinc-200">{report.notes}</p>
        </Surface>
      )}
    </div>
  );
}