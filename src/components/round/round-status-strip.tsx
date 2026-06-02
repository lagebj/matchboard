import {
  OctagonAlert,
  AlertTriangle,
  ShieldCheck,
  ArrowLeftRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Surface } from "@/components/ui/surface";

type RoundStatusStripProps = {
  totalTeams: number;
  completeTeams: number;
  teamsNeedingSupport: number;
  squadRepairNeeded: number;
  blockedCount: number;
  decisionRequiredCount: number;
  totalSelected: number;
  totalTarget: number;
};

type StatusVariant = "default" | "success" | "warning" | "danger" | "muted";

type StatusItem = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant: StatusVariant;
};

const variantToneClass: Record<StatusVariant, string> = {
  default: "text-zinc-100",
  success: "text-[var(--accent-strong)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  muted: "text-[var(--text-muted)]",
};

/**
 * RoundStatusStrip — quiet decision strip showing only conditions worth
 * surfacing. Per ADR 0007 this is a compact summary, not a banner — it
 * complements (and does not duplicate) DecisionBanner.
 */
export function RoundStatusStrip({
  totalTeams,
  completeTeams,
  teamsNeedingSupport,
  squadRepairNeeded,
  blockedCount,
  decisionRequiredCount,
  totalSelected,
  totalTarget,
}: RoundStatusStripProps) {
  const items: StatusItem[] = [
    {
      icon: Users,
      label: "Squads filled",
      value: `${completeTeams}/${totalTeams}`,
      variant: completeTeams === totalTeams ? "success" : "default",
    },
  ];

  if (teamsNeedingSupport > 0) {
    items.push({
      icon: ShieldCheck,
      label: "Support needed",
      value: teamsNeedingSupport,
      variant: "warning",
    });
  }
  if (squadRepairNeeded > 0) {
    items.push({
      icon: ArrowLeftRight,
      label: "Squad repair",
      value: squadRepairNeeded,
      variant: "warning",
    });
  }
  if (blockedCount > 0) {
    items.push({
      icon: OctagonAlert,
      label: "Blocked",
      value: blockedCount,
      variant: "danger",
    });
  }
  if (decisionRequiredCount > 0) {
    items.push({
      icon: AlertTriangle,
      label: "Decision",
      value: decisionRequiredCount,
      variant: "warning",
    });
  }

  return (
    <Surface
      padding="none"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const tone = variantToneClass[item.variant];
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden="true" />
            <span className={`text-xs font-semibold tabular-nums ${tone}`}>
              {item.value}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {item.label}
            </span>
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs font-semibold tabular-nums text-zinc-100">
          {totalSelected}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">of</span>
        <span className="text-xs font-semibold tabular-nums text-zinc-100">
          {totalTarget}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">squad places</span>
      </div>
    </Surface>
  );
}
