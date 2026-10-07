import {
  CalendarClock,
  CalendarRange,
  CalendarDays,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Shared primary-nav item list for `sidebar-nav.tsx`, `mobile-nav.tsx`, and `navigation-rail.tsx`
 * (ADR-0157 slice C8: exactly four items — Today, League, Events, Players. `More` is retired;
 * every job it owned now has a contextual home, a Settings subroute, or a redirect — see
 * `docs/product/navigation-model.md`). Previously each of the three nav surfaces hardcoded its
 * own identical five-item array; this is the single list all three now render from so a future
 * change can't drift between them again.
 */
export type NavLabelKey = "today" | "league" | "events" | "players";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
};

export function primaryNavItems(orgSlug: string): NavItem[] {
  return [
    { href: `/o/${orgSlug}/today`, labelKey: "today", icon: CalendarClock },
    { href: `/o/${orgSlug}/fixtures`, labelKey: "league", icon: CalendarRange },
    { href: `/o/${orgSlug}/events`, labelKey: "events", icon: CalendarDays },
    { href: `/o/${orgSlug}/players`, labelKey: "players", icon: Users },
  ];
}
