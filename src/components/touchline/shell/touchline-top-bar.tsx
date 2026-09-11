import type { ReactNode } from "react";
import { Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * TouchlineTopBar — desktop context strip (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §5`; search affordance widened by the
 * Touchline Finish follow-up `03_CODE_CHANGE_MAP.md §E`). 48–52 px. Current
 * group/season context on the left; a search trigger field / help / account
 * on the right, kept visually secondary. Never carries the page title (that
 * lives once, in `TouchlinePageHeader`).
 *
 * `onSearchClick` is a trigger only — this component never owns search state
 * or results. It stays a plain, inert affordance until the caller wires it to
 * the app's real search/command interaction (e.g. the existing command
 * palette); do not invent a second search surface here.
 */
type Props = {
  /** e.g. "Slemmestad IF · G2015 · Autumn 2026". */
  context: ReactNode;
  /** Account control (or any trailing node). */
  account?: ReactNode;
  /** Invokes the existing search/command interaction. Omit to render the field inert. */
  onSearchClick?: () => void;
  searchPlaceholder?: string;
  /** Keyboard-shortcut hint shown inside the trigger, e.g. "⌘K". */
  searchShortcutHint?: string;
  className?: string;
};

export function TouchlineTopBar({
  context,
  account,
  onSearchClick,
  searchPlaceholder = "Search players, teams, matches...",
  searchShortcutHint,
  className,
}: Props) {
  return (
    <header
      className={cn(
        "flex h-[52px] items-center gap-4 border-b border-[var(--border-soft)] px-6",
        className,
      )}
    >
      <p className="min-w-0 shrink-0 truncate text-[13px] text-[var(--text-muted)]">{context}</p>

      <button
        type="button"
        onClick={onSearchClick}
        className="flex h-9 max-w-[280px] flex-1 items-center gap-2 rounded-[var(--tl-c-radius-control)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] px-3 text-left text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)]"
      >
        <Search strokeWidth={1.75} className="h-[16px] w-[16px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{searchPlaceholder}</span>
        {searchShortcutHint ? (
          <span className="shrink-0 rounded-[6px] border border-[var(--border-soft)] px-1.5 py-0.5 text-[11px] text-[var(--text-disabled)]">
            {searchShortcutHint}
          </span>
        ) : null}
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
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
