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

// `total` weeks, `currentIndex` is CURRENT/selected, everything else EMPTY — mirrors a full-season
// rail with one active round somewhere in the timeline.
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

/** Stubs the scroll metrics jsdom does not implement, so boundary logic can be exercised. */
function mockScrollMetrics(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(el, "scrollLeft", { value: scrollLeft, configurable: true, writable: true });
}

describe("LeagueSeasonRail — full timeline rendering and containment", () => {
  it("renders every slot in the season — the full timeline is always in the DOM", () => {
    const slots = buildSlots(6, 20);
    const { container } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const items = container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(20);
  });

  it("keeps the scroll viewport contained (min-w-0, overflow-x-auto, never page width) and hides the native scrollbar", () => {
    const slots = buildSlots(2, 8);
    const { getByRole } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    expect(list.className).toContain("min-w-0");
    expect(list.className).toContain("max-w-full");
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).toContain("[scrollbar-width:none]");
    expect(list.className).toContain("[&::-webkit-scrollbar]:hidden");
  });

  it("keeps the selected/current slot present regardless of season length", () => {
    const slots = buildSlots(6, 20);
    const { getByLabelText } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    expect(getByLabelText(/W07 — Current/)).toBeInTheDocument();
  });

  it("invokes onSelect with the primary round id for an interactive slot", () => {
    const slots = buildSlots(1, 3);
    const onSelect = vi.fn();
    const { getByLabelText } = render(<LeagueSeasonRail slots={slots} onSelect={onSelect} />);
    fireEvent.click(getByLabelText(/W02 — Current/));
    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  it("keeps empty weeks non-interactive", () => {
    const slots = buildSlots(1, 3);
    const { container } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const disabled = container.querySelectorAll('[role="listitem"][aria-disabled="true"]');
    expect(disabled.length).toBe(2);
    disabled.forEach((el) => expect(el.querySelector("button")).toBeNull());
  });

  it("renders exactly one continuous connector element, not one per slot", () => {
    const slots = buildSlots(6, 20);
    const { getAllByTestId } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    expect(getAllByTestId("league-season-connector")).toHaveLength(1);
  });

  it("gives the selected/current slot a stable focusable button ref usable for auto-centring", () => {
    const slots = buildSlots(6, 20);
    const { getByLabelText } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const active = getByLabelText(/W07 — Current/);
    expect(active.tagName).toBe("BUTTON");
  });
});

describe("LeagueSeasonRail — desktop wheel winding", () => {
  it("moves scrollLeft and prevents default when the rail can still move in that direction", () => {
    const slots = buildSlots(6, 20);
    const { getByRole } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 100 });

    const event = new WheelEvent("wheel", { deltaY: 50, deltaX: 0, cancelable: true });
    list.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(list.scrollLeft).toBe(150);
  });

  it("does not prevent default at the right boundary — page scroll continues", () => {
    const slots = buildSlots(6, 20);
    const { getByRole } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 1500 });

    const event = new WheelEvent("wheel", { deltaY: 50, deltaX: 0, cancelable: true });
    list.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("does not prevent default at the left boundary for upward/left wheel", () => {
    const slots = buildSlots(6, 20);
    const { getByRole } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 0 });

    const event = new WheelEvent("wheel", { deltaY: -50, deltaX: 0, cancelable: true });
    list.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe("LeagueSeasonRail — overflow affordance", () => {
  it("hides the left fade and shows the right fade at the start of an overflowing rail", () => {
    const slots = buildSlots(6, 20);
    const { getByRole, getByTestId } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 0 });
    fireEvent.scroll(list);

    expect(getByTestId("league-season-edge-fade-left").className).toContain("opacity-0");
    expect(getByTestId("league-season-edge-fade-right").className).toContain("opacity-100");
  });

  it("shows both fades in the middle of an overflowing rail", () => {
    const slots = buildSlots(6, 20);
    const { getByRole, getByTestId } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 750 });
    fireEvent.scroll(list);

    expect(getByTestId("league-season-edge-fade-left").className).toContain("opacity-100");
    expect(getByTestId("league-season-edge-fade-right").className).toContain("opacity-100");
  });

  it("hides the right fade at the end of the rail", () => {
    const slots = buildSlots(6, 20);
    const { getByRole, getByTestId } = render(<LeagueSeasonRail slots={slots} onSelect={() => {}} />);
    const list = getByRole("list");
    mockScrollMetrics(list, { scrollWidth: 2000, clientWidth: 500, scrollLeft: 1500 });
    fireEvent.scroll(list);

    expect(getByTestId("league-season-edge-fade-right").className).toContain("opacity-0");
  });
});
