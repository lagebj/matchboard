"use client";

import { cn } from "@/lib/cn";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";

type PlayerWithAvailability = {
  id: string;
  currentAvailability: string;
  nonRotatable: boolean;
  reducedMatchLoadAllowed: boolean;
};

type SelectOption = { label: string; value: string };

type PlayerAvailabilityPanelProps = {
  player: PlayerWithAvailability;
  availabilityOptions: ReadonlyArray<SelectOption>;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

export function PlayerAvailabilityPanel({ player, availabilityOptions, updateFieldAction }: PlayerAvailabilityPanelProps) {
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Availability" />
      <div className="mt-1.5 flex flex-col gap-1.5">
        <InlineEditSelect
          label="Status"
          value={player.currentAvailability}
          options={availabilityOptions}
          onSave={handleSave("currentAvailability")}
        />
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Rotation</span>
          <span className={cn(
            player.nonRotatable ? "text-[var(--warning)]" : "text-zinc-200",
          )}>
            {player.nonRotatable ? "Non-rotatable" : "Eligible"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Planning constraint</span>
          <span className="text-zinc-200">
            {player.reducedMatchLoadAllowed ? "Reduced match involvement" : "Standard"}
          </span>
        </div>
      </div>
    </TacticalSurface>
  );
}