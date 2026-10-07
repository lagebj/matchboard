import {
  CalendarClock,
  CalendarRange,
  CalendarDays,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The one destination model for all three navigation variants (bundle
 * `12_COMPONENT_CONTRACTS.md §1`). Four primary destinations (ADR-0157 C8 removed
 * `more` — every job it owned now has a contextual home or a redirect).
 *
 * Items carry only serializable data (`key`, `label`, `href`) so the list can
 * cross the server/client boundary freely; each nav component resolves the
 * Lucide icon from `TOUCHLINE_NAV_META[key]` itself.
 */
export type TouchlineNavKey = "today" | "league" | "events" | "players";

export type TouchlineNavItem = {
  key: TouchlineNavKey;
  label: string;
  href: string;
};

export const TOUCHLINE_NAV_META: Record<TouchlineNavKey, { label: string; icon: LucideIcon }> = {
  today: { label: "Today", icon: CalendarClock },
  league: { label: "League", icon: CalendarRange },
  events: { label: "Events", icon: CalendarDays },
  players: { label: "Players", icon: Users },
};

export const TOUCHLINE_NAV_ORDER: readonly TouchlineNavKey[] = [
  "today",
  "league",
  "events",
  "players",
] as const;

/** Build the item list for an org slug (or plain hrefs for the UI Lab). */
export function buildTouchlineNav(hrefFor: (key: TouchlineNavKey) => string): TouchlineNavItem[] {
  return TOUCHLINE_NAV_ORDER.map((key) => ({
    key,
    label: TOUCHLINE_NAV_META[key].label,
    href: hrefFor(key),
  }));
}
