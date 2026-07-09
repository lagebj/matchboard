"use client";

import { WIDTH_LANE_LABELS, DEPTH_LANE_LABELS, ROLE_TYPE_LABELS, formatGameFormatShort } from "@/lib/formations/types";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TacticsBoard,
  ROLE_COLORS,
  type TacticsBoardSlot,
  type TacticsBoardAssignment,
  type TacticsBoardPlayer,
} from "@/components/formations/tactics-board";

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
  orientation?: "horizontal" | "vertical";
  attackingDirection?: "left-to-right" | "right-to-left";
};

export function PitchFormationBuilder({
  gameFormat,
  slots,
  onAddSlot,
  onEditSlot,
  onRemoveSlot: _onRemoveSlot,
  maxSlots,
  readOnly = false,
  orientation = "vertical",
  attackingDirection = "left-to-right",
}: PitchFormationBuilderProps) {
  const canAddMore = slots.length < maxSlots;

  const boardSlots: TacticsBoardSlot[] = slots.map((s) => ({
    id: s.id,
    gridX: s.gridX,
    gridY: s.gridY,
    label: s.label,
    shortLabel: s.shortLabel,
    roleType: s.roleType,
    acceptedPositionIds: s.acceptedPositionIds,
    sortOrder: s.sortOrder,
  }));

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

      <TacticsBoard
        mode="formation-builder"
        orientation={orientation}
        attackingDirection={attackingDirection}
        size="wide"
        slots={boardSlots}
        canAddMore={canAddMore}
        readOnly={readOnly}
        onAddSlot={onAddSlot}
        onEditSlot={onEditSlot}
      />
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
  orientation?: "horizontal" | "vertical";
  attackingDirection?: "left-to-right" | "right-to-left";
};

export function PitchLineupView({
  gameFormat: _gameFormat,
  slots,
  assignments,
  players,
  onSlotClick,
  readOnly = false,
  orientation = "vertical",
  attackingDirection = "left-to-right",
}: PitchLineupViewProps) {
  const boardSlots: TacticsBoardSlot[] = slots.map((s) => ({
    id: s.id,
    gridX: s.gridX,
    gridY: s.gridY,
    label: s.label,
    shortLabel: s.shortLabel,
    roleType: s.roleType,
    acceptedPositionIds: s.acceptedPositionIds,
    sortOrder: s.sortOrder,
  }));

  const boardAssignments: TacticsBoardAssignment[] = assignments.map((a) => ({
    id: a.id,
    slotId: a.slotId,
    playerId: a.playerId,
    locked: a.locked,
    source: a.source,
  }));

  const boardPlayers: TacticsBoardPlayer[] = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    primaryPosition: p.primaryPosition,
  }));

  return (
    <TacticsBoard
      mode={readOnly ? "lineup-readonly" : "lineup-assignment"}
      orientation={orientation}
      attackingDirection={attackingDirection}
      size="standard"
      slots={boardSlots}
      assignments={boardAssignments}
      players={boardPlayers}
      onSlotClick={onSlotClick}
      readOnly={readOnly}
    />
  );
}

export { ROLE_COLORS };