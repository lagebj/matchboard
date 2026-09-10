import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * RosterColumn (bundle `09_WORKBENCH_GRAMMAR.md §3 §5`).
 *
 * One match lane on the Round Board workbench. Header (match identity + a quiet
 * meta line) over a divider, then a list of `RosterRow`s. No rounded card
 * around the column — dividers and a column background change carry structure,
 * not borders.
 */
type Props = {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function RosterColumn({ title, meta, children, className }: Props) {
  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      <header className="pb-2.5">
        <h3 className="text-[15px] font-[600] text-[var(--foreground)]">{title}</h3>
        {meta ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{meta}</p> : null}
      </header>
      <div className="flex flex-col border-t border-[var(--border-soft)]">{children}</div>
    </section>
  );
}
