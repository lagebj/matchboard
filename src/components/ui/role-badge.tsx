import {
  ShieldCheck,
  ArrowRightCircle,
  ArrowLeftCircle,
  ArrowUpDown,
  TrendingDown,
  Ban,
  type LucideIcon,
} from "lucide-react";

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
  | "MANUAL";

type RoleConfig = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const roleConfig: Record<SelectionRole, RoleConfig> = {
  CORE: {
    label: "Core",
    icon: ShieldCheck,
    className:
      "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  },
  SUPPORT: {
    label: "Support",
    icon: ArrowRightCircle,
    className: "bg-sky-900/40 text-sky-300 border-sky-700/40",
  },
  BACKFILL: {
    label: "Squad repair",
    icon: ArrowLeftCircle,
    className:
      "bg-amber-900/40 text-amber-300 border-amber-700/40",
  },
  DEVELOPMENT: {
    label: "Development",
    icon: ArrowUpDown,
    className:
      "bg-purple-900/40 text-purple-300 border-purple-700/40",
  },
  CONFIDENCE_REBUILD: {
    label: "Confidence",
    icon: TrendingDown,
    className:
      "bg-sky-900/40 text-sky-200 border-sky-700/40",
  },
  REDUCED_MATCH_LOAD_DROP: {
    label: "Reduced load",
    icon: TrendingDown,
    className:
      "bg-amber-900/40 text-amber-200 border-amber-700/40",
  },
  CORE_MATCH_DROP: {
    label: "Dropped",
    icon: Ban,
    className:
      "bg-red-900/40 text-red-300 border-red-700/40",
  },
  DROPPED: {
    label: "Dropped",
    icon: Ban,
    className:
      "bg-red-900/40 text-red-300 border-red-700/40",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    icon: Ban,
    className:
      "bg-zinc-800/50 text-zinc-400 border-zinc-600/40",
  },
  MANUAL: {
    label: "Manual",
    icon: ShieldCheck,
    className:
      "bg-zinc-700/40 text-zinc-300 border-zinc-500/40",
  },
};

export function RoleBadge({ role }: { role: SelectionRole }) {
  const config = roleConfig[role] ?? roleConfig.CORE;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${config.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

export function roleConfigFor(role: SelectionRole): RoleConfig {
  return roleConfig[role] ?? roleConfig.CORE;
}