"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PitchFormationBuilder, SlotEditDialog } from "@/components/formations/pitch-formation";
import { GAME_FORMAT_PLAYERS, formatGameFormatShort, isValidGridX, isValidGridY } from "@/lib/formations/types";
import { suggestSlotDefaults } from "@/lib/formations/slot-defaults";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotData, FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { PageHeader } from "@/components/ui/page-header";

const GAME_FORMATS: GameFormat[] = ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];

type FormationsBuilderClientProps = {
  gameFormat?: string;
  formationId?: string;
  returnTo?: string;
  initialData?: {
    name: string;
    gameFormat: GameFormat;
    slots: FormationSlotData[];
  };
};

export function FormationsBuilderClient({
  gameFormat,
  formationId,
  returnTo,
  initialData,
}: FormationsBuilderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const resolvedGameFormat = (initialData?.gameFormat ?? gameFormat ?? "SEVEN_A_SIDE") as GameFormat;
  const isEditing = !!formationId;

  const [name, setName] = useState(initialData?.name ?? "");
  const [selectedGameFormat, setSelectedGameFormat] = useState<GameFormat>(resolvedGameFormat);
  const [slots, setSlots] = useState<FormationSlotData[]>(initialData?.slots ?? []);
  const [editingSlot, setEditingSlot] = useState<FormationSlotData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxSlots = GAME_FORMAT_PLAYERS[selectedGameFormat];

  const handleAddSlot = useCallback((gridX: number, gridY: number) => {
    if (!isValidGridX(gridX) || !isValidGridY(gridY)) return;

    const existing = slots.find((s) => s.gridX === gridX && s.gridY === gridY);
    if (existing) {
      setEditingSlot(existing);
      return;
    }

    if (slots.length >= maxSlots) return;

    const defaults = suggestSlotDefaults(gridX, gridY, selectedGameFormat);
    const maxSortOrder = slots.reduce((max, s) => Math.max(max, s.sortOrder), -1);

    const newSlot: FormationSlotData = {
      gridX,
      gridY,
      label: defaults.label,
      shortLabel: defaults.shortLabel,
      roleType: defaults.roleType,
      acceptedPositionIds: defaults.acceptedPositionIds,
      sortOrder: maxSortOrder + 1,
    };

    if (formationId) {
      startTransition(async () => {
        try {
          const { addFormationSlot } = await import("@/app/(app)/rules/formation-actions");
          const created = await addFormationSlot(formationId, gridX, gridY);
          setSlots((prev) => [
            ...prev,
            {
              id: created.id,
              gridX: created.gridX,
              gridY: created.gridY,
              label: created.label,
              shortLabel: created.shortLabel,
              roleType: created.roleType as FormationSlotRoleType,
              acceptedPositionIds: created.acceptedPositionIds as BroadPosition[],
              sortOrder: created.sortOrder,
            },
          ]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to add slot");
        }
      });
    } else {
      setSlots((prev) => [...prev, newSlot]);
    }
  }, [slots, maxSlots, selectedGameFormat, formationId]);

  const handleEditSlot = useCallback((slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) setEditingSlot(slot);
  }, [slots]);

  const handleSaveSlotEdit = useCallback((slotId: string, data: { label: string; shortLabel: string; roleType: string; acceptedPositionIds: string[] }) => {
    if (formationId) {
      startTransition(async () => {
        try {
          const { updateFormationSlot } = await import("@/app/(app)/rules/formation-actions");
          await updateFormationSlot(slotId, data);
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slotId
                ? { ...s, label: data.label, shortLabel: data.shortLabel, roleType: data.roleType as FormationSlotRoleType, acceptedPositionIds: data.acceptedPositionIds as BroadPosition[] }
                : s
            )
          );
          setEditingSlot(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to update slot");
        }
      });
    } else {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, label: data.label, shortLabel: data.shortLabel, roleType: data.roleType as FormationSlotRoleType, acceptedPositionIds: data.acceptedPositionIds as BroadPosition[] }
            : s
        )
      );
      setEditingSlot(null);
    }
  }, [formationId]);

  const handleRemoveSlot = useCallback((slotId: string) => {
    if (formationId) {
      startTransition(async () => {
        try {
          const { removeFormationSlot } = await import("@/app/(app)/rules/formation-actions");
          await removeFormationSlot(slotId);
          setSlots((prev) => prev.filter((s) => s.id !== slotId));
          setEditingSlot(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to remove slot");
        }
      });
    } else {
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      setEditingSlot(null);
    }
  }, [formationId]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError("Formation name is required");
      return;
    }

    if (slots.length === 0) {
      setError("Formation must have at least one slot");
      return;
    }

    startTransition(async () => {
      try {
        const slotsPayload = slots.map((s) => ({
          gridX: s.gridX,
          gridY: s.gridY,
          label: s.label,
          shortLabel: s.shortLabel,
          roleType: s.roleType,
          acceptedPositionIds: s.acceptedPositionIds,
          sortOrder: s.sortOrder,
        }));

        if (isEditing && formationId) {
          const { updateCustomFormation } = await import("@/app/(app)/rules/formation-actions");
          await updateCustomFormation(formationId, {
            name: name.trim(),
            slots: slotsPayload,
          });
        } else {
          const { createCustomFormation } = await import("@/app/(app)/rules/formation-actions");
          await createCustomFormation({
            name: name.trim(),
            gameFormat: selectedGameFormat,
            slots: slotsPayload,
          });
        }

        if (returnTo) {
          router.push(returnTo);
        } else {
          router.push("/formations");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save formation");
      }
    });
  }, [name, slots, isEditing, formationId, selectedGameFormat, returnTo, router]);

  const displaySlots = slots.map((s, i) => ({
    id: s.id ?? `new-${i}`,
    gridX: s.gridX,
    gridY: s.gridY,
    label: s.label,
    shortLabel: s.shortLabel,
    roleType: s.roleType,
    acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
    sortOrder: s.sortOrder,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={isEditing ? "Edit formation" : "Create formation"}
        actions={
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-red-800/30 bg-red-900/15 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <Surface variant="default" padding="md">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]" htmlFor="formation-name">
              Formation name
            </label>
            <input
              id="formation-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="e.g. 2-3-1"
              className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {!isEditing && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]" htmlFor="formation-format">
                Game format
              </label>
              <select
                id="formation-format"
                value={selectedGameFormat}
                onChange={(e) => {
                  setSelectedGameFormat(e.target.value as GameFormat);
                  setSlots([]);
                  setError(null);
                }}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-1.5 text-sm text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
              >
                {GAME_FORMATS.map((gf) => (
                  <option key={gf} value={gf}>{formatGameFormatShort(gf)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Surface>

      <Surface variant="default" padding="md">
        <PitchFormationBuilder
          gameFormat={selectedGameFormat}
          slots={displaySlots}
          onAddSlot={handleAddSlot}
          onEditSlot={handleEditSlot}
          onRemoveSlot={handleRemoveSlot}
          maxSlots={maxSlots}
          orientation="horizontal"
        />
      </Surface>

      {editingSlot && editingSlot.id && (
        <SlotEditDialog
          isOpen={true}
          onClose={() => setEditingSlot(null)}
          slot={{
            id: editingSlot.id,
            gridX: editingSlot.gridX,
            gridY: editingSlot.gridY,
            label: editingSlot.label,
            shortLabel: editingSlot.shortLabel,
            roleType: editingSlot.roleType,
            acceptedPositionIds: editingSlot.acceptedPositionIds as BroadPosition[],
            sortOrder: editingSlot.sortOrder,
          }}
          gameFormat={selectedGameFormat}
          onSave={handleSaveSlotEdit}
          onRemove={handleRemoveSlot}
        />
      )}
    </div>
  );
}