import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "../sidebar-nav";
import { MobileNav } from "../mobile-nav";
import { NavigationRail } from "../navigation-rail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/o/fjordvik-fk/today",
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

/**
 * ADR-0157 C8: the real, rendered production nav (SidebarNav/MobileNav/NavigationRail) must
 * show exactly the four primary items and never a fifth "more" entry, on every viewport tier.
 */
describe.each([
  ["SidebarNav", SidebarNav],
  ["MobileNav", MobileNav],
  ["NavigationRail", NavigationRail],
])("%s", (_name, Component) => {
  it("renders exactly four primary nav links, no More", () => {
    render(<Component orgSlug="fjordvik-fk" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/o/fjordvik-fk/today",
      "/o/fjordvik-fk/fixtures",
      "/o/fjordvik-fk/events",
      "/o/fjordvik-fk/players",
    ]);
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
  });
});
