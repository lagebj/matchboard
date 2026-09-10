"use client";

import { cn } from "@/lib/cn";

/**
 * RosterRow (bundle `09_WORKBENCH_GRAMMAR.md §4`, `12_COMPONENT_CONTRACTS.md
 * §17`).
 *
 * A player line in a planning column or roster list. Player identity + a
 * concise position/role code + optional dot state. No outer card per player.
 * Selected state: a 2–3 px accent marker + a subtle surface change + stronger
 * foreground — never a large luminous accent fill.
 */
type Props = {
  name: string;
  /** Exact role / position code, e.g. "LW", "GK". */
  code?: string;
  /** Dot tone — a quiet on-field / status marker. */
  dot?: "on" | "muted" | "attention";
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
};

const dotClass: Record<NonNullable<Props["dot"]>, string> = {
  on: "bg-[var(--accent)]",
  muted: "bg-[var(--border-strong)]",
  attention: "bg-[var(--warning)]",
};

export function RosterRow({ name, code, dot = "on", selected = false, onSelect, className }: Props) {
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      {...(onSelect ? { type: "button" as const, onClick: onSelect } : {})}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "relative flex w-full items-center gap-2.5 py-2.5 pl-3.5 pr-2 text-left transition-colors duration-[var(--tl-c-motion-state)]",
        selected
          ? "bg-[var(--tl-c-surface-selected)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--accent)]"
          : onSelect && "hover:bg-[var(--tl-c-surface-hover)]",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[dot])} aria-hidden="true" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14px]",
          selected ? "font-[600] text-[var(--foreground)]" : "font-medium text-[var(--text-soft)]",
        )}
      >
        {name}
      </span>
      {code ? (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {code}
        </span>
      ) : null}
    </Tag>
  );
}
