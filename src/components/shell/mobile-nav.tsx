"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { isNavItemActive } from "@/components/shell/nav-active";
import { primaryNavItems } from "@/components/shell/nav-items";

/**
 * MobileNav — compact (<600px) primary nav, Touchline visual system (bundle
 * `05_NAVIGATION_MATERIALS_AND_SHELL.md §2`). Floating translucent control-layer
 * bar (12 px inset, 62 px, 16 px radius, safe-area aware, opaque
 * backdrop-filter fallback via `.tl-bottom-nav`). Active item: accent icon +
 * label + a 24×3 px accent bar — never a pill.
 */
export function MobileNav({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = primaryNavItems(orgSlug);

  return (
    <nav aria-label="Mobile" className="touchline tl-bottom-nav medium:hidden">
      <ul className="flex h-full items-stretch justify-between px-2" role="list">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                aria-current={active ? "page" : undefined}
                href={item.href}
                className={cn(
                  "relative flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[var(--tl-c-radius-control)] px-1 py-2 no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
                )}
              >
                <Icon strokeWidth={active ? 2 : 1.75} className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none">{t(item.labelKey)}</span>
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
