import Link from "next/link";
import { cn } from "@/lib/cn";
import { TouchlineMark } from "@/components/touchline/brand/touchline-mark";
import { TOUCHLINE_NAV_META, type TouchlineNavItem, type TouchlineNavKey } from "./nav-model";

/**
 * TouchlineRail — medium-tier (600–839px) nav (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §3`). 72 px, quiet semi-opaque surface,
 * icon-led labels, 3 px accent rail marker on the active item. Not floating over
 * work content — a tablet-portrait viewport must never fall back to the phone
 * bottom nav.
 */
type Props = {
  items: TouchlineNavItem[];
  activeKey: TouchlineNavKey | null;
};

export function TouchlineRail({ items, activeKey }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-[72px] shrink-0 flex-col items-center border-r border-[var(--border-soft)] bg-[var(--tl-c-canvas)]"
    >
      <div className="flex h-14 items-center justify-center">
        <TouchlineMark className="h-6 w-6 text-[var(--accent)]" />
      </div>
      <ul className="flex w-full flex-1 flex-col items-center gap-1 px-1.5" role="list">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = TOUCHLINE_NAV_META[item.key].icon;
          return (
            <li key={item.key} className="w-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-1 py-2.5 text-center no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active
                    ? "text-[var(--foreground)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.75}
                  className={cn("h-5 w-5", active ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}
                  aria-hidden="true"
                />
                <span className="w-full truncate text-[11px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
