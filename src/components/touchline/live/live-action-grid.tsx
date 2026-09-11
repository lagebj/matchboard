import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * LiveActionGrid (Touchline Finish & Visual Convergence follow-up,
 * `07_LIVE_MATCHDAY_AND_OVERLAYS.md §2`).
 *
 * Pure presentation over action descriptors the caller supplies from the
 * existing live-reporting feature — this component defines no action type of
 * its own. Layout only: 2–4 columns depending on action count/label width,
 * >=76×76 px targets, one primary/high-frequency action may use accent fill.
 */
export type LiveActionTone = "primary" | "neutral" | "attention" | "danger";

export type LiveAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: LiveActionTone;
  disabled?: boolean;
  onClick?: () => void;
};

const toneClasses: Record<LiveActionTone, string> = {
  primary: "border-transparent bg-[var(--accent)] text-[var(--tl-c-accent-on-fill)]",
  neutral: "border-[var(--tl-widget-border)] bg-[var(--tl-widget)] text-[var(--foreground)]",
  attention: "border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[var(--warning-subtle)] text-[var(--warning)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[var(--danger-subtle)] text-[var(--danger)]",
};

type Props = {
  actions: LiveAction[];
  className?: string;
};

export function LiveActionGrid({ actions, className }: Props) {
  const cols = actions.length >= 7 ? "grid-cols-4" : actions.length >= 5 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={cn("grid gap-2.5", cols, className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(
              "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[var(--tl-radius-widget)] border text-[13px] font-semibold transition-[filter] duration-[var(--tl-c-motion-state)] disabled:cursor-not-allowed disabled:opacity-45",
              toneClasses[action.tone ?? "neutral"],
              !action.disabled && "hover:brightness-105 active:brightness-95",
            )}
          >
            <Icon strokeWidth={1.9} className="h-6 w-6" aria-hidden="true" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
