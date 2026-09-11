import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineWidget (Touchline Finish & Visual Convergence follow-up,
 * `04_WIDGET_AND_CONTENT_GRAMMAR.md §2`).
 *
 * A widget is justified only when it answers one user question or supports
 * one coherent action cluster — it is not a return to dashboard tile soup.
 * This is the one visual frame primitive; route-level composition components
 * (`NextActionWidget`, `SquadSummaryWidget`, …) build on top of it rather than
 * each re-deriving the same border/shadow/radius declarations.
 *
 * Do not nest a `TouchlineWidget` directly inside another `TouchlineWidget`
 * for routine content grouping — only an overlay/control child (a popover, a
 * floating action) may sit on top of one.
 */
export type TouchlineWidgetTone = "standard" | "strong" | "quiet";
export type TouchlineWidgetPadding = "none" | "compact" | "normal" | "spacious";

type Props<As extends ElementType> = {
  as?: As;
  tone?: TouchlineWidgetTone;
  padding?: TouchlineWidgetPadding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
};

const paddingClasses: Record<TouchlineWidgetPadding, string> = {
  none: "",
  compact: "p-3",
  normal: "p-4",
  spacious: "p-5",
};

const toneClasses: Record<TouchlineWidgetTone, string> = {
  standard: "bg-[var(--tl-widget)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow)]",
  strong: "bg-[var(--tl-widget-strong)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow-strong)]",
  quiet: "bg-[var(--tl-widget)] border border-[var(--border-soft)]",
};

export function TouchlineWidget<As extends ElementType = "section">({
  as,
  tone = "standard",
  padding = "normal",
  interactive = false,
  className,
  children,
}: Props<As>) {
  const Tag = (as ?? "section") as ElementType;
  return (
    <Tag
      className={cn(
        "rounded-[var(--tl-radius-widget)]",
        toneClasses[tone],
        paddingClasses[padding],
        interactive && "transition-colors duration-[var(--tl-c-motion-state)] hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
