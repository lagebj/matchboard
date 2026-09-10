import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * StatusText (bundle `12_COMPONENT_CONTRACTS.md §15`) — plain text + optional
 * dot for lifecycle/state. Not every state is a pill. `capsule` is reserved for
 * a short exceptional state where grouping genuinely improves scan.
 */
export type StatusTone = "neutral" | "accent" | "live" | "attention" | "danger" | "evidence";

const toneColor: Record<StatusTone, string> = {
  neutral: "text-[var(--text-muted)]",
  accent: "text-[var(--accent)]",
  live: "text-[var(--tl-c-live)]",
  attention: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  evidence: "text-[var(--tl-c-evidence)]",
};

const toneDot: Record<StatusTone, string> = {
  neutral: "bg-[var(--text-muted)]",
  accent: "bg-[var(--accent)]",
  live: "bg-[var(--tl-c-live)]",
  attention: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  evidence: "bg-[var(--tl-c-evidence)]",
};

export function StatusText({
  children,
  tone = "neutral",
  dot = false,
  strong = false,
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]",
        toneColor[tone],
        strong && "font-medium",
        className,
      )}
    >
      {dot ? (
        <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", toneDot[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
