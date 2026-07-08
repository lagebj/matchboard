'use client';

import { useState, useTransition, useCallback } from 'react';
import {
  addEventMatchSupportAssignmentAction,
  removeEventMatchSupportAssignmentAction,
  getSupportCandidatesForMatchAction,
} from '../event-support-actions';
import type { EventSupportCandidate } from '@/lib/events/event-match-support';
import type { SupportAssignmentWithConflict } from '@/lib/events/event-match-support';
import { Surface } from '@/components/ui/surface';

const PLANNED_ROLE_OPTIONS = ['', 'GK cover', 'Defender cover', 'Midfield cover', 'Forward cover', 'General cover'];

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

type SupportPlanningProps = {
  eventId: string;
  matchDurationMinutes: number | null;
  matches: {
    id: string;
    eventSquadId: string;
    opponentName: string;
    startsAt: Date | string;
    status: string;
  }[];
  squads: Array<{
    id: string;
    name: string;
    players: Array<{ playerId: string }>;
  }>;
  supportAssignments: SupportAssignment[];
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
};

function formatName(p: { firstName: string; lastName: string | null }): string {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatEndTime(startsAt: Date | string, durationMinutes: number | null): string {
  if (!durationMinutes) return '?';
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return formatTime(end);
}

export function SupportPlanningSection({
  eventId,
  matchDurationMinutes,
  matches,
  squads,
  supportAssignments,
  playerProfiles,
  playerAvailability,
}: SupportPlanningProps) {
  const [isPending, startTransition] = useTransition();
  const [addingMatchId, setAddingMatchId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EventSupportCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  if (!matchDurationMinutes) {
    return (
      <Surface variant="default" padding="md">
        <SectionHeader title="Support planning" />
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Set event match duration before support availability can be calculated.
        </p>
      </Surface>
    );
  }

  const scheduledMatches = matches.filter((m) => m.status !== 'CANCELLED');

  if (scheduledMatches.length === 0) {
    return null;
  }

  const assignmentsByMatch = new Map<string, SupportAssignment[]>();
  for (const a of supportAssignments) {
    const list = assignmentsByMatch.get(a.eventMatchId) ?? [];
    list.push(a);
    assignmentsByMatch.set(a.eventMatchId, list);
  }

  const squadNames = new Map(squads.map((s) => [s.id, s.name]));

  const supportLoadByPlayer = new Map<string, number>();
  for (const a of supportAssignments) {
    supportLoadByPlayer.set(a.playerId, (supportLoadByPlayer.get(a.playerId) ?? 0) + 1);
  }

  function handleAddClick(matchId: string) {
    if (addingMatchId === matchId) {
      setAddingMatchId(null);
      setCandidates([]);
      setSelectedPlayerId(null);
      setSelectedRole('');
      setError(null);
      return;
    }
    setAddingMatchId(matchId);
    setSelectedPlayerId(null);
    setSelectedRole('');
    setError(null);
    setCandidates([]);
    setLoadingCandidates(true);
    startTransition(async () => {
      try {
        const result = await getSupportCandidatesForMatchAction(matchId);
        setCandidates(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load candidates');
      } finally {
        setLoadingCandidates(false);
      }
    });
  }

  function handleAddHelper(matchId: string) {
    if (!selectedPlayerId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addEventMatchSupportAssignmentAction({
          eventMatchId: matchId,
          playerId: selectedPlayerId,
          plannedRole: selectedRole || undefined,
        });
        setAddingMatchId(null);
        setCandidates([]);
        setSelectedPlayerId(null);
        setSelectedRole('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add helper');
      }
    });
  }

  function handleRemoveHelper(assignmentId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeEventMatchSupportAssignmentAction(assignmentId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove helper');
      }
    });
  }

  const eligibleCandidates = candidates.filter((c) => c.available);
  const blockedCandidates = candidates.filter((c) => !c.available);

  return (
    <Surface variant="default" padding="md">
      <SectionHeader title="Support planning" />
      <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
        Plan temporary player help between event squads. Players can only help when their own squad is not playing at the same time.
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {scheduledMatches.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).map((match) => {
          const matchAssignments = assignmentsByMatch.get(match.id) ?? [];
          const targetSquad = squads.find((s) => s.id === match.eventSquadId);
          const targetSquadName = targetSquad?.name ?? 'Unknown squad';
          const isAdding = addingMatchId === match.id;

          return (
            <div key={match.id} className="border border-[var(--border-soft)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {targetSquadName} vs {match.opponentName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatTime(match.startsAt)}-{formatEndTime(match.startsAt, matchDurationMinutes)}
                  </span>
                </div>
                <button
                  onClick={() => handleAddClick(match.id)}
                  className="text-xs text-[var(--accent)] hover:underline"
                  disabled={isPending}
                >
                  {isAdding ? 'Cancel' : '+ Add helper'}
                </button>
              </div>

              {matchAssignments.length > 0 && (
                <div className="space-y-1 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Planned help</p>
                  {matchAssignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200">
                        {a.firstName} {a.lastName}
                        <span className="text-[var(--text-muted)] ml-1">from {a.sourceEventSquadName}</span>
                        {a.plannedRole && <span className="text-[var(--text-muted)] ml-1">({a.plannedRole})</span>}
                        {a.isConflict && <span className="text-[var(--danger)] ml-1">⚠ {a.conflictReason}</span>}
                      </span>
                      <button
                        onClick={() => handleRemoveHelper(a.id)}
                        className="text-[var(--danger)] hover:underline text-[10px]"
                        disabled={isPending}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isAdding && (
                <div className="border-t border-[var(--border-soft)] pt-2 mt-2 space-y-2">
                  {loadingCandidates && (
                    <p className="text-xs text-[var(--text-muted)]">Loading candidates...</p>
                  )}

                  {!loadingCandidates && candidates.length > 0 && (
                    <>
                      {eligibleCandidates.length > 0 && (
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
                              onClick={() => handleAddHelper(match.id)}
                              disabled={!selectedPlayerId || isPending}
                              className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}

                      {eligibleCandidates.length === 0 && (
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
          );
        })}
      </div>

      {supportAssignments.length > 0 && (
        <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-2">Support load</h4>
          <div className="flex flex-wrap gap-2">
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
        </div>
      )}
    </Surface>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>;
}