import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * WorkbenchToolbar (bundle `09_WORKBENCH_GRAMMAR.md §3`,
 * `12_COMPONENT_CONTRACTS.md §12`).
 *
 * Compact height, context on the left, operational actions on the right, no
 * decorative hero background. Blocked / Decision-required state stays prominent
 * beside the work it belongs to.
 */
type Props = {
  /** Left context — e.g. a "Plan integrity: 2 decisions" attention statement. */
  context: ReactNode;
  /** Right-aligned operational actions. */
  actions?: ReactNode;
  className?: string;
};

export function WorkbenchToolbar({ context, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0 text-[14px]">{context}</div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
