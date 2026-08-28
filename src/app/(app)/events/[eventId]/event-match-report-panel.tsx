'use client';

import { useEffect, useState } from 'react';
import {
  updateEventMatchResultAction,
  updateEventPlayerAttendanceAction,
  addEventGoalAction,
  removeEventGoalAction,
  addEventAssistAction,
  removeEventAssistAction,
  addEventMatchPlayerAction,
  removeEventMatchPlayerAction,
  getEventMatchCombinationEvidenceAction,
} from '../event-post-match-actions';
import { getEventFootballObservationsAction } from '../event-football-observation-actions';
import { getAvailablePlayersForEvent } from '../actions';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { PostMatchReportShell } from '@/components/matches/post-match-report-shell';
import { FootballObservationSection } from '@/components/player-development/football-observation-section';
import { MatchCombinationEvidencePanel } from '@/components/matches/match-combination-evidence-panel';
import type { CombinationEvidenceRow } from '@/lib/evidence/combination-topology';
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
  PostMatchAvailablePlayer,
} from '@/lib/reports/post-match-report-view-model';

interface PlayerReport {
  id: string;
  playerId: string;
  playerName: string;
  attendanceStatus: string;
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

interface ObservationEntry {
  id: string;
  playerId: string;
  observationCode: string;
  polarity: string;
  note: string | null;
  observedAt: string;
}

interface EventMatchReportPanelProps {
  eventMatchId: string;
  teamLabel: string;
  opponentLabel: string;
  report: ReportData;
  isLocked: boolean;
  onRefresh: () => void;
}

const CAPABILITIES: PostMatchReportCapabilities = { hasSubmitLockSteps: false, hasUnplannedReason: false };

function toViewModel(report: ReportData, teamLabel: string, opponentLabel: string): PostMatchReportViewModel {
  return {
    id: report.id,
    status: report.status as PostMatchReportViewModel['status'],
    teamLabel,
    opponentLabel,
    ourScore: report.ourScore,
    opponentScore: report.opponentScore,
    players: report.playerReports.map((pr) => ({
      id: pr.id,
      playerId: pr.playerId,
      playerName: pr.playerName,
      attendanceStatus: pr.attendanceStatus,
      meta: pr.role && pr.role.startsWith('Planned helper') ? pr.role : undefined,
    })),
    goals: report.goalEvents.map((g) => ({ id: g.id, playerId: g.playerId, playerName: g.playerName, minute: g.minute })),
    assists: report.assistEvents.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
  };
}

export function EventMatchReportPanel({ eventMatchId, teamLabel, opponentLabel, report, isLocked, onRefresh }: EventMatchReportPanelProps) {
  const [observations, setObservations] = useState<ObservationEntry[]>([]);
  const [combinationEvidence, setCombinationEvidence] = useState<CombinationEvidenceRow[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PostMatchAvailablePlayer[]>([]);
  const [teamReflection, setTeamReflection] = useState(report.teamReflection ?? '');
  const [opponentObservation, setOpponentObservation] = useState(report.opponentObservation ?? '');
  const [notes, setNotes] = useState(report.notes ?? '');

  useEffect(() => {
    let cancelled = false;
    getEventFootballObservationsAction(eventMatchId).then((result) => {
      if (!cancelled && result.success && result.observations) setObservations(result.observations);
    });
    getAvailablePlayersForEvent().then((players) => {
      if (!cancelled) {
        setAvailablePlayers(players.map((p) => ({ id: p.id, name: `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`, teamName: p.coreTeam?.name })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [eventMatchId, report.id]);

  useEffect(() => {
    if (!isLocked) {
      setCombinationEvidence([]);
      return;
    }
    let cancelled = false;
    getEventMatchCombinationEvidenceAction(eventMatchId).then((rows) => {
      if (!cancelled) setCombinationEvidence(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [eventMatchId, isLocked]);

  // Event's action functions return their raw mutated row and throw on error, unlike League's
  // { success, error } convention -- normalize here rather than changing every Event action's
  // long-established call signature (used elsewhere) just for this one shared shell.
  async function wrap<T>(fn: () => Promise<T>): Promise<{ success: boolean; error?: string }> {
    try {
      await fn();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Action failed.' };
    }
  }

  const actions: PostMatchReportActions = {
    updateResult: (data) => wrap(() => updateEventMatchResultAction(report.id, data)),
    addGoal: (data) => wrap(() => addEventGoalAction(report.id, data)),
    removeGoal: (goalId) => wrap(() => removeEventGoalAction(goalId)),
    addAssist: (data) => wrap(() => addEventAssistAction(report.id, data)),
    removeAssist: (assistId) => wrap(() => removeEventAssistAction(assistId)),
    updateAttendance: (playerReportId, status) =>
      wrap(() => updateEventPlayerAttendanceAction(playerReportId, status as Parameters<typeof updateEventPlayerAttendanceAction>[1])),
    addPlayer: (data) => wrap(() => addEventMatchPlayerAction(report.id, data)),
    removePlayer: (playerReportId) => wrap(() => removeEventMatchPlayerAction(playerReportId)),
    complete: () => wrap(() => import('../event-post-match-actions').then(({ completeEventMatchReportAction }) => completeEventMatchReportAction(report.id))),
    reopen: (target) => wrap(() => import('../event-post-match-actions').then(({ reopenEventMatchReportAction }) => reopenEventMatchReportAction(report.id, target))),
  };

  return (
    <div className="mt-3">
      <PostMatchReportShell
        report={toViewModel(report, teamLabel, opponentLabel)}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={availablePlayers.filter((p) => !report.playerReports.some((r) => r.playerId === p.id))}
        onChanged={onRefresh}
        extraSections={
          <>
            <Surface variant="default" padding="lg">
              <SectionHeader title="Team reflection" />
              {!isLocked ? (
                <>
                  <textarea
                    value={teamReflection}
                    onChange={(e) => setTeamReflection(e.target.value)}
                    className="w-full mt-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                    rows={2}
                    maxLength={1000}
                  />
                  <button
                    type="button"
                    onClick={() => updateEventMatchResultAction(report.id, { teamReflection: teamReflection || undefined }).then(onRefresh)}
                    className="mt-2 rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
                  >
                    Save
                  </button>
                </>
              ) : (
                report.teamReflection && <p className="mt-2 text-sm text-zinc-200">{report.teamReflection}</p>
              )}
            </Surface>

            <Surface variant="default" padding="lg">
              <SectionHeader title="Opponent observation" />
              {!isLocked ? (
                <>
                  <textarea
                    value={opponentObservation}
                    onChange={(e) => setOpponentObservation(e.target.value)}
                    className="w-full mt-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                    rows={2}
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={() => updateEventMatchResultAction(report.id, { opponentObservation: opponentObservation || undefined }).then(onRefresh)}
                    className="mt-2 rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
                  >
                    Save
                  </button>
                </>
              ) : (
                report.opponentObservation && <p className="mt-2 text-sm text-zinc-200">{report.opponentObservation}</p>
              )}
            </Surface>

            <Surface variant="default" padding="lg">
              <SectionHeader title="Notes" />
              {!isLocked ? (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full mt-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                    rows={2}
                    maxLength={1000}
                  />
                  <button
                    type="button"
                    onClick={() => updateEventMatchResultAction(report.id, { notes: notes || undefined }).then(onRefresh)}
                    className="mt-2 rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
                  >
                    Save
                  </button>
                </>
              ) : (
                report.notes && <p className="mt-2 text-sm text-zinc-200">{report.notes}</p>
              )}
            </Surface>

            <FootballObservationSection
              eventMatchId={eventMatchId}
              players={report.playerReports.filter((pr) => pr.attendanceStatus === 'PRESENT').map((pr) => ({ id: pr.playerId, name: pr.playerName }))}
              existingObservations={observations}
              isLocked={isLocked}
            />

            {isLocked && combinationEvidence.length > 0 && (
              <MatchCombinationEvidencePanel
                evidence={combinationEvidence}
                players={report.playerReports.map((pr) => ({ id: pr.playerId, name: pr.playerName }))}
              />
            )}
          </>
        }
      />
    </div>
  );
}
