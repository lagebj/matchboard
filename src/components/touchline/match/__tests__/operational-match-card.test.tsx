import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationalMatchCard } from "../operational-match-card";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

describe("OperationalMatchCard", () => {
  it("never claims RESULT for a report_incomplete (draft) match, even though its draft score stays visible", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "report_incomplete",
      ownGoals: 3,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<OperationalMatchCard presentation={presentation} />);
    expect(screen.getByText("3 : 1")).toBeInTheDocument();
    expect(screen.queryByText("RESULT")).not.toBeInTheDocument();
  });

  it("shows RESULT and the real score for a done match", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "done",
      ownGoals: 3,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<OperationalMatchCard presentation={presentation} />);
    expect(screen.getByText("RESULT")).toBeInTheDocument();
    expect(screen.getByText("3 : 1")).toBeInTheDocument();
  });
});
