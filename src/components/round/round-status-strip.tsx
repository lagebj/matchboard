import {
  OctagonAlert,
  AlertTriangle,
  ShieldCheck,
  ArrowLeftRight,
  Users,
  Target,
  type LucideIcon,
} from "lucide-react";
import { MetricTile } from "@/components/ui/metric-tile";

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

type MetricDef = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

/**
 * RoundStatusStrip — command strip using MetricTile for squad status.
 * Shows only conditions worth surfacing. Complements DecisionBanner.
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
  const metrics: MetricDef[] = [
    {
      icon: Users,
      label: "Squads filled",
      value: `${completeTeams}/${totalTeams}`,
      tone: completeTeams === totalTeams ? "success" : "neutral",
    },
  ];

  if (teamsNeedingSupport > 0) {
    metrics.push({
      icon: ShieldCheck,
      label: "Support needed",
      value: teamsNeedingSupport,
      tone: "warning",
    });
  }
  if (squadRepairNeeded > 0) {
    metrics.push({
      icon: ArrowLeftRight,
      label: "Squad repair",
      value: squadRepairNeeded,
      tone: "warning",
    });
  }
  if (blockedCount > 0) {
    metrics.push({
      icon: OctagonAlert,
      label: "Blocked",
      value: blockedCount,
      tone: "danger",
    });
  }
  if (decisionRequiredCount > 0) {
    metrics.push({
      icon: AlertTriangle,
      label: "Decisions",
      value: decisionRequiredCount,
      tone: "warning",
    });
  }

  metrics.push({
    icon: Target,
    label: "Squad places",
    value: `${totalSelected}/${totalTarget}`,
    tone: totalSelected >= totalTarget ? "success" : "neutral",
  });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => (
        <MetricTile
          key={m.label}
          icon={<m.icon className="h-4 w-4" />}
          label={m.label}
          value={m.value}
          tone={m.tone}
        />
      ))}
    </div>
  );
}