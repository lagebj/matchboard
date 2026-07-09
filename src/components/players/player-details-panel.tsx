"use client";

import { InlineEditField } from "@/components/ui/inline-edit-field";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";

type PlayerWithDetails = {
  id: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  coreTeamId: string | null;
  goalkeeperAbility: string;
  preferredFoot: string | null;
  secondaryFoot: string | null;
  bestSide: string | null;
  coreTeam: { id: string; name: string } | null;
};

type SelectOption = { label: string; value: string };

type PlayerDetailsPanelProps = {
  player: PlayerWithDetails;
  teams: Array<{ id: string; name: string }>;
  footOptions: ReadonlyArray<SelectOption>;
  secondaryFootOptions: ReadonlyArray<SelectOption>;
  bestSideOptions: ReadonlyArray<SelectOption>;
  goalkeeperAbilityOptions: ReadonlyArray<SelectOption>;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

export function PlayerDetailsPanel({ player, teams, footOptions, secondaryFootOptions: secFootOptions, bestSideOptions, goalkeeperAbilityOptions, updateFieldAction }: PlayerDetailsPanelProps) {
  const teamOptions = teams.map((t) => ({ label: t.name, value: t.id }));
  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Details" />
      <div className="mt-2 flex flex-col gap-2">
        <InlineEditField
          label="First name"
          value={player.firstName}
          onSave={handleSave("firstName")}
        />
        <InlineEditField
          label="Last name"
          value={player.lastName ?? ""}
          onSave={handleSave("lastName")}
        />
        <InlineEditField
          label="Shirt number"
          value={player.shirtNumber != null ? String(player.shirtNumber) : ""}
          onSave={handleSave("shirtNumber")}
        />
        <InlineEditSelect
          label="Team"
          value={player.coreTeamId}
          options={teamOptions}
          onSave={handleSave("coreTeamId")}
        />
        <InlineEditSelect
          label="Goalkeeper"
          value={player.goalkeeperAbility}
          options={goalkeeperAbilityOptions}
          onSave={handleSave("goalkeeperAbility")}
        />
        <InlineEditSelect
          label="Foot"
          value={player.preferredFoot}
          options={footOptions}
          onSave={handleSave("preferredFoot")}
        />
        <InlineEditSelect
          label="Stronger foot"
          value={player.secondaryFoot}
          options={secFootOptions}
          onSave={handleSave("secondaryFoot")}
        />
        <InlineEditSelect
          label="Best side"
          value={player.bestSide}
          options={bestSideOptions}
          onSave={handleSave("bestSide")}
        />
      </div>
    </TacticalSurface>
  );
}