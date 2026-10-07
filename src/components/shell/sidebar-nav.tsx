"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { TouchlineWordmark } from "@/components/touchline/brand/touchline-wordmark";
import { isNavItemActive } from "@/components/shell/nav-active";
import { primaryNavItems } from "@/components/shell/nav-items";
import { APP_VERSION } from "@/lib/version";

/**
 * SidebarNav — desktop primary nav, Touchline visual system (ADR-0134 §8,
 * bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md §4`).
 *
 * Recedes behind work content: background one step toward canvas, a subtle
 * right border, no card around the sidebar. Active item: a 3 px accent leading
 * marker + strengthened foreground — no large pill.
 */
export function SidebarNav({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const items = primaryNavItems(orgSlug);

  return (
    <nav
      aria-label="Primary"
      className="touchline flex h-full flex-col border-r border-[var(--border-soft)] bg-[var(--tl-c-canvas)]"
    >
      <div className="px-5 pt-6 pb-5">
        <TouchlineWordmark />
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-3" role="list">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-[var(--tl-c-radius-control)] py-2 pl-3.5 pr-3 text-[14px] no-underline transition-colors duration-[var(--tl-c-motion-state)]",
                  active
                    ? "font-medium text-[var(--foreground)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--text-soft)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2 : 1.75}
                  className={cn("h-5 w-5 shrink-0", active ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}
                  aria-hidden="true"
                />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="px-5 py-4 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        v{APP_VERSION}
      </div>
    </nav>
  );
}
