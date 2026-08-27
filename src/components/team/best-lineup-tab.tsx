'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import {
  autoSelectBestLineupAction,
  setBestLineupFormationAction,
  assignPlayerToBestLineupSlotAction,
  clearBestLineupSlotAction,
  clearBestLineupAction,
} from '@/app/(app)/o/[orgSlug]/teams/[teamId]/best-lineup-actions/actions';
import type { BestLineupData, BestLineupSlot } from '@/lib/best-lineup/best-lineup';
import { formatGameFormatLabel } from '@/lib/formations/types';
import { RefreshCw, Trash2, X, Lock, Unlock } from 'lucide-react';

type FormationOption = {
  id: string;
  name: string;
  gameFormat: string;
  source: string;
  isArchived: boolean;
};

type BestLineupTabProps = {
  teamId: string;
  lineup: BestLineupData | null;
  formations: FormationOption[];
  players: Array<{ id: string; firstName: string; lastName: string | null; primaryPosition: string; secondaryPosition: string | null; tertiaryPosition: string | null; goalkeeperAbility: string }>;
};

function getPositionLabel(roleType: string): string {
  const labels: Record<string, string> = {
    GOALKEEPER: 'GK',
    DEFENDER: 'DEF',
    DEFENSIVE_MIDFIELDER: 'CDM',
    MIDFIELDER: 'MID',
    ATTACKING_MIDFIELDER: 'CAM',
    FORWARD: 'FWD',
    FREE: 'Flex',
  };
  return labels[roleType] ?? roleType;
}

function SlotRow({
  slot,
  players,
  onAssign,
  onClear,
  onToggleLock,
  isPending,
}: {
  slot: BestLineupSlot;
  players: Array<{ id: string; firstName: string; lastName: string | null; primaryPosition: string }>;
  onAssign: (playerId: string) => void;
  onClear: () => void;
  onToggleLock: () => void;
  isPending: boolean;
}) {
  const assignedName = slot.playerFirstName
    ? `${slot.playerFirstName}${slot.playerLastName ? ' ' + slot.playerLastName : ''}`
    : null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-[var(--border-soft)] last:border-b-0">
      <div className="w-16 shrink-0">
        <StatusPill
          variant={slot.playerId ? 'success' : 'neutral'}
        >
          {getPositionLabel(slot.roleType)}
        </StatusPill>
      </div>
      <div className="w-20 shrink-0 text-xs text-[var(--text-muted)]">{slot.label}</div>
      <div className="flex-1 min-w-0">
        {assignedName ? (
          <span className="text-sm font-medium text-zinc-200">{assignedName}</span>
        ) : (
          <select
            className="text-sm bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-2 py-1 text-zinc-300 max-w-full"
            onChange={(e) => {
              if (e.target.value) onAssign(e.target.value);
            }}
            disabled={isPending}
            value=""
          >
            <option value="">— Assign player —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName}{p.lastName ? ' ' + p.lastName : ''} ({p.primaryPosition})
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1">
        {assignedName && (
          <>
            <button
              onClick={onToggleLock}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-zinc-200"
              title={slot.locked ? 'Unlock position' : 'Lock position'}
              disabled={isPending}
            >
              {slot.locked ? <Lock className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClear}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-zinc-200"
              title="Remove player"
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function BestLineupTab({ teamId, lineup, formations, players }: BestLineupTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFormationId, setSelectedFormationId] = useState<string>(lineup?.formationId ?? '');

  const handleAutoSelect = () => {
    startTransition(async () => {
      const formationId = selectedFormationId || undefined;
      await autoSelectBestLineupAction(teamId, formationId);
      router.refresh();
    });
  };

  const handleFormationChange = () => {
    if (!selectedFormationId) return;
    startTransition(async () => {
      await setBestLineupFormationAction(teamId, selectedFormationId);
      router.refresh();
    });
  };

  const handleClear = () => {
    if (!confirm('Clear the recommended lineup? Formation and assignments will be removed.')) return;
    startTransition(async () => {
      await clearBestLineupAction(teamId);
      router.refresh();
    });
  };

  const handleAssign = (lineupId: string, slotId: string, playerId: string) => {
    startTransition(async () => {
      await assignPlayerToBestLineupSlotAction(lineupId, slotId, playerId);
      router.refresh();
    });
  };

  const handleClearSlot = (lineupId: string, slotId: string) => {
    startTransition(async () => {
      await clearBestLineupSlotAction(lineupId, slotId);
      router.refresh();
    });
  };

  const handleToggleLock = (lineupId: string, slotId: string, currentLocked: boolean) => {
    startTransition(async () => {
      await assignPlayerToBestLineupSlotAction(lineupId, slotId, null, !currentLocked);
      router.refresh();
    });
  };

  const assignedPlayerIds = new Set(lineup?.slots?.filter((s) => s.playerId).map((s) => s.playerId!) ?? []);
  const availablePlayers = players.filter((p) => !assignedPlayerIds.has(p.id));

  if (!lineup || !lineup.formationId) {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader title="Recommended lineup" description="Configure the team's default lineup for match planning." />
        <Surface variant="default" padding="md">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Formation
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="text-sm bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-3 py-2 text-zinc-300"
                  value={selectedFormationId}
                  onChange={(e) => setSelectedFormationId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">Select formation</option>
                  {formations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatGameFormatLabel(f.gameFormat)})
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFormationChange}
                  disabled={!selectedFormationId || isPending}
                >
                  Set formation
                </Button>
              </div>
            </div>
            {formations.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                No formations available. Create a formation for this team first.
              </p>
            )}
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Recommended lineup"
        description={`Formation: ${lineup.formationName ?? 'Unknown'}`}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleAutoSelect} disabled={isPending}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Auto-select recommended lineup
        </Button>
        <select
          className="text-sm bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-3 py-1.5 text-zinc-300"
          value={selectedFormationId}
          onChange={(e) => {
            setSelectedFormationId(e.target.value);
          }}
          disabled={isPending}
        >
          <option value="">Change formation</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.gameFormat.replace('_', ' ').toLowerCase()})
            </option>
          ))}
        </select>
        {selectedFormationId && selectedFormationId !== lineup.formationId && (
          <Button variant="ghost" size="sm" onClick={handleFormationChange} disabled={isPending}>
            Apply formation
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending}>
          <Trash2 className="mr-1 h-4 w-4" />
          Clear lineup
        </Button>
      </div>

      <Surface variant="default" padding="none">
        <div className="divide-y divide-[var(--border-soft)]">
          {lineup.slots.map((slot) => (
            <SlotRow
              key={slot.slotId}
              slot={slot}
              players={availablePlayers}
              onAssign={(playerId) => {
                if (lineup.lineupId) handleAssign(lineup.lineupId, slot.slotId, playerId);
              }}
              onClear={() => {
                if (lineup.lineupId) handleClearSlot(lineup.lineupId, slot.slotId);
              }}
              onToggleLock={() => {
                if (lineup.lineupId) handleToggleLock(lineup.lineupId, slot.slotId, slot.locked);
              }}
              isPending={isPending}
            />
          ))}
          {lineup.slots.length === 0 && (
            <p className="py-4 px-3 text-sm text-[var(--text-muted)]">
              No formation slots configured. Select a formation and auto-select to generate a lineup.
            </p>
          )}
        </div>
      </Surface>
    </div>
  );
}