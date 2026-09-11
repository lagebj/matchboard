import Link from "next/link";
import { cn } from "@/lib/cn";
import { TOUCHLINE_NAV_META, type TouchlineNavItem, type TouchlineNavKey } from "./nav-model";

/**
 * TouchlineBottomNav — compact (<600px) floating translucent primary nav
 * (bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md §2`, acceptance gate E;
 * geometry/material superseded by the Touchline Finish follow-up
 * `03_CODE_CHANGE_MAP.md §B` / `05_SHELL_NAVIGATION_AND_MATERIALS.md §1`).
 *
 * Geometry: 16 px side inset, `calc(safe-area + 12px)` bottom, 74 px tall,
 * 22 px radius. Control-glass material (>=90% opaque background + blur where
 * supported — the `.tl-bottom-nav` class carries this, both the AA-contrast
 * fallback and the enhanced material at once). Active item: a 28×28 bordered
 * accent-subtle icon container + accent label + a 24×3 px accent bar at the
 * item's bottom edge — never a full-destination pill.
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
                  "relative flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 py-2 no-underline",
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-[var(--tl-c-radius-control)] border transition-colors duration-[var(--tl-c-motion-state)]",
                    active
                      ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--accent-subtle)]"
                      : "border-transparent",
                  )}
                >
                  <Icon strokeWidth={active ? 2 : 1.75} className="h-5 w-5" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "text-[12px] leading-none transition-colors duration-[var(--tl-c-motion-state)]",
                    active ? "font-medium text-[var(--accent)]" : "font-medium",
                  )}
                >
                  {item.label}
                </span>
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
