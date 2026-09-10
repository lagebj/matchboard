"use client";

import { Monitor, Sun, Moon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme/theme-provider";
import { APPEARANCE_MODES, type AppearanceMode } from "@/lib/theme/theme";

/**
 * AppearanceControl (bundle `03_BRAND_THEME_AND_TOKENS.md §3`) — Settings →
 * Appearance. One segmented control: System / Light / Dark. Changing it applies
 * immediately and persists (`matchboard-theme`). No arbitrary colour
 * customization.
 */
const OPTIONS: { value: AppearanceMode; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function AppearanceControl({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors duration-[var(--tl-c-motion-state)]",
              active
                ? "bg-[var(--tl-c-accent)] text-[var(--tl-c-accent-on-fill)]"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon strokeWidth={1.75} className="h-4 w-4" aria-hidden="true" />
            {opt.label}
          </button>
        );
      })}
      {/* Guard against APPEARANCE_MODES drifting from OPTIONS. */}
      {APPEARANCE_MODES.length !== OPTIONS.length ? <span className="sr-only">mode list mismatch</span> : null}
    </div>
  );
}
