import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlinePageHeader (bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md §6`,
 * `12_COMPONENT_CONTRACTS.md §2`).
 *
 * Page title + optional one-line context + optional right-aligned action group.
 * No enclosing card. Compact title 28px, expanded 32px. The page title appears
 * once — never also in the top bar.
 */
type Props = {
  title: string;
  /** One quiet line under the title, e.g. "Autumn 2026 · Jul–Dec". */
  context?: ReactNode;
  /** Right-aligned contextual actions. One dominant primary at most. */
  actions?: ReactNode;
  className?: string;
};

export function TouchlinePageHeader({ title, context, actions, className }: Props) {
  return (
    <header
      className={cn("flex items-start justify-between gap-4 pt-1", className)}
    >
      <div className="min-w-0">
        <h1 className="text-[28px] font-[650] leading-[32px] tracking-[-0.01em] text-[var(--foreground)] expanded:text-[32px] expanded:leading-[36px]">
          {title}
        </h1>
        {context ? (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{context}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
