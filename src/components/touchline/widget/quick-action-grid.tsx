import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * QuickActionGrid (`04_WIDGET_AND_CONTENT_GRAMMAR.md §6`) — 2–4 EXISTING
 * high-frequency actions. No action may be invented to fill the visual grid;
 * callers pass only real, already-reachable destinations/handlers.
 */
export type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  /** Only the dominant action in the set may use accent fill. */
  dominant?: boolean;
};

type Props = {
  actions: QuickAction[];
  className?: string;
};

function ActionTile({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  const content: ReactNode = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border",
          action.dominant
            ? "border-transparent bg-[var(--accent)] text-[var(--tl-c-accent-on-fill)]"
            : "border-[var(--tl-widget-border)] bg-[var(--tl-widget-muted)] text-[var(--text-soft)]",
        )}
      >
        <Icon strokeWidth={1.75} className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[13px] font-medium text-[var(--foreground)]">{action.label}</span>
    </>
  );

  const className = cn(
    "flex min-h-[44px] flex-col items-center justify-center gap-2 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] px-2 py-3 text-center no-underline transition-colors duration-[var(--tl-c-motion-state)] hover:border-[var(--border-strong)]",
  );

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

export function QuickActionGrid({ actions, className }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 medium:grid-cols-4", className)}>
      {actions.map((action) => (
        <ActionTile key={action.key} action={action} />
      ))}
    </div>
  );
}
