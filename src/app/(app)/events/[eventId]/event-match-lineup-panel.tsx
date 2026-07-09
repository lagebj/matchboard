'use client';

import { useState, useTransition, useCallback } from 'react';
import {
  getEventMatchLineup,
  createEventMatchLineup,
  assignPlayerToLineupSlot,
  removePlayerFromLineupSlot,
  clearEventMatchLineup,
  autoFillEventMatchLineup,
  changeEventMatchLineupFormation,
  getAvailableFormations,
} from './event-lineup-actions';
import { Surface } from '@/components/ui/surface';

type FormationSlot = {
  id: string;
  roleType: string;
  label: string | null;
  gridX: number;
  gridY: number;
  acceptedPositionIds: string[] | unknown[];
  sortOrder: number;
};

type Formation = {
  id: string;
  name: string;
  gameFormat: string;
  slots: FormationSlot[];
};

type LineupAssignment = {
  id: string;
  lineupId: string;
  playerId: string | null;
  slotId: string | null;
  slotIndex: number | null;
  slotLabel: string | null;
  roleType: string | null;
  source: string;
  x: number | null;
  y: number | null;
  player: {
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string;
  } | null;
};

type LineupData = {
  id: string;
  eventMatchId: string;
  formationId: string | null;
  status: string;
  formation: Formation | null;
  assignments: LineupAssignment[];
};

type SquadPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  goalkeeperAbility: string;
  isGK: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  GOALKEEPER: 'GK',
  DEFENDER: 'DEF',
  DEFENSIVE_MIDFIELDER: 'CDM',
  MIDFIELDER: 'MID',
  ATTACKING_MIDFIELDER: 'CAM',
  FORWARD: 'FWD',
  FREE: 'Flex',
};

export function EventMatchLineupPanel({
  eventMatchId,
  squadPlayers,
  gameFormat,
}: {
  eventMatchId: string;
  squadPlayers: SquadPlayer[];
  gameFormat: string;
}) {
  const [lineup, setLineup] = useState<LineupData | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadLineup = useCallback(() => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const [lineupData, formationsData] = await Promise.all([
          getEventMatchLineup(eventMatchId),
          getAvailableFormations(gameFormat),
        ]);
        setLineup(lineupData as LineupData | null);
        setFormations(formationsData as Formation[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lineup');
      } finally {
        setLoading(false);
      }
    });
  }, [eventMatchId, gameFormat, startTransition]);

  const handleCreate = (formationId?: string) => {
    startTransition(async () => {
      try {
        setError(null);
        const data = await createEventMatchLineup({
          eventMatchId,
          formationId,
        });
        const fullLineup = await getEventMatchLineup(eventMatchId);
        setLineup(fullLineup as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create lineup');
      }
    });
  };

  const handleAutoFill = () => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        await autoFillEventMatchLineup(lineup.id);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to auto-fill');
      }
    });
  };

  const handleClear = () => {
    if (!lineup) return;
    if (!confirm('Clear all player assignments?')) return;
    startTransition(async () => {
      try {
        setError(null);
        await clearEventMatchLineup(lineup.id);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear lineup');
      }
    });
  };

  const handleChangeFormation = (formationId: string | null) => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        await changeEventMatchLineupFormation(lineup.id, formationId);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change formation');
      }
    });
  };

  const handleAssign = (assignmentId: string, playerId: string) => {
    if (!lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        await assignPlayerToLineupSlot(lineup.id, assignmentId, playerId);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign player');
      }
    });
  };

  const handleRemove = (assignmentId: string) => {
    startTransition(async () => {
      try {
        setError(null);
        await removePlayerFromLineupSlot(assignmentId);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove player');
      }
    });
  };

  const assignedPlayerIds = new Set(
    (lineup?.assignments ?? []).filter((a) => a.playerId).map((a) => a.playerId!),
  );

  if (!lineup && !loading) {
    return (
      <Surface variant="default" padding="md">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-100">Lineup</h4>
            <button
              onClick={loadLineup}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Load lineup
            </button>
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
      </Surface>
    );
  }

  if (loading && !lineup) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-sm text-[var(--text-muted)]">Loading lineup...</p>
      </Surface>
    );
  }

  if (!lineup) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-sm text-[var(--text-muted)]">No lineup data.</p>
      </Surface>
    );
  }

  return (
    <Surface variant="default" padding="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-100">Lineup</h4>
          <div className="flex gap-2">
            <button
              onClick={handleAutoFill}
              disabled={isPending}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Auto-fill
            </button>
            <button
              onClick={handleClear}
              disabled={isPending}
              className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">
            Formation
          </label>
          <select
            value={lineup.formationId ?? ''}
            onChange={(e) => handleChangeFormation(e.target.value || null)}
            disabled={isPending}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">No formation</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {lineup.assignments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Positions
            </p>
            {lineup.assignments.map((assignment) => {
              const roleLabel = ROLE_LABELS[assignment.roleType ?? ''] ?? assignment.roleType ?? 'Slot';
              const availablePlayers = squadPlayers.filter(
                (p) => !assignedPlayerIds.has(p.id) || p.id === assignment.playerId,
              );

              return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--border-soft)] px-3 py-2"
                >
                  <span className="w-12 text-xs font-mono font-medium text-zinc-300">
                    {roleLabel}
                  </span>
                  <select
                    value={assignment.playerId ?? ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssign(assignment.id, e.target.value);
                      } else {
                        handleRemove(assignment.id);
                      }
                    }}
                    disabled={isPending}
                    className="flex-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-zinc-200"
                  >
                    <option value="">— Empty —</option>
                    {availablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}{p.isGK ? ' · GK' : ''}{p.primaryPosition ? ` · ${p.primaryPosition}` : ''}
                      </option>
                    ))}
                  </select>
                  {assignment.playerId && (
                    <button
                      onClick={() => handleRemove(assignment.id)}
                      className="text-[var(--danger)] hover:underline text-[10px]"
                      disabled={isPending}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {lineup.formationId
              ? 'Formation selected but no slots found.'
              : 'Select a formation to set up positions.'}
          </p>
        )}

        {lineup.assignments.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">
              Unassigned players
            </p>
            <div className="flex flex-wrap gap-1">
              {squadPlayers
                .filter((p) => !assignedPlayerIds.has(p.id))
                .map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-zinc-300"
                  >
                    {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}{p.isGK ? ' · GK' : ''}
                  </span>
                ))}
              {squadPlayers.filter((p) => !assignedPlayerIds.has(p.id)).length === 0 && (
                <span className="text-xs text-[var(--text-muted)]">All players assigned</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Surface>
  );
}