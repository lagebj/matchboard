import { describe, it, expect } from "vitest";
import { primaryNavItems } from "../nav-items";

/**
 * ADR-0157 C8: exactly four primary nav items, in order, no `more` entry — and no mechanism
 * here would even accept a fifth item (the return type is a fixed-shape array built from a
 * literal list, not something a caller can extend).
 */
describe("primaryNavItems", () => {
  it("returns exactly four items in the Today/League/Events/Players order", () => {
    const items = primaryNavItems("fjordvik-fk");
    expect(items.map((i) => i.labelKey)).toEqual(["today", "league", "events", "players"]);
  });

  it("never includes a more item", () => {
    const items = primaryNavItems("fjordvik-fk");
    expect(items.some((i) => (i.labelKey as string) === "more")).toBe(false);
    expect(items).toHaveLength(4);
  });

  it("builds org-scoped hrefs", () => {
    const items = primaryNavItems("fjordvik-fk");
    expect(items.map((i) => i.href)).toEqual([
      "/o/fjordvik-fk/today",
      "/o/fjordvik-fk/fixtures",
      "/o/fjordvik-fk/events",
      "/o/fjordvik-fk/players",
    ]);
  });
});
