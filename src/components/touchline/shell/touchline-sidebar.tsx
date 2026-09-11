import Link from "next/link";
import { cn } from "@/lib/cn";
import { TouchlineWordmark } from "@/components/touchline/brand/touchline-wordmark";
import { TOUCHLINE_NAV_META, type TouchlineNavItem, type TouchlineNavKey } from "./nav-model";

/**
 * TouchlineSidebar — desktop (≥840px) primary nav (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §4`; row rhythm/active treatment
 * refined by the Touchline Finish follow-up `03_CODE_CHANGE_MAP.md §D`).
 *
 * Recedes behind work content: background one step closer to canvas than
 * routine raised content, a subtle right border, no card around the sidebar.
 * Active item: 3 px accent leading marker + `accent-subtle` row background +
 * strengthened foreground. No large pill. Fixed 216 px — never grows with
 * viewport. 4 px row gap, 42 px row height (never the cramped 10-12 px gap
 * the first pass allowed).
 */
type Props = {
  items: TouchlineNavItem[];
  activeKey: TouchlineNavKey | null;
  versionLabel?: string;
};

export function TouchlineSidebar({ items, activeKey, versionLabel }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-[216px] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--tl-c-canvas)]"
    >
      <div className="px-5 pt-6 pb-5">
        <TouchlineWordmark />
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3" role="list">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = TOUCHLINE_NAV_META[item.key].icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[42px] items-center gap-3 rounded-[var(--tl-c-radius-control)] pl-3.5 pr-3 text-[14px] no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active
                    ? "bg-[var(--accent-subtle)] font-medium text-[var(--foreground)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.75}
                  className={cn("h-5 w-5 shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {versionLabel ? (
        <div className="px-5 py-4 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {versionLabel}
        </div>
      ) : null}
    </nav>
  );
}
