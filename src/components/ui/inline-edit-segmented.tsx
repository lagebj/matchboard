"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";

type SegmentedOption = { label: string; value: string };

type InlineEditSegmentedProps = {
  label: string;
  value: string | null;
  options: SegmentedOption[];
  onSave: (nextValue: string) => Promise<void> | void;
  disabled?: boolean;
  toneMap?: Record<string, "neutral" | "success" | "warning" | "danger" | "info">;
  className?: string;
};

const toneClasses: Record<string, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-soft)] border-[var(--border-soft)]",
  success: "bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/30",
  warning: "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/30",
  danger: "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger)]/30",
  info: "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--info)]/30",
};

export function InlineEditSegmented({
  label,
  value,
  options,
  onSave,
  disabled = false,
  toneMap,
  className,
}: InlineEditSegmentedProps) {
  const [pending, setPending] = useState(false);

  const handleChange = useCallback(async (nextValue: string) => {
    if (nextValue === value) return;
    setPending(true);
    try {
      await onSave(nextValue);
    } catch {
      // Error is silently ignored for segmented controls; the value reverts on re-render
    } finally {
      setPending(false);
    }
  }, [value, onSave]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          const tone = toneMap?.[opt.value] ?? "neutral";
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled || pending}
              onClick={() => handleChange(opt.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                "focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40",
                isSelected
                  ? cn(toneClasses[tone], "ring-1 ring-inset")
                  : "border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-zinc-200",
                disabled && "opacity-50 cursor-not-allowed",
                pending && "opacity-60",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}