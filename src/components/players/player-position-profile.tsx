"use client";

import { PositionMap } from "@/components/ui/position-map";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { TacticalSurface } from "@/components/ui/tactical-surface";

type PlayerWithPositions = {
  id: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type SelectOption = { label: string; value: string };

type PlayerPositionProfileProps = {
  player: PlayerWithPositions;
  positionOptions: ReadonlyArray<SelectOption>;
  optionalPositionOptions: ReadonlyArray<SelectOption>;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

export function PlayerPositionProfile({ player, positionOptions, optionalPositionOptions, updateFieldAction }: PlayerPositionProfileProps) {
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  return (
    <TacticalSurface variant="default" padding="sm">
      <PositionMap
        primaryPosition={player.primaryPosition}
        secondaryPositions={[player.secondaryPosition, player.tertiaryPosition].filter(Boolean) as string[]}
        size="md"
      />
      <div className="mt-2 text-center">
        <InlineEditSelect
          label="Position"
          value={player.primaryPosition}
          options={positionOptions}
          onSave={handleSave("primaryPosition")}
        />
        <div className="mt-1 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <InlineEditSelect
            label="2nd"
            value={player.secondaryPosition ?? ""}
            options={optionalPositionOptions}
            onSave={handleSave("secondaryPosition")}
          />
          <InlineEditSelect
            label="3rd"
            value={player.tertiaryPosition ?? ""}
            options={optionalPositionOptions}
            onSave={handleSave("tertiaryPosition")}
          />
        </div>
      </div>
    </TacticalSurface>
  );
}