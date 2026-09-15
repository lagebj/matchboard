import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LeagueSeasonRail } from "../league-season-rail";
import type { LeagueRailSlot } from "@/lib/touchline/presentation/league-view-model";

function slot(overrides: Partial<LeagueRailSlot> & { weekKey: string }): LeagueRailSlot {
  return {
    weekLabel: overrides.weekKey.split("-W")[1] ? `W${overrides.weekKey.split("-W")[1]}` : overrides.weekKey,
    roundIds: [],
    primaryRoundId: null,
    state: "EMPTY",
    selected: false,
    ...overrides,
  };
}

// 12 weeks, week 8 is CURRENT/selected, everything else EMPTY — mirrors a full-season rail with
// one active round somewhere in the middle.
function buildSlots(currentIndex: number, total = 12): LeagueRailSlot[] {
  return Array.from({ length: total }, (_, i) =>
    slot({
      weekKey: `2026-W${String(i + 1).padStart(2, "0")}`,
      state: i === currentIndex ? "CURRENT" : "EMPTY",
      selected: i === currentIndex,
      roundIds: i === currentIndex ? [`r${i}`] : [],
      primaryRoundId: i === currentIndex ? `r${i}` : null,
    }),
  );
}

describe("LeagueSeasonRail — viewport containment and windowing", () => {
  it("never renders the full season list when it exceeds the fallback visible window (no ResizeObserver in jsdom)", () => {
    const slots = buildSlots(6, 20);
    const { container } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const items = container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBeLessThan(slots.length);
  });

  it("centres the visible window on the selected/current slot", () => {
    const slots = buildSlots(6, 20);
    const { getByLabelText } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    // The current slot (week 07) must always be present in the rendered window.
    expect(getByLabelText(/W07 — Current/)).toBeInTheDocument();
  });

  it("keeps the scroll container's own overflow contained (min-w-0, overflow-x-auto, never page width)", () => {
    const slots = buildSlots(2, 8);
    const { getByRole } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    expect(list.className).toContain("min-w-0");
    expect(list.className).toContain("max-w-full");
    expect(list.className).toContain("overflow-x-auto");
  });

  it("renders every slot when the season is shorter than the visible window", () => {
    const slots = buildSlots(1, 3);
    const { container } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const items = container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(3);
  });

  it("invokes onSelect with the primary round id for an interactive slot", () => {
    const slots = buildSlots(1, 3);
    const onSelect = vi.fn();
    const { getByLabelText } = render(<LeagueSeasonRail slots={slots} onSelect={onSelect} />);
    fireEvent.click(getByLabelText(/W02 — Current/));
    expect(onSelect).toHaveBeenCalledWith("r1");
  });
});
