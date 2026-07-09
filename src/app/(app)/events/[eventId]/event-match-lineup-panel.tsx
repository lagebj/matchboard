'use client';

import { useState, useTransition, useCallback, useEffect, useMemo } from 'react';
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
import { getPlayerSlotCompatibility } from '@/lib/formations/lineup-compatibility';
import type { FormationSlotRoleType, BroadPosition, FormationSlotData } from '@/lib/formations/types';
import { ROLE_TYPE_LABELS } from '@/lib/formations/types';
import { PitchLineupView } from '@/components/formations/pitch-formation';
import { PlayerPicker } from '@/components/formations/player-picker';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/cn';

type FormationSlot = {
  id: string;
  roleType: string;
  label: string | null;
  gridX: number;
  gridY: number;
  acceptedPositionIds: string[] | unknown[];
  sortOrder: number;
  shortLabel?: string;
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

type PoolPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string;
  isGK: boolean;
  source: 'squad' | 'helper';
  squadName: string | null;
};

export function EventMatchLineupPanel({
  eventMatchId,
  squadPlayers,
  gameFormat,
  helperPlayers,
}: {
  eventMatchId: string;
  squadPlayers: PoolPlayer[];
  gameFormat: string;
  helperPlayers?: PoolPlayer[];
}) {
  const [lineup, setLineup] = useState<LineupData | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pickerState, setPickerState] = useState<{
    assignmentId: string | null;
    slotId: string;
    slotLabel: string;
    acceptedPositions: BroadPosition[];
  } | null>(null);

  const eligiblePlayers = useMemo(() => {
    const pool = [...squadPlayers];
    if (helperPlayers) {
      for (const hp of helperPlayers) {
        if (!pool.some((p) => p.id === hp.id)) {
          pool.push(hp);
        }
      }
    }
    return pool;
  }, [squadPlayers, helperPlayers]);

  const loadLineup = useCallback(() => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const [lineupData, formationsData] = await Promise.all([
          getEventMatchLineup(eventMatchId),
          getAvailableFormations(gameFormat),
        ]);
        if (lineupData) {
          setLineup(lineupData as LineupData);
        }
        setFormations(formationsData as Formation[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lineup');
      } finally {
        setLoading(false);
      }
    });
  }, [eventMatchId, gameFormat, startTransition]);

  useEffect(() => {
    loadLineup();
  }, [loadLineup]);

  const handleCreate = (formationId?: string) => {
    startTransition(async () => {
      try {
        setError(null);
        await createEventMatchLineup({ eventMatchId, formationId });
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
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

  const handleChangeFormation = (formationId: string) => {
    if (!lineup) return;
    const hasAssignments = lineup.assignments.some((a) => a.playerId !== null);
    if (hasAssignments) {
      const confirmed = window.confirm('Changing formation will replace all current assignments. Continue?');
      if (!confirmed) return;
    }
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

  const handleSlotClick = useCallback((assignmentId: string | null, slotId: string, _playerId: string | null) => {
    if (!lineup || lineup.status === 'CONFIRMED') return;
    const formationSlot = lineup.formation?.slots.find((s) => s.id === slotId);
    setPickerState({
      assignmentId,
      slotId,
      slotLabel: formationSlot?.label ?? formationSlot?.roleType ?? 'Slot',
      acceptedPositions: (formationSlot?.acceptedPositionIds ?? []) as BroadPosition[],
    });
  }, [lineup]);

  const handlePlayerSelect = useCallback((playerId: string) => {
    if (!pickerState || !lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        const targetAssignmentId = pickerState.assignmentId ?? lineup.assignments.find((a) => a.slotId === pickerState.slotId && !a.playerId)?.id;
        if (!targetAssignmentId) return;
        await assignPlayerToLineupSlot(lineup.id, targetAssignmentId, playerId);
        setPickerState(null);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign player');
      }
    });
  }, [pickerState, lineup, eventMatchId, startTransition]);

  const handleRemovePlayer = useCallback(() => {
    if (!pickerState?.assignmentId || !lineup) return;
    startTransition(async () => {
      try {
        setError(null);
        await removePlayerFromLineupSlot(pickerState.assignmentId!);
        setPickerState(null);
        const updated = await getEventMatchLineup(eventMatchId);
        setLineup(updated as LineupData | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove player');
      }
    });
  }, [pickerState, lineup, eventMatchId, startTransition]);

  const assignedPlayerIds = useMemo(
    () => new Set((lineup?.assignments ?? []).filter((a) => a.playerId).map((a) => a.playerId!)),
    [lineup],
  );

  const assignedAssignmentId = useMemo(() => {
    if (!pickerState) return null;
    return lineup?.assignments.find((a) => a.slotId === pickerState.slotId && a.playerId)?.playerId ?? null;
  }, [pickerState, lineup]);

  const currentAssignedPlayer = useMemo(() => {
    if (!assignedAssignmentId) return null;
    return eligiblePlayers.find((p) => p.id === assignedAssignmentId) ?? null;
  }, [assignedAssignmentId, eligiblePlayers]);

  const pickerSlot: FormationSlotData | null = useMemo(() => {
    if (!pickerState) return null;
    return {
      id: pickerState.slotId,
      gridX: 0,
      gridY: 0,
      label: pickerState.slotLabel,
      shortLabel: ROLE_TYPE_LABELS[pickerState.acceptedPositions[0] as FormationSlotRoleType] ?? pickerState.slotLabel,
      roleType: 'FREE' as FormationSlotRoleType,
      acceptedPositionIds: pickerState.acceptedPositions,
      sortOrder: 0,
    };
  }, [pickerState]);

  const pitchSlots = useMemo(() => {
    if (!lineup?.formation?.slots) return [];
    return lineup.formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label ?? s.roleType,
      shortLabel: ROLE_TYPE_LABELS[s.roleType as FormationSlotRoleType] ?? s.roleType,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: (s.acceptedPositionIds ?? []) as BroadPosition[],
      sortOrder: s.sortOrder,
    }));
  }, [lineup]);

  const pitchAssignments = useMemo(() => {
    if (!lineup) return [];
    return lineup.assignments.map((a) => ({
      id: a.id,
      slotId: a.slotId ?? '',
      playerId: a.playerId,
      locked: false,
      source: a.source,
    }));
  }, [lineup]);

  const pitchPlayers = useMemo(() => {
    return eligiblePlayers.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      primaryPosition: p.primaryPosition ?? 'FREE',
    }));
  }, [eligiblePlayers]);

  if (loading) {
    return (
      <Surface variant="default" padding="md">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-100">Lineup</h4>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Loading lineup...</p>
      </Surface>
    );
  }

  if (error && !lineup) {
    return (
      <Surface variant="default" padding="md">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-100">Lineup</h4>
        </div>
        <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
        <button
          onClick={loadLineup}
          className="mt-2 rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[var(--surface-hover)]"
        >
          Retry
        </button>
      </Surface>
    );
  }

  if (!lineup) {
    return (
      <Surface variant="default" padding="md">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-100">Lineup</h4>
          <button
            onClick={() => handleCreate(formations[0]?.id)}
            disabled={isPending || formations.length === 0}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            Create lineup
          </button>
        </div>
        {formations.length === 0 && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No formations available for this game format. Create a formation first.</p>
        )}
        {formations.length > 0 && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No starting lineup planned yet. Select a formation to begin.</p>
        )}
        {formations.length > 0 && (
          <div className="mt-3">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">
              Formation
            </label>
            <select
              onChange={(e) => { if (e.target.value) handleCreate(e.target.value); }}
              disabled={isPending}
              className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
              defaultValue=""
            >
              <option value="" disabled>Select a formation...</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
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
            onChange={(e) => { if (e.target.value) handleChangeFormation(e.target.value); }}
            disabled={isPending}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">No formation</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {pitchSlots.length > 0 ? (
          <PitchLineupView
            gameFormat={gameFormat}
            slots={pitchSlots}
            assignments={pitchAssignments}
            players={pitchPlayers}
            onSlotClick={handleSlotClick}
            readOnly={lineup.status === 'CONFIRMED' || isPending}
            orientation="horizontal"
          />
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {lineup.formationId
              ? 'Formation selected but no slots found.'
              : 'Select a formation to set up positions.'}
          </p>
        )}

        {eligiblePlayers.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1">
              Available players
            </p>
            <div className="flex flex-wrap gap-1">
              {eligiblePlayers
                .filter((p) => !assignedPlayerIds.has(p.id))
                .map((p) => (
                  <span
                    key={p.id}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px]",
                      p.source === 'helper'
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-zinc-300",
                    )}
                  >
                    {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}{p.isGK ? ' · GK' : ''}{p.primaryPosition ? ` · ${p.primaryPosition}` : ''}
                    {p.source === 'helper' && <span className="ml-1 text-amber-400">H</span>}
                  </span>
                ))}
              {eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id)).length === 0 && (
                <span className="text-xs text-[var(--text-muted)]">All players assigned</span>
              )}
            </div>
          </div>
        )}

        {pickerState && pickerSlot && (
          <PlayerPicker
            isOpen={!!pickerState}
            onClose={() => setPickerState(null)}
            players={eligiblePlayers.map((p) => ({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              primaryPosition: p.primaryPosition ?? 'FREE',
              coreTeamName: p.source === 'helper' ? `Helper${p.squadName ? ` from ${p.squadName}` : ''}` : undefined,
            }))}
            slot={pickerSlot}
            assignedPlayerIds={assignedPlayerIds}
            currentAssignedPlayer={currentAssignedPlayer ? {
              id: currentAssignedPlayer.id,
              firstName: currentAssignedPlayer.firstName,
              lastName: currentAssignedPlayer.lastName,
              primaryPosition: currentAssignedPlayer.primaryPosition ?? 'FREE',
            } : null}
            onSelect={handlePlayerSelect}
            onClear={handleRemovePlayer}
          />
        )}
      </div>
    </Surface>
  );
}