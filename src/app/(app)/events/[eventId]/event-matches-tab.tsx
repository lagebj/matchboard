'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import {
  createEventMatchAction,
  updateEventMatchAction,
  cancelEventMatchAction,
  reopenEventMatchAction,
  deleteEventMatchAction,
  listEventMatchesAction,
} from '../event-match-actions';
import {
  seedEventMatchReportAction,
  completeEventMatchReportAction,
  reopenEventMatchReportAction,
  getEventMatchReport,
} from '../event-post-match-actions';
import {
  addEventMatchSupportAssignmentAction,
  removeEventMatchSupportAssignmentAction,
  getSupportCandidatesForMatchAction,
  getEventMatchSupportAssignmentsAction,
} from '../event-support-actions';
import type { EventSupportCandidate } from '@/lib/events/event-match-support';
import { getDefaultEventMatchCategory } from '@/lib/stats/match-category';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { EventMatchReportPanel } from './event-match-report-panel';
import { EventMatchLineupPanel } from './event-match-lineup-panel';
import { OpponentTeamSelect } from '@/components/opponents/opponent-team-select';

const PLANNED_ROLE_OPTIONS = ['', 'GK cover', 'Defender cover', 'Midfield cover', 'Forward cover', 'General cover'];

const CATEGORY_LABELS: Record<string, string> = {
  LEAGUE: 'League',
  CUP: 'Cup',
  OTHER: 'Other',
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REPORTED: 'Reported',
  LOCKED: 'Completed',
};

interface EventMatchWithReport {
  id: string;
  eventSquadId: string;
  category: string;
  opponentName: string;
  opponentTeamId: string | null;
  startsAt: Date | string;
  location: string | null;
  notes: string | null;
  status: string;
  cancelledAt: Date | string | null;
  cancelledReason: string | null;
  report: {
    id: string;
    status: string;
    ourScore: number | null;
    opponentScore: number | null;
  } | null;
}

type SupportAssignment = {
  id: string;
  eventMatchId: string;
  playerId: string;
  sourceEventSquadId: string;
  targetEventSquadId: string;
  plannedRole: string | null;
  note: string | null;
  firstName: string;
  lastName: string | null;
  sourceEventSquadName: string;
  isConflict: boolean;
  conflictReason: string | null;
};

interface EventMatchesTabProps {
  eventId: string;
  squads: Array<{
    id: string;
    name: string;
    intent: string;
    players: Array<{ playerId: string }>;
  }>;
  eventType: string;
  gameFormat: string;
  matchDurationMinutes: number | null;
  playerProfiles: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string | null;
    coreTeamId: string | null;
    overallLevel: number | null;
  }>;
  opponentTeams: Array<{ id: string; displayName: string }>;
}

export function EventMatchesTab({ eventId, squads, eventType, gameFormat, matchDurationMinutes, playerProfiles, opponentTeams }: EventMatchesTabProps) {
  const [matches, setMatches] = useState<EventMatchWithReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [supportAssignments, setSupportAssignments] = useState<SupportAssignment[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSquadId, setCreateSquadId] = useState(squads[0]?.id ?? '');
  const [createOpponent, setCreateOpponent] = useState('');
  const [createOpponentTeamId, setCreateOpponentTeamId] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState('');
  const [createCategory, setCreateCategory] = useState<string>(
    getDefaultEventMatchCategory(eventType),
  );
  const [createLocation, setCreateLocation] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editOpponent, setEditOpponent] = useState('');
  const [editOpponentTeamId, setEditOpponentTeamId] = useState<string | null>(null);
  const [editSquadId, setEditSquadId] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editCategory, setEditCategory] = useState('CUP');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report data shape varies with Prisma includes
  const [reportData, setReportData] = useState<any>(null);
  const [lineupMatchId, setLineupMatchId] = useState<string | null>(null);

  const loadMatches = useCallback(() => {
    startTransition(async () => {
      try {
        setLoadError(null);
        const [matchResult, supportResult] = await Promise.all([
          listEventMatchesAction(eventId),
          getEventMatchSupportAssignmentsAction(eventId),
        ]);
        setMatches(matchResult);
        setSupportAssignments(supportResult);
        setLoaded(true);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load matches');
      }
    });
  }, [eventId, startTransition]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set('eventId', eventId);
    formData.set('eventSquadId', createSquadId);
    formData.set('opponentName', createOpponent);
    if (createOpponentTeamId) formData.set('opponentTeamId', createOpponentTeamId);
    formData.set('startsAt', createDate ? new Date(createDate).toISOString() : '');
    formData.set('category', createCategory);
    formData.set('location', createLocation);
    formData.set('notes', createNotes);

    startTransition(async () => {
      await createEventMatchAction(formData);
      setShowCreateForm(false);
      setCreateOpponent('');
      setCreateOpponentTeamId(null);
      setCreateDate('');
      setCreateLocation('');
      setCreateNotes('');
      loadMatches();
    });
  }

  function handleCancel(matchId: string) {
    const reason = prompt('Cancel reason (optional):');
    if (reason === null) return;
    startTransition(async () => {
      await cancelEventMatchAction(matchId, reason ?? undefined);
      loadMatches();
    });
  }

  function handleReopen(matchId: string) {
    if (!confirm('Reopen this cancelled match?')) return;
    startTransition(async () => {
      await reopenEventMatchAction(matchId);
      loadMatches();
    });
  }

  function handleDelete(matchId: string) {
    if (!confirm('Delete this match? This cannot be undone.')) return;
    startTransition(async () => {
      await deleteEventMatchAction(matchId);
      loadMatches();
    });
  }

  function startEditMatch(m: EventMatchWithReport) {
    setEditingMatchId(m.id);
    setEditOpponent(m.opponentName);
    setEditOpponentTeamId(m.opponentTeamId ?? null);
    setEditSquadId(m.eventSquadId);
    const dateStr = new Date(m.startsAt).toISOString().slice(0, 16);
    setEditStartsAt(dateStr);
    setEditCategory(m.category);
    setEditLocation(m.location ?? '');
    setEditNotes(m.notes ?? '');
  }

  function cancelEdit() {
    setEditingMatchId(null);
    setEditOpponent('');
    setEditOpponentTeamId(null);
    setEditSquadId('');
    setEditStartsAt('');
    setEditCategory('CUP');
    setEditLocation('');
    setEditNotes('');
  }

  function handleEditSave(matchId: string) {
    startTransition(async () => {
      try {
        const data: Parameters<typeof updateEventMatchAction>[1] = {};
        if (editOpponent.trim()) data.opponentName = editOpponent.trim();
        if (editOpponentTeamId) data.opponentTeamId = editOpponentTeamId;
        else data.opponentTeamId = null;
        if (editStartsAt) data.startsAt = editStartsAt;
        data.category = editCategory;
        data.location = editLocation.trim() || null;
        data.notes = editNotes.trim() || null;
        if (editSquadId) data.eventSquadId = editSquadId;
        await updateEventMatchAction(matchId, data);
        setEditingMatchId(null);
        loadMatches();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update match');
      }
    });
  }

  function handleSeedReport(matchId: string) {
    startTransition(async () => {
      await seedEventMatchReportAction(matchId);
      await loadMatches();
      const report = await getEventMatchReport(matchId);
      setReportData(report);
      setExpandedMatchId(matchId);
    });
  }

  function handleCompleteReport(reportId: string) {
    if (!confirm('Complete this report? All attendance must be marked.')) return;
    startTransition(async () => {
      await completeEventMatchReportAction(reportId);
      loadMatches();
      if (expandedMatchId) {
        const report = await getEventMatchReport(expandedMatchId);
        setReportData(report);
      }
    });
  }

  function handleReopenReport(reportId: string) {
    if (!confirm('Reopen this report back to draft?')) return;
    startTransition(async () => {
      await reopenEventMatchReportAction(reportId, 'DRAFT');
      loadMatches();
      if (expandedMatchId) {
        const report = await getEventMatchReport(expandedMatchId);
        setReportData(report);
      }
    });
  }

  function handleToggleReport(matchId: string) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      setReportData(null);
      return;
    }
    setExpandedMatchId(matchId);
    startTransition(async () => {
      const report = await getEventMatchReport(matchId);
      setReportData(report);
    });
  }

  function refreshReport() {
    if (expandedMatchId) {
      startTransition(async () => {
        const report = await getEventMatchReport(expandedMatchId);
        setReportData(report);
        loadMatches();
      });
    }
  }

  const assignmentsByMatch = new Map<string, SupportAssignment[]>();
  for (const a of supportAssignments) {
    const list = assignmentsByMatch.get(a.eventMatchId) ?? [];
    list.push(a);
    assignmentsByMatch.set(a.eventMatchId, list);
  }

  const supportLoadByPlayer = new Map<string, number>();
  for (const a of supportAssignments) {
    supportLoadByPlayer.set(a.playerId, (supportLoadByPlayer.get(a.playerId) ?? 0) + 1);
  }

  const conflictCount = supportAssignments.filter((a) => a.isConflict).length;

  if (!loaded) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Matches" />
        {loadError ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-muted)]">Could not load matches.</p>
            <button
              onClick={loadMatches}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Loading matches…</p>
        )}
      </div>
    );
  }

  const matchesBySquad = new Map<string, EventMatchWithReport[]>();
  for (const m of matches) {
    const list = matchesBySquad.get(m.eventSquadId) ?? [];
    list.push(m);
    matchesBySquad.set(m.eventSquadId, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Matches" />
        <div className="flex gap-2">
          <button
            onClick={loadMatches}
            className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
            disabled={isPending}
          >
            Refresh
          </button>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Add match
            </button>
          )}
        </div>
      </div>

      {showCreateForm && (
        <Surface variant="default" padding="md">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">New match</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Squad</label>
              <select
                value={createSquadId}
                onChange={(e) => setCreateSquadId(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                required
              >
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <OpponentTeamSelect
              opponentTeams={opponentTeams}
              selectedId={createOpponentTeamId}
              onSelectionChange={(id, name) => {
                setCreateOpponentTeamId(id);
                setCreateOpponent(name);
              }}
              onTextChange={(name) => {
                setCreateOpponentTeamId(null);
                setCreateOpponent(name);
              }}
            />
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date and time</label>
              <input
                type="datetime-local"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Category</label>
              <select
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
              >
                <option value="CUP">Cup</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Location (optional)</label>
              <input
                type="text"
                value={createLocation}
                onChange={(e) => setCreateLocation(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Notes (optional)</label>
              <textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
                disabled={isPending}
              >
                Create match
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Surface>
      )}

      {squads.map((squad) => {
        const squadMatches = matchesBySquad.get(squad.id) ?? [];
        return (
          <Surface key={squad.id} variant="default" padding="md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold text-zinc-100">{squad.name}</span>
                <StatusPill variant="neutral" className="ml-2">{squad.intent}</StatusPill>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{squadMatches.length} match{squadMatches.length !== 1 ? 'es' : ''}</span>
            </div>

            {squadMatches.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No matches registered</p>
            )}

            <div className="space-y-2">
              {squadMatches.map((m) => (
                <EventMatchCard
                  key={m.id}
                  match={m}
                  matchDurationMinutes={matchDurationMinutes}
                  isPending={isPending}
                  assignmentsForMatch={assignmentsByMatch.get(m.id) ?? []}
                  conflictCount={conflictCount}
                  supportLoadByPlayer={supportLoadByPlayer}
                  expandedMatchId={expandedMatchId}
                  reportData={reportData}
                  onToggleReport={handleToggleReport}
                  onSeedReport={handleSeedReport}
                  onCompleteReport={handleCompleteReport}
                  onReopenReport={handleReopenReport}
                  onCancel={handleCancel}
                  onReopen={handleReopen}
                  onDelete={handleDelete}
                  onEdit={startEditMatch}
                  onRemoveHelper={(assignmentId) => {
                    startTransition(async () => {
                      await removeEventMatchSupportAssignmentAction(assignmentId);
                      loadMatches();
                    });
                  }}
                  onRefresh={loadMatches}
                  editingMatchId={editingMatchId}
                  setEditOpponent={setEditOpponent}
                  editOpponentTeamId={editOpponentTeamId}
                  setEditOpponentTeamId={setEditOpponentTeamId}
                  editSquadId={editSquadId}
                  setEditSquadId={setEditSquadId}
                  editStartsAt={editStartsAt}
                  setEditStartsAt={setEditStartsAt}
                  editCategory={editCategory}
                  setEditCategory={setEditCategory}
                  editLocation={editLocation}
                  setEditLocation={setEditLocation}
                  editNotes={editNotes}
                  setEditNotes={setEditNotes}
                    onSaveEdit={handleEditSave}
                    cancelEdit={cancelEdit}
                    squads={squads}
                    opponentTeams={opponentTeams}
                    refreshReport={refreshReport}
                    lineupMatchId={lineupMatchId}
                    onToggleLineup={(matchId) => setLineupMatchId(prev => prev === matchId ? null : matchId)}
                    gameFormat={gameFormat}
                    playerProfiles={playerProfiles}
                  />
              ))}
            </div>
          </Surface>
        );
      })}

      {loaded && matches.length > 0 && supportAssignments.length > 0 && (
        <SupportLoadSummary
          supportAssignments={supportAssignments}
          conflictCount={conflictCount}
        />
      )}
    </div>
  );
}

function SupportLoadSummary({
  supportAssignments,
  conflictCount,
}: {
  supportAssignments: SupportAssignment[];
  conflictCount: number;
}) {
  const supportLoadByPlayer = new Map<string, number>();
  for (const a of supportAssignments) {
    supportLoadByPlayer.set(a.playerId, (supportLoadByPlayer.get(a.playerId) ?? 0) + 1);
  }

  return (
    <Surface variant="default" padding="md">
      <SectionHeader title="Support overview" />
      {conflictCount > 0 && (
        <p className="text-xs text-[var(--danger)] mt-1">
          {conflictCount} helper conflict{conflictCount !== 1 ? 's' : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {Array.from(supportLoadByPlayer.entries()).map(([playerId, count]) => {
          const assignment = supportAssignments.find((a) => a.playerId === playerId);
          return (
            <div key={playerId} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-zinc-200">
              <span>{assignment ? `${assignment.firstName} ${assignment.lastName}` : playerId}</span>
              <span className="text-[var(--text-muted)]">
                helping {count} match{count !== 1 ? 'es' : ''}
              </span>
              {assignment && (
                <span className="text-[var(--text-muted)]">from {assignment.sourceEventSquadName}</span>
              )}
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function EventMatchCard({
  match,
  matchDurationMinutes,
  isPending,
  assignmentsForMatch,
  expandedMatchId,
  reportData,
  onToggleReport,
  onSeedReport,
  onCompleteReport,
  onReopenReport,
  onCancel,
  onReopen,
  onDelete,
  onEdit,
  onRemoveHelper,
  onRefresh,
  editingMatchId,
  setEditOpponent,
  editOpponentTeamId,
  setEditOpponentTeamId,
  editSquadId,
  setEditSquadId,
  editStartsAt,
  setEditStartsAt,
  editCategory,
  setEditCategory,
  editLocation,
  setEditLocation,
  editNotes,
  setEditNotes,
  onSaveEdit,
  cancelEdit,
  squads,
  opponentTeams,
  refreshReport,
  lineupMatchId,
  onToggleLineup,
  gameFormat,
  playerProfiles,
}: {
  match: EventMatchWithReport;
  matchDurationMinutes: number | null;
  isPending: boolean;
  assignmentsForMatch: SupportAssignment[];
  conflictCount: number;
  supportLoadByPlayer: Map<string, number>;
  expandedMatchId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportData: any;
  onToggleReport: (matchId: string) => void;
  onSeedReport: (matchId: string) => void;
  onCompleteReport: (reportId: string) => void;
  onReopenReport: (reportId: string) => void;
  onCancel: (matchId: string) => void;
  onReopen: (matchId: string) => void;
  onDelete: (matchId: string) => void;
  onEdit: (m: EventMatchWithReport) => void;
  onRemoveHelper: (assignmentId: string) => void;
  onRefresh: () => void;
  editingMatchId: string | null;
  setEditOpponent: (v: string) => void;
  editOpponentTeamId: string | null;
  setEditOpponentTeamId: (v: string | null) => void;
  editSquadId: string;
  setEditSquadId: (v: string) => void;
  editStartsAt: string;
  setEditStartsAt: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  editLocation: string;
  setEditLocation: (v: string) => void;
  editNotes: string;
  setEditNotes: (v: string) => void;
  onSaveEdit: (matchId: string) => void;
  cancelEdit: () => void;
  squads: Array<{ id: string; name: string; intent: string; players: Array<{ playerId: string }> }>;
  opponentTeams: Array<{ id: string; displayName: string }>;
  refreshReport: () => void;
  lineupMatchId: string | null;
  onToggleLineup: (matchId: string) => void;
  gameFormat: string;
  playerProfiles: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string | null;
    coreTeamId: string | null;
    overallLevel: number | null;
  }>;
}) {
  const [addingHelper, setAddingHelper] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [candidates, setCandidates] = useState<EventSupportCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [helperError, setHelperError] = useState<string | null>(null);
  const [, startHelperTransition] = useTransition();

  function handleAddClick() {
    if (addingHelper) {
      setAddingHelper(false);
      setCandidates([]);
      setSelectedPlayerId(null);
      setSelectedRole('');
      setHelperError(null);
      return;
    }
    setAddingHelper(true);
    setSelectedPlayerId(null);
    setSelectedRole('');
    setHelperError(null);
    setCandidates([]);
    setLoadingCandidates(true);
    startHelperTransition(async () => {
      try {
        const result = await getSupportCandidatesForMatchAction(match.id);
        setCandidates(result);
      } catch (err) {
        setHelperError(err instanceof Error ? err.message : 'Failed to load candidates');
      } finally {
        setLoadingCandidates(false);
      }
    });
  }

  function handleAddHelper() {
    if (!selectedPlayerId) return;
    setHelperError(null);
    startHelperTransition(async () => {
      try {
        await addEventMatchSupportAssignmentAction({
          eventMatchId: match.id,
          playerId: selectedPlayerId,
          plannedRole: selectedRole || undefined,
        });
        setAddingHelper(false);
        setCandidates([]);
        setSelectedPlayerId(null);
        setSelectedRole('');
        onRefresh();
      } catch (err) {
        setHelperError(err instanceof Error ? err.message : 'Failed to add helper');
      }
    });
  }

  const eligibleCandidates = candidates.filter((c) => c.available);
  const blockedCandidates = candidates.filter((c) => !c.available);

  return (
    <div className="rounded-lg border border-[var(--border-soft)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {match.report && (
            <button
              onClick={() => onToggleReport(match.id)}
              className="text-[var(--accent)] hover:underline text-xs font-medium"
            >
              {expandedMatchId === match.id ? '▼' : '▶'}
            </button>
          )}
          <span className="text-sm font-medium text-zinc-100">vs {match.opponentName}</span>
          <StatusPill variant={match.status === 'CANCELLED' ? 'warning' : 'neutral'}>
            {CATEGORY_LABELS[match.category] ?? match.category}
          </StatusPill>
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(match.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {matchDurationMinutes && (
              <>-{new Date(new Date(match.startsAt).getTime() + matchDurationMinutes * 60 * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {match.status === 'CANCELLED' ? (
            <>
              <StatusPill variant="warning">Cancelled</StatusPill>
              <button
                onClick={() => onReopen(match.id)}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                Reopen
              </button>
            </>
          ) : (
            <>
              {match.report ? (
                <>
                  <StatusPill variant={match.report.status === 'LOCKED' ? 'success' : 'neutral'}>
                    {REPORT_STATUS_LABELS[match.report.status] ?? match.report.status}
                  </StatusPill>
                  {match.report.ourScore !== null && match.report.opponentScore !== null && (
                    <span className="text-xs font-mono text-zinc-200 ml-1">
                      {match.report.ourScore}-{match.report.opponentScore}
                    </span>
                  )}
                  {match.report.status === 'DRAFT' && (
                    <button
                      onClick={() => onCompleteReport(match.report!.id)}
                      className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                    >
                      Complete
                    </button>
                  )}
                  {match.report.status === 'LOCKED' && (
                    <button
                      onClick={() => onReopenReport(match.report!.id)}
                      className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                    >
                      Reopen
                    </button>
                  )}
                </>
              ) : (
                <>
                  <StatusPill variant="neutral">No report</StatusPill>
                  <button
                    onClick={() => onSeedReport(match.id)}
                    className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                  >
                    Open report
                  </button>
                </>
              )}
              <button
                onClick={() => onCancel(match.id)}
                className="text-[10px] text-[var(--danger)] hover:underline ml-1"
              >
                Cancel
              </button>
              <button
                onClick={() => onEdit(match)}
                className="text-[10px] text-[var(--accent)] hover:underline ml-1"
              >
                Edit
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(match.id)}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:underline ml-1"
          >
            Delete
          </button>
          {match.status !== 'CANCELLED' && (
            <button
              onClick={() => onToggleLineup(match.id)}
              className="text-[10px] text-[var(--accent)] hover:underline ml-1"
            >
              {lineupMatchId === match.id ? '▼ Lineup' : '▶ Lineup'}
            </button>
          )}
        </div>
      </div>
      {match.location && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{match.location}</p>
      )}
      {match.cancelledReason && (
        <p className="text-xs text-[var(--warning)] mt-1">Cancelled: {match.cancelledReason}</p>
      )}

      {match.status !== 'CANCELLED' && (
        <div className="mt-2 border-t border-[var(--border-soft)] pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Helpers</p>
            <button
              onClick={handleAddClick}
              className="text-[10px] text-[var(--accent)] hover:underline"
              disabled={isPending}
            >
              {addingHelper ? 'Cancel' : '+ Add helper'}
            </button>
          </div>

          {assignmentsForMatch.length === 0 && !addingHelper && (
            <p className="text-xs text-[var(--text-muted)] mt-1">none</p>
          )}

          {assignmentsForMatch.length > 0 && (
            <div className="space-y-1 mt-1">
              {assignmentsForMatch.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-200">
                    {a.firstName} {a.lastName}
                    <span className="text-[var(--text-muted)] ml-1">from {a.sourceEventSquadName}</span>
                    {a.plannedRole && <span className="text-[var(--text-muted)] ml-1">({a.plannedRole})</span>}
                    {a.isConflict && <span className="text-[var(--danger)] ml-1">⚠ {a.conflictReason}</span>}
                  </span>
                  <button
                    onClick={() => onRemoveHelper(a.id)}
                    className="text-[var(--danger)] hover:underline text-[10px]"
                    disabled={isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {helperError && (
            <div className="mt-1 rounded border border-red-800/50 bg-red-950/30 px-2 py-1 text-[10px] text-red-300">
              {helperError}
            </div>
          )}

          {addingHelper && (
            <div className="mt-2 space-y-2">
              {loadingCandidates && (
                <p className="text-xs text-[var(--text-muted)]">Loading candidates...</p>
              )}

              {!loadingCandidates && candidates.length > 0 && (
                <>
                  {eligibleCandidates.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">Available helpers</p>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <select
                            value={selectedPlayerId ?? ''}
                            onChange={(e) => setSelectedPlayerId(e.target.value || null)}
                            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-zinc-200"
                          >
                            <option value="">Select player...</option>
                            {eligibleCandidates.map((c) => (
                              <option key={c.playerId} value={c.playerId}>
                                {c.firstName}{c.lastName ? ` ${c.lastName}` : ''} · from {c.sourceEventSquadName}{c.isGK ? ' · GK' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-36">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-zinc-200"
                          >
                            {PLANNED_ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r || 'No specific role'}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleAddHelper}
                          disabled={!selectedPlayerId || isPending}
                          className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">No available helpers at this match time.</p>
                  )}

                  {blockedCandidates.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">Unavailable at this time</p>
                      <div className="space-y-0.5">
                        {blockedCandidates.map((c) => (
                          <p key={c.playerId} className="text-xs text-[var(--text-muted)]">
                            {c.firstName}{c.lastName ? ` ${c.lastName}` : ''} · {c.unavailableReason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!loadingCandidates && candidates.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">No candidates found.</p>
              )}
            </div>
          )}
        </div>
      )}

      {editingMatchId === match.id && (
        <div className="mt-3 border-t border-[var(--border-soft)] pt-3 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-100">Edit match</h4>
          <OpponentTeamSelect
            opponentTeams={opponentTeams}
            selectedId={editOpponentTeamId}
            onSelectionChange={(id, name) => {
              setEditOpponentTeamId(id);
              setEditOpponent(name);
            }}
            onTextChange={(name) => {
              setEditOpponentTeamId(null);
              setEditOpponent(name);
            }}
          />
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Squad</label>
            <select
              value={editSquadId}
              onChange={(e) => setEditSquadId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
            >
              {squads.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Date and time</label>
            <input
              type="datetime-local"
              value={editStartsAt}
              onChange={(e) => setEditStartsAt(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
            >
              <option value="CUP">Cup</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Location (optional)</label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Notes (optional)</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(match.id)}
              disabled={isPending}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {expandedMatchId === match.id && reportData && (
        <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
          <EventMatchReportPanel
            report={{
              id: reportData.id,
              status: reportData.status,
              ourScore: reportData.ourScore,
              opponentScore: reportData.opponentScore,
              teamReflection: reportData.teamReflection,
              opponentObservation: reportData.opponentObservation,
              notes: reportData.notes,
              playerReports: (reportData.playerReports ?? []).map((pr: { id: string; playerId: string; attendanceStatus: string; source: string; role: string | null; player: { firstName: string; lastName: string | null } | null }) => ({
                id: pr.id,
                playerId: pr.playerId,
                playerName: pr.player ? `${pr.player.firstName}${pr.player.lastName ? ' ' + pr.player.lastName : ''}` : 'Unknown',
                attendanceStatus: pr.attendanceStatus,
                source: pr.source,
                role: pr.role,
              })),
              goalEvents: (reportData.goalEvents ?? []).map((g: { id: string; playerId: string | null; minute: number | null; type: string; note: string | null; scorer: { firstName: string; lastName: string | null } | null }) => ({
                id: g.id,
                playerId: g.playerId,
                playerName: g.scorer ? `${g.scorer.firstName}${g.scorer.lastName ? ' ' + g.scorer.lastName : ''}` : null,
                minute: g.minute,
                type: g.type,
                note: g.note,
              })),
              assistEvents: (reportData.assistEvents ?? []).map((a: { id: string; playerId: string; type: string; assist: { firstName: string; lastName: string | null } | null }) => ({
                id: a.id,
                playerId: a.playerId,
                playerName: a.assist ? `${a.assist.firstName}${a.assist.lastName ? ' ' + a.assist.lastName : ''}` : null,
                type: a.type,
              })),
            }}
            isLocked={reportData.status === 'LOCKED'}
            onRefresh={refreshReport}
          />
        </div>
      )}
      {expandedMatchId === match.id && isPending && !reportData && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Loading report...</p>
      )}
      {lineupMatchId === match.id && match.status !== 'CANCELLED' && (
        <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
          <EventMatchLineupPanel
            eventMatchId={match.id}
            squadPlayers={squads
              .filter((s) => s.id === match.eventSquadId)
              .flatMap((s) =>
                s.players
                  .map((sp) => {
                    const profile = playerProfiles.find((pp) => pp.id === sp.playerId);
                    return profile
                      ? {
                          id: profile.id,
                          firstName: profile.firstName,
                          lastName: profile.lastName,
                          primaryPosition: profile.primaryPosition,
                          secondaryPosition: profile.secondaryPosition,
                          tertiaryPosition: profile.tertiaryPosition,
                          goalkeeperAbility: profile.goalkeeperAbility ?? 'NO',
                          isGK: profile.goalkeeperAbility === 'YES',
                          source: 'squad' as const,
                          squadName: squads.find((sq) => sq.id === s.id)?.name ?? null,
                          overallLevel: profile.overallLevel ?? null,
                        }
                      : undefined;
                  })
                  .filter((p): p is NonNullable<typeof p> => p !== undefined),
              )}
            gameFormat={gameFormat}
            helperPlayers={assignmentsForMatch
              .filter((a) => !a.isConflict)
              .map((a) => {
                const profile = playerProfiles.find((pp) => pp.id === a.playerId);
                return {
                  id: a.playerId,
                  firstName: a.firstName,
                  lastName: a.lastName,
                  primaryPosition: profile?.primaryPosition ?? null,
                  secondaryPosition: profile?.secondaryPosition ?? null,
                  tertiaryPosition: profile?.tertiaryPosition ?? null,
                  goalkeeperAbility: profile?.goalkeeperAbility ?? 'NO',
                  isGK: profile?.goalkeeperAbility === 'YES',
                  source: 'helper' as const,
                  squadName: a.sourceEventSquadName,
                  overallLevel: profile?.overallLevel ?? null,
                };
              })}
          />
        </div>
      )}
    </div>
  );
}