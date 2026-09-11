import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineWidget / TouchlineWidgetFrame (Touchline Finish & Visual Convergence follow-up,
 * `04_WIDGET_AND_CONTENT_GRAMMAR.md §2`; density variants extended by the Touchline Design Atlas
 * follow-up, `04_WIDGET_COMPONENT_CONTRACTS.md §1`).
 *
 * A widget is justified only when it answers one user question or supports one coherent action
 * cluster — it is not a return to dashboard tile soup. This is the one visual frame primitive; it
 * owns padding/border/material/radius only and decides no semantics itself (no `danger`/`player`/
 * `stats` variant) — semantic widgets (`src/components/touchline/widgets/`) build on top of it.
 *
 * `tone` carries the Atlas's four density levels (`hero`/`feature`/`support`/`utility`,
 * `02_REFERENCE_TO_CODE_METHOD.md §7`) plus the three tones the first Touchline Finish pass
 * already shipped (`standard`/`strong`/`quiet`, kept as aliases of `support`/`feature`/`utility`
 * so existing callers are unaffected). Only one `hero`-tone widget may appear per viewport.
 *
 * Do not nest a `TouchlineWidget` directly inside another `TouchlineWidget` for routine content
 * grouping — only an overlay/control child (a popover, a floating action) may sit on top of one.
 */
export type TouchlineWidgetTone = "hero" | "feature" | "support" | "utility" | "standard" | "strong" | "quiet";
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
  hero: "tl-feature-atmosphere bg-[var(--tl-widget-strong)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow-strong)]",
  feature: "bg-[var(--tl-widget-strong)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow-strong)]",
  support: "bg-[var(--tl-widget)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow)]",
  utility: "bg-[var(--tl-widget)] border border-[var(--border-soft)]",
  // Aliases retained from the first Touchline Finish pass.
  standard: "bg-[var(--tl-widget)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow)]",
  strong: "bg-[var(--tl-widget-strong)] border border-[var(--tl-widget-border)] shadow-[var(--tl-widget-shadow-strong)]",
  quiet: "bg-[var(--tl-widget)] border border-[var(--border-soft)]",
};

export function TouchlineWidget<As extends ElementType = "section">({
  as,
  tone = "support",
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

/** Atlas naming alias — same component, same props. */
export const TouchlineWidgetFrame = TouchlineWidget;
