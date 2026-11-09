import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabRail, type TabItem } from "../tab-rail";

const ITEMS: TabItem<"a" | "b" | "c">[] = [
  { key: "a", label: "Overview" },
  { key: "b", label: "Events" },
  { key: "c", label: "Stats" },
];

/**
 * B08 W5 remediation (independent review, P1-4) — the pill variant's root `<nav>` must be able to
 * contain its own horizontal overflow rather than blowing out the whole page at narrow widths.
 * jsdom does not compute real layout, so this only asserts the structural fix (the containment
 * classes are present) and that nothing else about the rail's rendering changed; real pixel/
 * scroll-width proof comes from the Playwright responsive suite and the CI capture run.
 */
describe("TabRail — pill variant overflow containment (P1-4)", () => {
  it("the root nav caps its own width and can scroll horizontally within itself", () => {
    render(<TabRail items={ITEMS} activeKey="a" variant="pill" ariaLabel="Test tabs" />);
    const nav = screen.getByRole("navigation", { name: "Test tabs" });
    expect(nav.className).toContain("max-w-full");
    expect(nav.className).toContain("overflow-x-auto");
  });

  it("every tab item still renders, in order, with the active one correctly marked — unchanged by the containment fix", () => {
    render(<TabRail items={ITEMS} activeKey="b" variant="pill" ariaLabel="Test tabs" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Overview", "Events", "Stats"]);
    expect(screen.getByRole("button", { name: "Events" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("each pill item is shrink-0 (scrolls cleanly instead of compressing/wrapping individual labels)", () => {
    render(<TabRail items={ITEMS} activeKey="a" variant="pill" ariaLabel="Test tabs" />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("shrink-0");
    }
  });

  it("the underline variant (unaffected by this fix) keeps its own pre-existing overflow-x-auto + shrink-0 pattern unchanged", () => {
    render(<TabRail items={ITEMS} activeKey="a" variant="underline" ariaLabel="Test tabs" />);
    const nav = screen.getByRole("navigation", { name: "Test tabs" });
    expect(nav.className).toContain("overflow-x-auto");
    expect(screen.getByRole("button", { name: "Overview" }).className).toContain("shrink-0");
  });
});
