import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchTimelineList } from "../match-timeline-list";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

function item(overrides: Partial<MatchTimelineItem>): MatchTimelineItem {
  return {
    id: "e1",
    kind: "GOAL_FOR",
    minuteLabel: "12'",
    playerName: "Emil",
    assistPlayerName: null,
    secondaryPlayerName: null,
    sourceIsCanonicalLiveEvent: true,
    ...overrides,
  };
}

describe("MatchTimelineList", () => {
  it("shows an empty state when there are no events", () => {
    render(<MatchTimelineList items={[]} ownTeamName="Hvit" opponentName="Huringen" />);
    expect(screen.getByText("No recorded events yet.")).toBeInTheDocument();
  });

  it("shows the assist only when the item explicitly carries one — never inferred", () => {
    render(
      <MatchTimelineList
        items={[item({ id: "g1", assistPlayerName: "Noah" }), item({ id: "g2", playerName: "Elias", assistPlayerName: null })]}
        ownTeamName="Hvit"
        opponentName="Huringen"
      />,
    );
    expect(screen.getByText("Emil · Assist: Noah")).toBeInTheDocument();
    expect(screen.getByText("Elias")).toBeInTheDocument();
    expect(screen.queryByText(/Elias · Assist/)).not.toBeInTheDocument();
  });

  it("labels an unattributed goal explicitly rather than dropping it", () => {
    render(<MatchTimelineList items={[item({ playerName: null })]} ownTeamName="Hvit" opponentName="Huringen" />);
    expect(screen.getByText("Unattributed")).toBeInTheDocument();
  });

  it("attributes the goal to the correct side", () => {
    render(
      <MatchTimelineList
        items={[item({ id: "g1", kind: "GOAL_FOR" }), item({ id: "g2", kind: "GOAL_AGAINST", playerName: null })]}
        ownTeamName="Hvit"
        opponentName="Huringen"
      />,
    );
    expect(screen.getByText("Goal · Hvit")).toBeInTheDocument();
    expect(screen.getByText("Goal · Huringen")).toBeInTheDocument();
  });

  it("respects the limit prop", () => {
    render(
      <MatchTimelineList
        items={[item({ id: "g1" }), item({ id: "g2" }), item({ id: "g3" })]}
        ownTeamName="Hvit"
        opponentName="Huringen"
        limit={2}
      />,
    );
    expect(screen.getAllByText(/Goal · Hvit/)).toHaveLength(2);
  });
});
