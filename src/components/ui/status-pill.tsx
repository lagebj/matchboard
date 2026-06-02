import type { LucideIcon } from "lucide-react";

/**
 * StatusPill — one pill primitive for status/role display across the app.
 *
 * Per ADR 0007: status text is always readable without relying on colour.
 * Role pills (core/support/development/locked/finalized) are calm — never
 * saturated — and never visually imply permanent player ranking.
 */
export type StatusPillVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "development"
  | "support"
  | "core"
  | "locked"
  | "finalized";

export type StatusPillSize = "sm" | "md";

type StatusPillProps = {
  variant?: StatusPillVariant;
  size?: StatusPillSize;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

const variantClasses: Record<StatusPillVariant, string> = {
  neutral:
    "bg-[var(--surface-muted)]/50 text-[var(--text-soft)] border-[var(--border-soft)]",
  success:
    "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/30",
  warning:
    "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/30",
  danger:
    "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/30",
  info:
    "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/30",
  development:
    "bg-[var(--dev-subtle)] text-[var(--dev)] border-[var(--dev)]/30",
  support:
    "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/30",
  core:
    "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/30",
  locked:
    "bg-[var(--surface-muted)]/60 text-[var(--text-soft)] border-[var(--border-strong)]",
  finalized:
    "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border-[var(--accent)]/30",
};

const sizeClasses: Record<StatusPillSize, string> = {
  sm: "h-5 px-1.5 text-[10px] gap-1",
  md: "h-6 px-2 text-xs gap-1.5",
};

export function StatusPill({
  variant = "neutral",
  size = "sm",
  icon: Icon,
  children,
  className = "",
}: StatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wider whitespace-nowrap",
        sizeClasses[size],
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon && (
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      )}
      <span>{children}</span>
    </span>
  );
}
