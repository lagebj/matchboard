import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerInspector } from "../player-inspector";
import type { PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";

/**
 * Matchboard Players Operating Surface bundle, `02_ROUTE_COMPOSITION_AND_VISUAL_CONTRACT.md §6`:
 * the inspector is a preview, not a miniature Player Detail page — no tabs, no "Latest
 * observation" history feed, real effective-position entries always rendered honestly.
 */
function makeData(overrides: Partial<PlayersOverviewInspectorData> = {}): PlayersOverviewInspectorData {
  return {
    playerId: "p1",
    displayName: "Sander Berg",
    shirtNumber: 7,
    kitColor: null,
    coreTeamName: "U14 Lions",
    currentPrimaryPosition: "CM",
    currentPrimaryPositionFull: "Centre Midfield",
    availabilityLabel: "Available",
    opportunityLabel: "Selected this round",
    effectivePositions: [{ positionCode: "CM", positionLabel: "Centre Midfield", rank: 1, supportBand: "STRONG", confidence: "HIGH" }],
    played: 10,
    goals: 2,
    assists: 1,
    core: 8,
    support: 2,
    development: 0,
    activeDevelopmentFocus: null,
    playerDetailHref: "/o/acme/players/p1",
    ...overrides,
  };
}

describe("PlayerInspector", () => {
  it("renders a preview prompt with no data selected", () => {
    render(<PlayerInspector data={null} />);
    expect(screen.getByText("Select a player to preview their profile.")).toBeInTheDocument();
  });

  it("renders no tabs at all", () => {
    render(<PlayerInspector data={makeData()} />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("never renders a 'Latest observation' section (removed per contract)", () => {
    render(<PlayerInspector data={makeData()} />);
    expect(screen.queryByText("Latest observation")).not.toBeInTheDocument();
  });

  it("renders compact season metrics (Played/Goals/Support/Dev.)", () => {
    render(<PlayerInspector data={makeData({ played: 12, goals: 3, support: 4, development: 1 })} />);
    expect(screen.getByText("Played")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders a current-context section with opportunity, development focus and season usage", () => {
    render(<PlayerInspector data={makeData({ activeDevelopmentFocus: "First-touch under pressure", core: 8, support: 2, development: 0 })} />);
    expect(screen.getByText("Current context")).toBeInTheDocument();
    expect(screen.getByText("First-touch under pressure")).toBeInTheDocument();
    expect(screen.getByText(/Core 8 · Support 2 · Development 0/)).toBeInTheDocument();
  });

  it("omits the development-focus row entirely when there is no active focus (prefer omission over a negative state)", () => {
    render(<PlayerInspector data={makeData({ activeDevelopmentFocus: null })} />);
    expect(screen.queryByText("Development focus")).not.toBeInTheDocument();
  });

  it("pairs the full position label with its compact code in the identity line", () => {
    render(<PlayerInspector data={makeData({ currentPrimaryPosition: "W", currentPrimaryPositionFull: "Wing" })} />);
    expect(screen.getByText("Wing (W)")).toBeInTheDocument();
  });

  it("does not repeat itself when the compact and full labels coincide (broad codes)", () => {
    render(<PlayerInspector data={makeData({ currentPrimaryPosition: "Defender", currentPrimaryPositionFull: "Defender" })} />);
    expect(screen.getByText("Defender")).toBeInTheDocument();
    expect(screen.queryByText("Defender (Defender)")).not.toBeInTheDocument();
  });

  it("renders as one cohesive surface (a single outer widget region), not multiple stacked cards", () => {
    const { container } = render(<PlayerInspector data={makeData()} />);
    // The recomposed inspector is one outer TouchlineWidget; internal sections use hairline
    // dividers (`border-t`) rather than separate widget/card elements. Excludes `rounded-full`
    // (the compact pitch's small position-dot markers) — those are pitch chrome, not cards.
    const cardLikeElements = Array.from(container.querySelectorAll('[class*="rounded-"]')).filter(
      (el) => !el.className.includes("rounded-full"),
    );
    // Only the outer widget frame and the CTA button should carry rounded-card styling — not a
    // set of independently-bordered nested cards.
    expect(cardLikeElements.length).toBeLessThanOrEqual(2);
  });

  it("navigates to the canonical Player Detail route via 'Open player →'", () => {
    render(<PlayerInspector data={makeData({ playerDetailHref: "/o/acme/players/p1" })} />);
    const link = screen.getByRole("link", { name: /Open player/ });
    expect(link).toHaveAttribute("href", "/o/acme/players/p1");
  });
});
