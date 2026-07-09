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
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Availability" />

      <div className="mt-2 flex flex-col gap-2">
        <InlineEditSelect
          label="Status"
          value={player.currentAvailability}
          options={availabilityOptions}
          onSave={handleSave("currentAvailability")}
        />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Rotation</span>
          <span className={cn(
            "text-sm",
            player.nonRotatable ? "text-[var(--warning)]" : "text-zinc-100",
          )}>
            {player.nonRotatable ? "Non-rotatable" : "Eligible"}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Planning constraint</span>
          <span className="text-sm text-zinc-100">
            {player.reducedMatchLoadAllowed ? "Reduced match involvement" : "Standard"}
          </span>
        </div>
      </div>
    </TacticalSurface>
  );
}