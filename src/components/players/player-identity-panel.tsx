"use client";

import { cn } from "@/lib/cn";
import { PositionMap } from "@/components/ui/position-map";
import { InlineEditField } from "@/components/ui/inline-edit-field";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import {
  getPlayerAttributeAverages,
  getOverallStarRating,
} from "@/lib/player-metrics";

const RATING_OPTIONS = [
  { label: "Not rated", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
];

const RATING_LABELS: Record<string, string> = {
  ballControl: "Ball control",
  passing: "Passing",
  firstTouch: "First Touch",
  oneVOneAttacking: "1v1 Attacking",
  positioning: "Positioning",
  oneVOneDefending: "1v1 Defending",
  decisionMaking: "Decision Making",
  effort: "Effort",
  teamplay: "Team Play",
  concentration: "Concentration",
  speed: "Speed",
  strength: "Strength",
};

type PlayerWithTeam = {
  id: string;
  firstName: string;
  lastName: string | null;
  coreTeamId: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  preferredFoot: string | null;
  secondaryFoot: string | null;
  bestSide: string | null;
  currentAvailability: string;
  nonRotatable: boolean;
  reducedMatchLoadAllowed: boolean;
  notes: string | null;
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
  coreTeam: { id: string; name: string } | null;
};

type SelectOption = { label: string; value: string };

type PlayerIdentityPanelProps = {
  player: PlayerWithTeam;
  teams: Array<{ id: string; name: string }>;
  availabilityOptions: ReadonlyArray<SelectOption>;
  positionOptions: ReadonlyArray<SelectOption>;
  optionalPositionOptions: ReadonlyArray<SelectOption>;
  footOptions: ReadonlyArray<SelectOption>;
  secondaryFootOptions: ReadonlyArray<SelectOption>;
  bestSideOptions: ReadonlyArray<SelectOption>;
  updateFieldAction: (playerId: string, field: string, value: string) => Promise<{ success: boolean; error?: string }>;
};

export function PlayerIdentityPanel({ player, teams, availabilityOptions, positionOptions, optionalPositionOptions, footOptions, secondaryFootOptions: secFootOptions, bestSideOptions, updateFieldAction }: PlayerIdentityPanelProps) {
  const teamOptions = teams.map((t) => ({ label: t.name, value: t.id }));

  const handleSave = (field: string) => async (value: string) => {
    await updateFieldAction(player.id, field, value);
  };

  const averages = getPlayerAttributeAverages(player);
  const overallStars = averages.overall != null ? getOverallStarRating(averages.overall) : 0;

  const attributeCategories = [
    { label: "Technical", keys: ["ballControl", "passing", "firstTouch", "oneVOneAttacking"] as const },
    { label: "Tactical", keys: ["positioning", "oneVOneDefending", "decisionMaking"] as const },
    { label: "Mental", keys: ["effort", "teamplay", "concentration"] as const },
    { label: "Physical", keys: ["speed", "strength"] as const },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Position Map */}
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

      {/* Identity Details */}
      <TacticalSurface variant="default" padding="md">
        <SectionHeader title="Identity" />

        <div className="mt-2 flex flex-col gap-2">
          <InlineEditField
            label="First name"
            value={player.firstName}
            onSave={handleSave("firstName")}
          />
          <InlineEditField
            label="Last name"
            value={player.lastName}
            onSave={handleSave("lastName")}
          />
          <InlineEditSelect
            label="Team"
            value={player.coreTeamId}
            options={teamOptions}
            onSave={handleSave("coreTeamId")}
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
          <InlineEditSelect
            label="Availability"
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
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Load</span>
            <span className="text-sm text-zinc-100">
              {player.reducedMatchLoadAllowed ? "Reduced load" : "Standard"}
            </span>
          </div>
          {player.notes && (
            <div className="mt-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Coach notes</p>
              <p className="mt-1 text-xs text-[var(--text-soft)] whitespace-pre-wrap">{player.notes}</p>
            </div>
          )}
        </div>
      </TacticalSurface>

      {/* Attributes */}
      <TacticalSurface variant="default" padding="md">
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="Attributes" />
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-semibold text-zinc-100">{averages.overall ?? "—"}</span>
              {averages.overall != null && (
                <span className="text-sm text-[#d0b07f]" aria-label={`${overallStars} star overall rating`}>
                  {"★".repeat(overallStars)}<span className="text-zinc-600">{"★".repeat(5 - overallStars)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-3">
            {attributeCategories.map((cat) => (
              <div key={cat.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">{cat.label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {cat.keys.map((key) => (
                    <InlineEditSelect
                      key={key}
                      label={RATING_LABELS[key]}
                      value={player[key] != null ? String(player[key]) : ""}
                      options={RATING_OPTIONS}
                      onSave={handleSave(key)}
                      emptyLabel="Not rated"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
      </TacticalSurface>
    </div>
  );
}