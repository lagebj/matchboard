import {
  OctagonAlert,
  ShieldCheck,
  ArrowLeftRight,
  Users,
  type LucideIcon,
} from "lucide-react";

type RoundStatusStripProps = {
  roundLabel: string;
  roundStatus: "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";
  totalTeams: number;
  completeTeams: number;
  teamsNeedingSupport: number;
  squadRepairNeeded: number;
  blockingWarnings: number;
  totalSelected: number;
  totalTarget: number;
};

type StatusItem = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant: "default" | "success" | "warning" | "danger" | "muted";
};

export function RoundStatusStrip({
  roundStatus: _roundStatus,
  totalTeams,
  completeTeams,
  teamsNeedingSupport,
  squadRepairNeeded,
  blockingWarnings,
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
      label: "Support missing",
      value: teamsNeedingSupport,
      variant: "warning",
    });
  } else if (totalTeams > 0) {
    items.push({
      icon: ShieldCheck,
      label: "Support fulfilled",
      value: "0",
      variant: "success",
    });
  }

  if (squadRepairNeeded > 0) {
    items.push({
      icon: ArrowLeftRight,
      label: "Squad repair required",
      value: squadRepairNeeded,
      variant: "warning",
    });
  }

  if (blockingWarnings > 0) {
    items.push({
      icon: OctagonAlert,
      label: "Blocking",
      value: blockingWarnings,
      variant: "danger",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3">
      {items.map((item) => {
        const Icon = item.icon;
        const variantClasses = {
          default: "text-zinc-300",
          success: "text-emerald-400",
          warning: "text-amber-400",
          danger: "text-red-400",
          muted: "text-zinc-500",
        }[item.variant];
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${variantClasses}`} aria-hidden="true" />
            <span className={`text-xs font-medium tabular-nums ${variantClasses}`}>
              {item.value}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{item.label}</span>
          </div>
        );
      })}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs font-medium tabular-nums text-zinc-300">{totalSelected}</span>
        <span className="text-[10px] text-[var(--text-muted)]">of</span>
        <span className="text-xs font-medium tabular-nums text-zinc-300">{totalTarget}</span>
        <span className="text-[10px] text-[var(--text-muted)]">squad places</span>
      </div>
    </div>
  );
}