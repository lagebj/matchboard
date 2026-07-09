"use client";

import { InlineEditField } from "@/components/ui/inline-edit-field";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";

type PlayerWithContext = {
  id: string;
  notes: string | null;
  supportInstruction: string | null;
  developmentInstruction: string | null;
};

type CoachContextPanelProps = {
  player: PlayerWithContext;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

export function CoachContextPanel({ player, updateFieldAction }: CoachContextPanelProps) {
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Coach context" />
      <div className="mt-1.5 flex flex-col gap-2">
        <InlineEditField
          label="Notes"
          value={player.notes ?? ""}
          onSave={handleSave("notes")}
        />
        <InlineEditField
          label="Support instruction"
          value={player.supportInstruction ?? ""}
          onSave={handleSave("supportInstruction")}
        />
        <InlineEditField
          label="Development instruction"
          value={player.developmentInstruction ?? ""}
          onSave={handleSave("developmentInstruction")}
        />
      </div>
    </TacticalSurface>
  );
}