'use client';

import { useState, useTransition } from 'react';
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
import { getEventMatchSupportAssignmentsAction } from '../event-support-actions';
import { getDefaultEventMatchCategory } from '@/lib/stats/match-category';
import { getEventMatchWindow } from '@/lib/events/event-match-time';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { EventMatchReportPanel } from './event-match-report-panel';
import { SupportPlanningSection } from './event-support-planning';

interface EventMatchWithReport {
  id: string;
  eventSquadId: string;
  category: string;
  opponentName: string;
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

interface EventMatchesTabProps {
  eventId: string;
  squads: Array<{
    id: string;
    name: string;
    intent: string;
    players: Array<{ playerId: string }>;
  }>;
  eventType: string;
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
  }>;
  playerAvailability: Array<{ playerId: string; status: string }>;
}

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

export function EventMatchesTab({ eventId, squads, eventType, matchDurationMinutes, playerProfiles, playerAvailability }: EventMatchesTabProps) {
  const [matches, setMatches] = useState<EventMatchWithReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [supportAssignments, setSupportAssignments] = useState<any[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSquadId, setCreateSquadId] = useState(squads[0]?.id ?? '');
  const [createOpponent, setCreateOpponent] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createCategory, setCreateCategory] = useState<string>(
    getDefaultEventMatchCategory(eventType),
  );
  const [createLocation, setCreateLocation] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editOpponent, setEditOpponent] = useState('');
  const [editSquadId, setEditSquadId] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editCategory, setEditCategory] = useState('CUP');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report data shape varies with Prisma includes
  const [reportData, setReportData] = useState<any>(null);

  function loadMatches() {
    startTransition(async () => {
      const [matchResult, supportResult] = await Promise.all([
        listEventMatchesAction(eventId),
        getEventMatchSupportAssignmentsAction(eventId),
      ]);
      setMatches(matchResult);
      setSupportAssignments(supportResult);
      setLoaded(true);
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set('eventId', eventId);
    formData.set('eventSquadId', createSquadId);
    formData.set('opponentName', createOpponent);
    formData.set('startsAt', createDate ? new Date(createDate).toISOString() : '');
    formData.set('category', createCategory);
    formData.set('location', createLocation);
    formData.set('notes', createNotes);

    startTransition(async () => {
      await createEventMatchAction(formData);
      setShowCreateForm(false);
      setCreateOpponent('');
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

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader title="Matches" />
          <button
            onClick={loadMatches}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Load matches
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Click &quot;Load matches&quot; to see and manage event matches.
        </p>
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
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Opponent name</label>
              <input
                type="text"
                value={createOpponent}
                onChange={(e) => setCreateOpponent(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                required
              />
            </div>
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
                <div key={m.id} className="rounded-lg border border-[var(--border-soft)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {m.report && (
                        <button
                          onClick={() => handleToggleReport(m.id)}
                          className="text-[var(--accent)] hover:underline text-xs font-medium"
                        >
                          {expandedMatchId === m.id ? '▼' : '▶'}
                        </button>
                      )}
                      <span className="text-sm font-medium text-zinc-100">vs {m.opponentName}</span>
                      <StatusPill variant={m.status === 'CANCELLED' ? 'warning' : 'neutral'}>
                        {CATEGORY_LABELS[m.category] ?? m.category}
                      </StatusPill>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(m.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {matchDurationMinutes && (
                          <>-{new Date(new Date(m.startsAt).getTime() + matchDurationMinutes * 60 * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {m.status === 'CANCELLED' ? (
                        <>
                          <StatusPill variant="warning">Cancelled</StatusPill>
                          <button
                            onClick={() => handleReopen(m.id)}
                            className="text-[10px] text-[var(--accent)] hover:underline"
                          >
                            Reopen
                          </button>
                        </>
                      ) : (
                        <>
                          {m.report ? (
                            <>
                              <StatusPill variant={m.report.status === 'LOCKED' ? 'success' : 'neutral'}>
                                {REPORT_STATUS_LABELS[m.report.status] ?? m.report.status}
                              </StatusPill>
                              {m.report.ourScore !== null && m.report.opponentScore !== null && (
                                <span className="text-xs font-mono text-zinc-200 ml-1">
                                  {m.report.ourScore}-{m.report.opponentScore}
                                </span>
                              )}
                              {m.report.status === 'DRAFT' && (
                                <button
                                  onClick={() => handleCompleteReport(m.report!.id)}
                                  className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                                >
                                  Complete
                                </button>
                              )}
                              {m.report.status === 'LOCKED' && (
                                <button
                                  onClick={() => handleReopenReport(m.report!.id)}
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
                                onClick={() => handleSeedReport(m.id)}
                                className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                              >
                                Open report
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleCancel(m.id)}
                            className="text-[10px] text-[var(--danger)] hover:underline ml-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => startEditMatch(m)}
                            className="text-[10px] text-[var(--accent)] hover:underline ml-1"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:underline ml-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {m.location && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{m.location}</p>
                  )}
                  {m.cancelledReason && (
                    <p className="text-xs text-[var(--warning)] mt-1">Cancelled: {m.cancelledReason}</p>
                  )}
                  {editingMatchId === m.id && (
                    <div className="mt-3 border-t border-[var(--border-soft)] pt-3 space-y-2">
                      <h4 className="text-xs font-semibold text-zinc-100">Edit match</h4>
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Opponent name</label>
                        <input
                          type="text"
                          value={editOpponent}
                          onChange={(e) => setEditOpponent(e.target.value)}
                          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                          required
                        />
                      </div>
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
                          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
                          rows={2}
                          maxLength={500}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSave(m.id)}
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
                  {expandedMatchId === m.id && reportData && (
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
                  {expandedMatchId === m.id && isPending && !reportData && (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">Loading report...</p>
                  )}
                </div>
              ))}
            </div>
          </Surface>
        );
      })}

      {loaded && matches.length > 0 && (
        <SupportPlanningSection
          eventId={eventId}
          matchDurationMinutes={matchDurationMinutes}
          matches={matches.map((m) => ({
            id: m.id,
            eventSquadId: m.eventSquadId,
            opponentName: m.opponentName,
            startsAt: m.startsAt,
            status: m.status,
          }))}
          squads={squads}
          supportAssignments={supportAssignments}
          playerProfiles={playerProfiles}
          playerAvailability={playerAvailability}
        />
      )}
    </div>
  );
}