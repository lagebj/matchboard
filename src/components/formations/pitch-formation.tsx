"use client";

import { WIDTH_LANE_LABELS, DEPTH_LANE_LABELS, ROLE_TYPE_LABELS } from "@/lib/formations/types";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { TouchlineButton } from "@/components/touchline";
import { ROLE_COLORS } from "@/components/formations/tactics-board";

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

// `PitchFormationBuilder` (the `TacticsBoard` mode="formation-builder" wrapper that used to live
// here) was removed once its one production consumer, `formations-builder.tsx`, migrated to the
// canonical `TouchlinePlanningPitch` (Atlas Follow-up Phase F7,
// `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`) — it had zero remaining callers. `TacticsBoard`
// itself, and its "formation-preview" mode still exercised by the pre-Atlas-Follow-up
// `/dev/ui-lab/atlas/routes/formations` page, are left for Phase F10's broader "remove obsolete
// implementations" sweep once every planning-pitch surface has migrated.

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
          <TouchlineButton variant="danger" size="sm" onClick={() => { onRemove(slot.id); onClose(); }}>
            Remove
          </TouchlineButton>
          <div className="flex-1" />
          <TouchlineButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </TouchlineButton>
          <TouchlineButton variant="primary" size="sm" onClick={handleSave}>
            Save
          </TouchlineButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">Short label</label>
          <input
            type="text"
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
            maxLength={4}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">Role type</label>
          <select
            value={roleType}
            onChange={(e) => setRoleType(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-[var(--foreground)]"
          >
            {ROLE_TYPE_OPTIONS.map((rt) => (
              <option key={rt} value={rt}>{ROLE_TYPE_LABELS[rt]}</option>
            ))}
          </select>
          {/* ADR-0129 §4 (Touchline Design Atlas, ADR-0136 Phase 7,
              `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §A`): the exact role automatic
              lineup/rotation planning derives from roleType + lane. A FREE slot derives none —
              it is manual-only for automatic planning, shown verbatim. Free-form label strings
              are never parsed. Split into the golden's own four facts (role type is the select
              above; exact derived target role, lane, and the automatic-eligibility meaning
              follow) — previously collapsed into one sentence that omitted the eligibility-tier
              requirement entirely. */}
          {(() => {
            const exact = deriveExactTargetRole(roleType as FormationSlotRoleType, slot.gridX);
            if (!exact) {
              return (
                <p className="text-[var(--text-micro)] text-[var(--text-muted)]">Manual-only for automatic planning</p>
              );
            }
            return (
              <div className="flex flex-col gap-0.5 text-[var(--text-micro)] text-[var(--text-muted)]">
                <p>Exact derived target role: {exact}</p>
                <p>Lane: {WIDTH_LANE_LABELS[slot.gridX]}</p>
                <p>A player needs Natural, Strong, or Plausible fit for automatic assignment to this role.</p>
              </div>
            );
          })()}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">Accepted positions</label>
          <div className="flex flex-wrap gap-2">
            {POSITION_OPTIONS.map((pos) => (
              <button
                key={pos.value}
                type="button"
                onClick={() => togglePosition(pos.value)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  positions.includes(pos.value)
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--foreground)]"
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

// `PitchLineupView` (the `TacticsBoard` mode="lineup-assignment"/"lineup-readonly" wrapper that
// used to live here) was removed once its last production consumer,
// `event-match-lineup-panel.tsx`, migrated to the canonical `TouchlinePlanningPitch` (Atlas
// Follow-up Phase F7, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`) — it had zero remaining
// callers (`match-tactics-panel.tsx` migrated away from it in an earlier F7 slice). `TacticsBoard`
// itself is left for Phase F10's broader "remove obsolete implementations" sweep.

export { ROLE_COLORS };