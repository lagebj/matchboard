import Link from "next/link";
import { cn } from "@/lib/cn";
import { TOUCHLINE_NAV_META, type TouchlineNavItem, type TouchlineNavKey } from "./nav-model";

/**
 * TouchlineBottomNav — compact (<600px) floating translucent primary nav
 * (bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md §2`, acceptance gate E).
 *
 * Geometry: 12 px side inset, `calc(safe-area + 10px)` bottom, 62 px tall,
 * 16 px radius, 8 px inner padding. Control-layer material (blur + subtle
 * border + separation shadow) with a solid opaque fallback where
 * `backdrop-filter` is unsupported. Active item: accent icon + label + a
 * 24×3 px accent bar at the item's bottom edge — never a pill.
 */
type Props = {
  items: TouchlineNavItem[];
  activeKey: TouchlineNavKey | null;
  className?: string;
};

export function TouchlineBottomNav({ items, activeKey, className }: Props) {
  return (
    <nav
      aria-label="Primary"
      className={cn("tl-bottom-nav medium:hidden", className)}
    >
      <ul className="flex items-stretch justify-between px-2" role="list">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = TOUCHLINE_NAV_META[item.key].icon;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[var(--tl-c-radius-control)] px-1 py-2 no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.75}
                  className="h-5 w-5"
                  aria-hidden="true"
                />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 h-[3px] w-6 rounded-full bg-[var(--accent)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
