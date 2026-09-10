import type { ReactNode } from "react";
import { Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * TouchlineTopBar — desktop context strip (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §5`). 48–52 px. Current
 * group/season context on the left; search / help / account on the right, kept
 * visually secondary. Never carries the page title (that lives once, in
 * `TouchlinePageHeader`).
 */
type Props = {
  /** e.g. "Slemmestad IF · G2015 · Autumn 2026". */
  context: ReactNode;
  /** Account control (or any trailing node). */
  account?: ReactNode;
  className?: string;
};

export function TouchlineTopBar({ context, account, className }: Props) {
  return (
    <header
      className={cn(
        "flex h-[50px] items-center gap-4 border-b border-[var(--border-soft)] px-6",
        className,
      )}
    >
      <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">{context}</p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--tl-c-radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]"
        >
          <Search strokeWidth={1.75} className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Help"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--tl-c-radius-control)] text-[var(--text-muted)] transition-colors hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]"
        >
          <HelpCircle strokeWidth={1.75} className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        {account}
      </div>
    </header>
  );
}
