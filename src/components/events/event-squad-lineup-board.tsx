'use client';

import { cn } from '@/lib/cn';
import type { FormationSlotRoleType, BroadPosition } from '@/lib/formations/types';
import type { LineupAssignment } from '@/lib/events/event-lineup-assignment';
import { FIT_TIER_LABELS } from '@/lib/events/event-types';
import {
  TacticsBoard,
  type TacticsBoardSlot,
  type TacticsBoardAssignment,
  type TacticsBoardPlayer,
} from '@/components/formations/tactics-board';

function formatName(p: { firstName: string; lastName: string | null }): string {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

type EventSquadLineupBoardProps = {
  assignment: LineupAssignment;
  gameFormat: string;
  orientation?: "horizontal" | "vertical";
  attackingDirection?: "left-to-right" | "right-to-left";
};

export function EventSquadLineupBoard({
  assignment,
  gameFormat: _gameFormat,
  orientation = "horizontal",
  attackingDirection = "left-to-right",
}: EventSquadLineupBoardProps) {
  const { slots, unassignedPlayers, formationName } = assignment;

  const slotsWithGrid = slots.filter((s) => s.gridX !== undefined && s.gridY !== undefined);
  const slotsWithoutGrid = slots.filter((s) => s.gridX === undefined || s.gridY === undefined);

  const boardSlots: TacticsBoardSlot[] = slotsWithGrid.map((s) => ({
    id: `slot-${s.slotIndex}`,
    gridX: s.gridX!,
    gridY: s.gridY!,
    label: s.label ?? s.roleType,
    shortLabel: s.label?.substring(0, 4) ?? s.roleType.substring(0, 3),
    roleType: (s.roleType as FormationSlotRoleType) || "FREE",
    acceptedPositionIds: s.acceptedPositions as unknown as BroadPosition[],
    sortOrder: s.slotIndex,
  }));

  const boardAssignments: TacticsBoardAssignment[] = slotsWithGrid.map((s) => ({
    id: `assignment-${s.slotIndex}`,
    slotId: `slot-${s.slotIndex}`,
    playerId: s.player?.playerId ?? null,
    locked: s.player?.locked ?? false,
    source: s.player?.selectionReason ?? "",
  }));

  const boardPlayers: TacticsBoardPlayer[] = slotsWithGrid
    .filter((s) => s.player)
    .map((s) => ({
      id: s.player!.playerId,
      firstName: s.player!.firstName,
      lastName: s.player!.lastName,
      primaryPosition: s.player!.primaryPosition ?? "",
    }));

  return (
    <div className="space-y-3">
      {formationName && (
        <div className="text-xs text-[var(--text-muted)]">
          Formation: {formationName}
        </div>
      )}

      {boardSlots.length > 0 && (
        <TacticsBoard
          mode="selection-preview"
          orientation={orientation}
          attackingDirection={attackingDirection}
          size="standard"
          slots={boardSlots}
          assignments={boardAssignments}
          players={boardPlayers}
        />
      )}

      {slotsWithoutGrid.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Lineup
          </div>
          <div className="flex flex-wrap gap-1">
            {slotsWithoutGrid.map((slot) => (
              <div
                key={slot.slotIndex}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
                  slot.player
                    ? 'border-[var(--border-soft)] bg-[var(--surface-muted)] text-zinc-200'
                    : 'border-dashed border-[var(--border-soft)] bg-transparent text-[var(--text-muted)]',
                )}
                title={slot.player?.selectionReason ?? undefined}
              >
                <span className="font-medium">{slot.label}</span>
                {slot.player ? (
                  <>
                    <span>{formatName(slot.player)}</span>
                    {slot.player.positionFitTier && FIT_TIER_LABELS[slot.player.positionFitTier] && (
                      <span className="text-[10px] text-[var(--text-muted)]">({FIT_TIER_LABELS[slot.player.positionFitTier]})</span>
                    )}
                  </>
                ) : (
                  <span className="opacity-50">Empty</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {unassignedPlayers.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Unassigned
          </div>
          <div className="flex flex-wrap gap-1">
            {unassignedPlayers.map((p) => (
              <div
                key={p.playerId}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-zinc-200"
              >
                <span>{formatName(p)}</span>
                {p.positionFitTier && FIT_TIER_LABELS[p.positionFitTier] && (
                  <span className="text-[10px] text-[var(--text-muted)]">({FIT_TIER_LABELS[p.positionFitTier]})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}