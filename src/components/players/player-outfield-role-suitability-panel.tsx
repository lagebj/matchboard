import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";

export type OutfieldRoleRow = {
  role: "DEFENCE" | "MIDFIELD" | "ATTACK" | "FLEXIBLE";
  tier: "NATURAL" | "PLAUSIBLE" | "DEVELOPMENTAL" | "UNSUPPORTED";
  explanation: string;
};

export type TacticalFunctionRow = {
  function: string;
  label: string;
  tier: "STRONG_FIT" | "MODERATE_FIT" | "WEAK_FIT" | "NOT_APPLICABLE";
};

type PlayerOutfieldRoleSuitabilityPanelProps = {
  outfieldRoles: OutfieldRoleRow[];
  tacticalFunctions: TacticalFunctionRow[];
  leagueSeasonLabel: string | null;
};

const ROLE_LABEL: Record<OutfieldRoleRow["role"], string> = {
  DEFENCE: "Defence",
  MIDFIELD: "Midfield",
  ATTACK: "Attack",
  FLEXIBLE: "Flexible",
};

const TIER_LABEL: Record<OutfieldRoleRow["tier"], string> = {
  NATURAL: "Natural",
  PLAUSIBLE: "Plausible",
  DEVELOPMENTAL: "Developmental",
  UNSUPPORTED: "Unsupported",
};

const TIER_VARIANT: Record<OutfieldRoleRow["tier"], StatusPillVariant> = {
  NATURAL: "core",
  PLAUSIBLE: "support",
  DEVELOPMENTAL: "development",
  UNSUPPORTED: "neutral",
};

const FUNCTION_TIER_LABEL: Record<TacticalFunctionRow["tier"], string> = {
  STRONG_FIT: "Strong fit",
  MODERATE_FIT: "Moderate fit",
  WEAK_FIT: "Weak fit",
  NOT_APPLICABLE: "Not applicable",
};

const FUNCTION_TIER_VARIANT: Record<TacticalFunctionRow["tier"], StatusPillVariant> = {
  STRONG_FIT: "success",
  MODERATE_FIT: "info",
  WEAK_FIT: "neutral",
  NOT_APPLICABLE: "neutral",
};

export function PlayerOutfieldRoleSuitabilityPanel({
  outfieldRoles,
  tacticalFunctions,
  leagueSeasonLabel,
}: PlayerOutfieldRoleSuitabilityPanelProps) {
  const applicableFunctions = tacticalFunctions.filter((f) => f.tier !== "NOT_APPLICABLE");

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Outfield role suitability" />
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
        Declared position is a strong prior, not a rigid queue. Roles below reflect declared
        position and demonstrated exposure{leagueSeasonLabel ? ` (${leagueSeasonLabel})` : ""} —
        never a fairness need or coach convenience.
      </p>

      <div className="mt-2 space-y-1">
        {outfieldRoles.map((row) => (
          <div key={row.role} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-[var(--text-strong)]">{ROLE_LABEL[row.role]}</span>
              <p className="text-[10px] text-[var(--text-soft)]">{row.explanation}</p>
            </div>
            <StatusPill variant={TIER_VARIANT[row.tier]} size="sm">
              {TIER_LABEL[row.tier]}
            </StatusPill>
          </div>
        ))}
      </div>

      {applicableFunctions.length > 0 && (
        <div className="mt-2.5 border-t border-[var(--border-soft)] pt-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-1">
            Tactical function fit
          </p>
          <div className="flex flex-wrap gap-1">
            {applicableFunctions.map((row) => (
              <StatusPill key={row.function} variant={FUNCTION_TIER_VARIANT[row.tier]} size="sm">
                {row.label}: {FUNCTION_TIER_LABEL[row.tier]}
              </StatusPill>
            ))}
          </div>
        </div>
      )}
    </TacticalSurface>
  );
}
