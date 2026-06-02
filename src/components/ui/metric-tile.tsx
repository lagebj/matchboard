import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * MetricTile — compact cockpit metric.
 *
 * For Assistant mission board and Round Board command strip.
 * Visual, compact, calm. Must not become generic dashboard clutter.
 */
type MetricTileProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  description?: string | null;
  className?: string;
};

const toneClasses: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "bg-[var(--surface-base)] border-[var(--border-soft)]",
  success: "bg-[var(--success-subtle)] border-[var(--success)]/20",
  warning: "bg-[var(--warning-subtle)] border-[var(--warning)]/20",
  danger: "bg-[var(--danger-subtle)] border-[var(--danger)]/20",
  info: "bg-[var(--info-subtle)] border-[var(--info)]/20",
};

const toneTextClasses: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  info: "text-[var(--info)]",
};

export function MetricTile({
  label,
  value,
  icon,
  tone = "neutral",
  description,
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className={cn("shrink-0", toneTextClasses[tone])} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      <p className={cn("text-xl font-semibold tabular-nums", tone === "neutral" ? "text-zinc-100" : toneTextClasses[tone])}>
        {value}
      </p>
      {description && (
        <p className="text-[10px] text-[var(--text-muted)] leading-snug">{description}</p>
      )}
    </div>
  );
}