import {
  OctagonAlert,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";

export type Severity = "blocking" | "high" | "medium" | "info";

type SeverityConfig = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const severityConfig: Record<Severity, SeverityConfig> = {
  blocking: {
    label: "Blocking",
    icon: OctagonAlert,
    className:
      "bg-red-900/30 text-red-300 border-red-700/40",
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    className:
      "bg-amber-900/30 text-amber-300 border-amber-700/40",
  },
  medium: {
    label: "Medium",
    icon: AlertTriangle,
    className:
      "bg-amber-900/20 text-amber-200 border-amber-700/30",
  },
  info: {
    label: "Info",
    icon: Info,
    className:
      "bg-sky-900/30 text-sky-300 border-sky-700/40",
  },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const config = severityConfig[severity] ?? severityConfig.info;
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

export function severityConfigFor(severity: Severity): SeverityConfig {
  return severityConfig[severity] ?? severityConfig.info;
}

export function severityFromCode(code: string): Severity {
  if (
    code.includes("shortfall") ||
    code.includes("no_path") ||
    code.includes("conflict") ||
    code.includes("unable")
  ) {
    return "blocking";
  }
  if (
    code.includes("below_target") ||
    code.includes("burden") ||
    code.includes("risk") ||
    code.includes("override")
  ) {
    return "high";
  }
  if (code.includes("warning") || code.includes("tentative")) {
    return "medium";
  }
  return "info";
}