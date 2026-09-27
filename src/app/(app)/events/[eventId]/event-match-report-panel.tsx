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
import {
  getEventMatchTimingReviewAction,
  confirmEventPeriodTimingAction,
  correctEventPeriodTimingAction,
} from '../event-post-match-actions';
import { getEventDebriefAction } from '../event-debrief-actions';
import { PostMatchReportShell } from '@/components/matches/post-match-report-shell';
import { PostMatchUnresolvedBanner } from '@/components/live-match/post-match-unresolved-banner';
import { FootballObservationSection } from '@/components/player-development/football-observation-section';
import { MatchCombinationEvidencePanel } from '@/components/matches/match-combination-evidence-panel';
import { PostMatchDebrief } from '@/components/post-match/debrief/post-match-debrief';
import type { CombinationEvidenceRow } from '@/lib/evidence/combination-topology';
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
  PostMatchAvailablePlayer,
  PostMatchReportTimingReviewRow,
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

const CAPABILITIES: PostMatchReportCapabilities = { hasUnplannedReason: false };

function toViewModel(
  report: ReportData,
  teamLabel: string,
  opponentLabel: string,
  timingReview: PostMatchReportTimingReviewRow[],
  outOfRangeEventCount: number,
): PostMatchReportViewModel {
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
    timingReview,
    outOfRangeEventCount,
  };
}

export function EventMatchReportPanel({ eventMatchId, teamLabel, opponentLabel, report, isLocked, onRefresh }: EventMatchReportPanelProps) {
  const [observations, setObservations] = useState<ObservationEntry[]>([]);
  const [combinationEvidence, setCombinationEvidence] = useState<CombinationEvidenceRow[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PostMatchAvailablePlayer[]>([]);
  const [timingReview, setTimingReview] = useState<PostMatchReportTimingReviewRow[]>([]);
  const [outOfRangeEventCount, setOutOfRangeEventCount] = useState(0);
  const [debrief, setDebrief] = useState<Awaited<ReturnType<typeof getEventDebriefAction>> | null>(null);

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
    // ADR-0146 §8/§13 -- the recovered-timing callout's data. Re-fetched whenever report.id
    // changes (a confirm/correct action calls onRefresh, which re-renders with fresh report
    // data from the parent -- refetching here keeps the callout in sync the same way).
    getEventMatchTimingReviewAction(eventMatchId).then((result) => {
      if (!cancelled) {
        setTimingReview(result.timingReview);
        setOutOfRangeEventCount(result.outOfRangeEventCount);
      }
    });
    // ADR-0152 §9 -- created (with legacy prefill) the moment this report panel is opened, not
    // lazily, so completeEventReport()'s debrief-submitted gate can never block a report the
    // coach has never had a chance to see the debrief for.
    getEventDebriefAction(eventMatchId).then((result) => {
      if (!cancelled) setDebrief(result);
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
    confirmPeriodTiming: (period) => confirmEventPeriodTimingAction(eventMatchId, period),
    correctPeriodTiming: (period, minutes) => correctEventPeriodTimingAction(eventMatchId, period, minutes),
  };

  const playerNameById = Object.fromEntries(report.playerReports.map((p) => [p.playerId, p.playerName]));
  const presentPlayers = report.playerReports.filter((pr) => pr.attendanceStatus === 'PRESENT').map((pr) => ({ id: pr.playerId, name: pr.playerName }));
  const matchupLabel =
    report.ourScore != null && report.opponentScore != null ? `${teamLabel} ${report.ourScore}–${report.opponentScore} ${opponentLabel}` : `${teamLabel} vs ${opponentLabel}`;
  // ADR-0152 §5 Step 5 — reuse whatever period labels this match's own recovered-timing review
  // already surfaced, plus the two fixed catch-all choices the bundle specifies (never hard-code
  // "First half"/"Second half"; Event match formats vary).
  const periodOptions = [...new Set(timingReview.map((t) => t.periodLabel))].concat(['Multiple periods', 'Not sure']);

  return (
    <div className="mt-3">
      {/* ADR-0138 Bundle 8, work item 5 — surfaces any live-reporting local outbox record on
          this device still needing review/sync, before the coach relies on the report below. */}
      <PostMatchUnresolvedBanner subjectId={eventMatchId} playerNameById={playerNameById} />
      <PostMatchReportShell
        report={toViewModel(report, teamLabel, opponentLabel, timingReview, outOfRangeEventCount)}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={availablePlayers.filter((p) => !report.playerReports.some((r) => r.playerId === p.id))}
        onChanged={onRefresh}
        extraSections={
          <>
            {debrief?.success ? (
              <PostMatchDebrief
                reportRef={{ kind: 'EVENT', eventMatchId }}
                debriefId={debrief.data.id}
                status={debrief.data.status}
                initialAnswers={debrief.data.answers}
                opponentName={opponentLabel}
                matchupLabel={matchupLabel}
                playerOptions={presentPlayers}
                periodOptions={periodOptions}
                readOnly={isLocked}
              />
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">{debrief?.success === false ? debrief.error : 'Loading debrief…'}</p>
            )}

            <FootballObservationSection
              eventMatchId={eventMatchId}
              players={presentPlayers}
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
