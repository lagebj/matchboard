import {
  ShieldCheck,
  ArrowRightCircle,
  ArrowLeftCircle,
  ArrowUpDown,
  TrendingDown,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";

export type SelectionRole =
  | "CORE"
  | "SUPPORT"
  | "BACKFILL"
  | "DEVELOPMENT"
  | "CONFIDENCE_REBUILD"
  | "REDUCED_MATCH_LOAD_DROP"
  | "CORE_MATCH_DROP"
  | "DROPPED"
  | "UNAVAILABLE"
  | "MANUAL"
  | "MANUAL_OVERRIDE";

/**
 * Per ADR 0007 these badges now lean on the calm semantic-token palette via
 * StatusPill so they no longer rely on raw saturated Tailwind colours.
 * Role pills do not visually imply permanent player ranking.
 */
type RoleConfig = {
  label: string;
  icon: LucideIcon;
  variant: StatusPillVariant;
};

const roleConfig: Record<SelectionRole, RoleConfig> = {
  CORE: { label: "Core", icon: ShieldCheck, variant: "core" },
  SUPPORT: { label: "Support", icon: ArrowRightCircle, variant: "support" },
  BACKFILL: { label: "Squad repair", icon: ArrowLeftCircle, variant: "warning" },
  DEVELOPMENT: { label: "Development", icon: ArrowUpDown, variant: "development" },
  CONFIDENCE_REBUILD: { label: "Confidence", icon: TrendingDown, variant: "info" },
  REDUCED_MATCH_LOAD_DROP: { label: "Reduced load", icon: TrendingDown, variant: "warning" },
  CORE_MATCH_DROP: { label: "Dropped", icon: Ban, variant: "danger" },
  DROPPED: { label: "Dropped", icon: Ban, variant: "danger" },
  UNAVAILABLE: { label: "Unavailable", icon: Ban, variant: "neutral" },
  MANUAL: { label: "Manual", icon: ShieldCheck, variant: "neutral" },
  MANUAL_OVERRIDE: { label: "Override", icon: ShieldCheck, variant: "warning" },
};

export function RoleBadge({ role }: { role: SelectionRole }) {
  const config = roleConfig[role] ?? roleConfig.CORE;
  return (
    <StatusPill variant={config.variant} icon={config.icon}>
      {config.label}
    </StatusPill>
  );
}

export function roleConfigFor(role: SelectionRole): RoleConfig {
  return roleConfig[role] ?? roleConfig.CORE;
}
