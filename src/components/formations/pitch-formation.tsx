"use client";

import { WIDTH_LANE_LABELS, DEPTH_LANE_LABELS, GRID_WIDTH, GRID_HEIGHT, ROLE_TYPE_LABELS, formatGameFormatShort, getGridPositionPercent } from "@/lib/formations/types";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FormationSlotDisplay = {
  id: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: FormationSlotRoleType;
  acceptedPositionIds: BroadPosition[];
  sortOrder: number;
};

type PitchFormationBuilderProps = {
  gameFormat: string;
  slots: FormationSlotDisplay[];
  onAddSlot: (gridX: number, gridY: number) => void;
  onEditSlot: (slotId: string) => void;
  onRemoveSlot: (slotId: string) => void;
  maxSlots: number;
  readOnly?: boolean;
};

const ROLE_COLORS: Record<FormationSlotRoleType, string> = {
  GOALKEEPER: "bg-amber-500/80 text-amber-950 border-amber-400",
  DEFENDER: "bg-sky-500/80 text-sky-950 border-sky-400",
  DEFENSIVE_MIDFIELDER: "bg-teal-500/80 text-teal-950 border-teal-400",
  MIDFIELDER: "bg-emerald-500/80 text-emerald-950 border-emerald-400",
  ATTACKING_MIDFIELDER: "bg-orange-500/80 text-orange-950 border-orange-400",
  FORWARD: "bg-red-500/80 text-red-950 border-red-400",
  FREE: "bg-zinc-500/80 text-zinc-950 border-zinc-400",
};

export function PitchFormationBuilder({
  gameFormat,
  slots,
  onAddSlot,
  onEditSlot,
  onRemoveSlot: _onRemoveSlot,
  maxSlots,
  readOnly = false,
}: PitchFormationBuilderProps) {
  const slotMap = new Map<string, FormationSlotDisplay>();
  for (const slot of slots) {
    slotMap.set(`${slot.gridX},${slot.gridY}`, slot);
  }

  const canAddMore = slots.length < maxSlots;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-muted)]">
          {slots.length} / {maxSlots} slots
        </span>
        <span className="text-[var(--text-muted)]">
          {formatGameFormatShort(gameFormat)}
        </span>
      </div>

      <div className="pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]">
        <div className="pitch-surface relative w-full aspect-[5/7] bg-[var(--surface-tactical)]">
          {/* Pitch markings */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
            <rect x="2" y="2" width="96" height="96" rx="1" fill="none" stroke="var(--border-soft)" strokeWidth="0.4" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="var(--border-soft)" strokeWidth="0.3" />
            <circle cx="50" cy="50" r="10" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
            <rect x="25" y="82" width="50" height="16" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" rx="0.3" />
            <rect x="35" y="91" width="30" height="7" fill="none" stroke="var(--border-soft)" strokeWidth="0.2" rx="0.2" />
          </svg>

          {/* Grid points and slots */}
          {Array.from({ length: GRID_HEIGHT }, (_, y) =>
            Array.from({ length: GRID_WIDTH }, (_, x) => {
              const key = `${x},${y}`;
              const slot = slotMap.get(key);
              const { x: xPct, y: yPct } = getGridPositionPercent(x, y);

              if (slot) {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => !readOnly && onEditSlot(slot.id)}
                    className={cn(
                      "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 min-w-[3rem]",
                      ROLE_COLORS[slot.roleType],
                      readOnly && "cursor-default hover:scale-100",
                    )}
                    style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                    aria-label={`${slot.shortLabel}: ${slot.label} (${ROLE_TYPE_LABELS[slot.roleType]})`}
                  >
                    <span className="text-[10px] leading-tight font-bold">{slot.shortLabel}</span>
                    <span className="text-[8px] leading-none opacity-70">{ROLE_TYPE_LABELS[slot.roleType].split(" ")[0]}</span>
                  </button>
                );
              }

              if (readOnly) return null;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => canAddMore ? onAddSlot(x, y) : undefined}
                  disabled={!canAddMore}
                  className={cn(
                    "absolute z-5 flex items-center justify-center rounded-full border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-base)]/50 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 w-8 h-8",
                    !canAddMore && "opacity-30 cursor-not-allowed",
                  )}
                  style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                  aria-label={`Add slot at ${WIDTH_LANE_LABELS[x]}, ${DEPTH_LANE_LABELS[y]}`}
                >
                  <span className="text-lg leading-none">+</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

type SlotEditDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  slot: FormationSlotDisplay;
  gameFormat: string;
  onSave: (slotId: string, data: { label: string; shortLabel: string; roleType: string; acceptedPositionIds: string[] }) => void;
  onRemove: (slotId: string) => void;
};

const ROLE_TYPE_OPTIONS: FormationSlotRoleType[] = ["GOALKEEPER", "DEFENDER", "DEFENSIVE_MIDFIELDER", "MIDFIELDER", "ATTACKING_MIDFIELDER", "FORWARD", "FREE"];

const POSITION_OPTIONS: { value: BroadPosition; label: string }[] = [
  { value: "goalkeeper", label: "Goalkeeper" },
  { value: "defender", label: "Defender" },
  { value: "midfielder", label: "Midfielder" },
  { value: "forward", label: "Forward" },
  { value: "flexible", label: "Flexible" },
];

export function SlotEditDialog({ isOpen, onClose, slot, gameFormat: _gameFormat, onSave, onRemove }: SlotEditDialogProps) {
  const [label, setLabel] = useState(slot.label);
  const [shortLabel, setShortLabel] = useState(slot.shortLabel);
  const [roleType, setRoleType] = useState<string>(slot.roleType);
  const [positions, setPositions] = useState<string[]>(slot.acceptedPositionIds);

  const handleSave = () => {
    onSave(slot.id, { label, shortLabel, roleType, acceptedPositionIds: positions });
    onClose();
  };

  const togglePosition = (pos: string) => {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${slot.shortLabel}`}
      description={`${WIDTH_LANE_LABELS[slot.gridX]}, ${DEPTH_LANE_LABELS[slot.gridY]}`}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="danger" size="sm" onClick={() => { onRemove(slot.id); onClose(); }}>
            Remove
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Short label</label>
          <input
            type="text"
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
            maxLength={4}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Role type</label>
          <select
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100"
          >
            {ROLE_TYPE_OPTIONS.map((rt) => (
              <option key={rt} value={rt}>{ROLE_TYPE_LABELS[rt]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Accepted positions</label>
          <div className="flex flex-wrap gap-2">
            {POSITION_OPTIONS.map((pos) => (
              <button
                key={pos.value}
                type="button"
                onClick={() => togglePosition(pos.value)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  positions.includes(pos.value)
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-zinc-100"
                    : "border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                )}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

type PitchLineupViewProps = {
  gameFormat: string;
  slots: FormationSlotDisplay[];
  assignments: { id: string; slotId: string; playerId: string | null; locked: boolean; source: string }[];
  players: { id: string; firstName: string; lastName: string | null; primaryPosition: string }[];
  onSlotClick?: (assignmentId: string | null, slotId: string, playerId: string | null) => void;
  readOnly?: boolean;
};

export function PitchLineupView({
  gameFormat: _gameFormat,
  slots,
  assignments,
  players,
  onSlotClick,
  readOnly = false,
}: PitchLineupViewProps) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));

  return (
    <div className="pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]">
      <div className="pitch-surface relative w-full aspect-[5/7] bg-[var(--surface-tactical)]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="2" y="2" width="96" height="96" rx="1" fill="none" stroke="var(--border-soft)" strokeWidth="0.4" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="var(--border-soft)" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="10" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
          <rect x="25" y="82" width="50" height="16" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" rx="0.3" />
          <rect x="35" y="91" width="30" height="7" fill="none" stroke="var(--border-soft)" strokeWidth="0.2" rx="0.2" />
        </svg>

      {slots.map((slot) => {
        const assignment = assignmentMap.get(slot.id);
        const player = assignment?.playerId ? playerMap.get(assignment.playerId) : null;
        const { x: xPct, y: yPct } = getGridPositionPercent(slot.gridX, slot.gridY);

        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => {
              if (!readOnly && onSlotClick) {
                onSlotClick(assignment?.id ?? null, slot.id, assignment?.playerId ?? null);
              }
            }}
            className={cn(
              "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold transition-transform min-w-[3.5rem]",
              player
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-zinc-100 hover:scale-105 cursor-pointer"
                : cn("border-2 cursor-pointer hover:scale-105", ROLE_COLORS[slot.roleType], "opacity-60 hover:opacity-80"),
              assignment?.locked && "ring-1 ring-[var(--accent)]",
              readOnly && "cursor-default hover:scale-100",
            )}
            style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
            aria-label={player ? `${player.firstName} ${player.lastName ?? ""} - ${slot.shortLabel}` : `${slot.shortLabel}: ${slot.label} (tap to assign)`}
          >
            {player ? (
              <>
                <span className="text-[10px] leading-tight font-bold truncate max-w-full">
                  {player.firstName}{player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}
                </span>
                <span className="text-[8px] leading-none opacity-70">{slot.shortLabel}</span>
              </>
            ) : (
              <>
                <span className="text-[10px] leading-tight font-bold">{slot.shortLabel}</span>
                <span className="text-[8px] leading-none opacity-70">{ROLE_TYPE_LABELS[slot.roleType].split(" ")[0]}</span>
              </>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}