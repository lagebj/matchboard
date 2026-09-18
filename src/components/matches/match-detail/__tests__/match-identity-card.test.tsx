import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchIdentityCard } from "../match-identity-card";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

describe("MatchIdentityCard", () => {
  it("never shows a fake 0-0 before kickoff — shows an em dash instead", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0 - 0")).not.toBeInTheDocument();
  });

  it("shows the real score once one exists", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Graabein City",
      isHome: false,
      kickoffAt: new Date("2026-09-16T18:00:00"),
      lifecycleStatus: "done",
      ownGoals: 10,
      opponentGoals: 2,
      outcome: "WON",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    // Away team (own side): home/away oriented score is "2 - 10".
    expect(screen.getByText("2 - 10")).toBeInTheDocument();
    expect(screen.getByText("FT")).toBeInTheDocument();
  });

  it("renders both team names", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getByText("Hvit")).toBeInTheDocument();
    expect(screen.getByText("Huringen 1")).toBeInTheDocument();
  });
});
