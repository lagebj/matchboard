import { OctagonAlert, AlertTriangle, FileText, CheckCircle2, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * DecisionBanner — semantic banner for plan integrity and lifecycle state.
 *
 * Per ADR 0007:
 * - `blocked` (red): hard stop, requires resolution or override before finalize.
 * - `decision` (amber): coach judgement required.
 * - `note` (slate): informational context, never an unresolved-issue signal.
 * - `finalized` (green): locked/complete state.
 * - `success` (calm green): confirmation, no action needed.
 *
 * Generic "warning" colour is forbidden — each banner carries one explicit meaning.
 * Banners use a small icon + readable text — never colour-only.
 */
export type DecisionBannerVariant =
  | "blocked"
  | "decision"
  | "note"
  | "finalized"
  | "success";

type DecisionBannerProps = {
  variant: DecisionBannerVariant;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
};

const variantConfig: Record<
  DecisionBannerVariant,
  {
    icon: LucideIcon;
    iconClass: string;
    surfaceClass: string;
    titleClass: string;
    defaultRole: "alert" | "status";
  }
> = {
  blocked: {
    icon: OctagonAlert,
    iconClass: "text-[var(--danger)]",
    surfaceClass:
      "bg-[var(--danger-subtle)] border-[var(--danger)]/35",
    titleClass: "text-[var(--danger)]",
    defaultRole: "alert",
  },
  decision: {
    icon: AlertTriangle,
    iconClass: "text-[var(--warning)]",
    surfaceClass:
      "bg-[var(--warning-subtle)] border-[var(--warning)]/35",
    titleClass: "text-[var(--warning)]",
    defaultRole: "alert",
  },
  note: {
    icon: FileText,
    iconClass: "text-[var(--text-muted)]",
    surfaceClass:
      "bg-[var(--surface-muted)]/40 border-[var(--border-soft)]",
    titleClass: "text-[var(--text-soft)]",
    defaultRole: "status",
  },
  finalized: {
    icon: Lock,
    iconClass: "text-[var(--accent-strong)]",
    surfaceClass:
      "bg-[var(--accent-subtle)] border-[var(--accent)]/30",
    titleClass: "text-[var(--accent-strong)]",
    defaultRole: "status",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-[var(--accent-strong)]",
    surfaceClass:
      "bg-[var(--accent-subtle)] border-[var(--accent)]/30",
    titleClass: "text-[var(--accent-strong)]",
    defaultRole: "status",
  },
};

export function DecisionBanner({
  variant,
  title,
  description,
  action,
  className = "",
  role,
}: DecisionBannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role={role ?? config.defaultRole}
      className={[
        "flex items-start gap-3 rounded-xl border px-3.5 py-2.5",
        config.surfaceClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon
        className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconClass}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.titleClass}`}>{title}</p>
        {description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
