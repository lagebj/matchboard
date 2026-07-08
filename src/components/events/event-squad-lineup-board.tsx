'use client';

import { cn } from '@/lib/cn';
import { ROLE_TYPE_LABELS, getGridPositionPercent, formatGameFormatShort } from '@/lib/formations/types';
import type { FormationSlotRoleType } from '@/lib/formations/types';
import type { LineupAssignment } from '@/lib/events/event-lineup-assignment';
import { FIT_TIER_LABELS } from '@/lib/events/event-types';

const ROLE_COLORS: Record<string, string> = {
  GOALKEEPER: 'bg-amber-500/80 text-amber-950 border-amber-400',
  DEFENDER: 'bg-sky-500/80 text-sky-950 border-sky-400',
  DEFENSIVE_MIDFIELDER: 'bg-teal-500/80 text-teal-950 border-teal-400',
  MIDFIELDER: 'bg-emerald-500/80 text-emerald-950 border-emerald-400',
  ATTACKING_MIDFIELDER: 'bg-orange-500/80 text-orange-950 border-orange-400',
  FORWARD: 'bg-red-500/80 text-red-950 border-red-400',
  FREE: 'bg-zinc-500/80 text-zinc-950 border-zinc-400',
};

function formatName(p: { firstName: string; lastName: string | null }): string {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

type EventSquadLineupBoardProps = {
  assignment: LineupAssignment;
  gameFormat: string;
};

export function EventSquadLineupBoard({ assignment, gameFormat }: EventSquadLineupBoardProps) {
  const { slots, unassignedPlayers, formationName } = assignment;

  const slotsWithGrid = slots.filter((s) => s.gridX !== undefined && s.gridY !== undefined);
  const slotsWithoutGrid = slots.filter((s) => s.gridX === undefined || s.gridY === undefined);

  return (
    <div className="space-y-3">
      {formationName && (
        <div className="text-xs text-[var(--text-muted)]">
          Formation: {formationName}
        </div>
      )}

      {slotsWithGrid.length > 0 && (
        <div className="pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]">
          <div className="pitch-surface relative w-full aspect-[5/7] bg-[var(--surface-tactical)]">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="99" height="99" rx="1" fill="none" stroke="var(--border-soft)" strokeWidth="0.5" />
              <line x1="0.5" y1="50" x2="99.5" y2="50" stroke="var(--border-soft)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="12" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
              <rect x="25" y="76" width="50" height="23.5" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" rx="0.3" />
            </svg>

            {slotsWithGrid.map((slot) => {
              const xPct = slot.gridX !== undefined ? getGridPositionPercent(slot.gridX, 0).x : 50;
              const yPct = slot.gridY !== undefined ? getGridPositionPercent(0, slot.gridY).y : 50;
              const roleColor = ROLE_COLORS[slot.roleType] ?? ROLE_COLORS.FREE;

              return (
                <div
                  key={slot.slotIndex}
                  className={cn(
                    'absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold min-w-[3rem] max-w-[5rem] cursor-default',
                    slot.player ? roleColor : 'border-dashed border-[var(--border-soft)] bg-[var(--surface-base)]/50 text-[var(--text-muted)]',
                  )}
                  style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}
                  title={slot.player?.selectionReason ?? undefined}
                >
                  <span className="text-[10px] leading-tight font-bold">{slot.label}</span>
                  {slot.player ? (
                    <span className="text-[9px] leading-none truncate max-w-full">
                      {formatName(slot.player)}
                      {slot.player.positionFitTier && FIT_TIER_LABELS[slot.player.positionFitTier] && (
                        <span className="ml-0.5 opacity-70">({FIT_TIER_LABELS[slot.player.positionFitTier]})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[8px] leading-none opacity-50">Empty</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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