import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScoreHeader } from "../match-score-header";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

// Issue #853 regression: MatchScoreHeader is the Match Details page header ("Match headers |
// Final-state truth" in the cross-surface audit) — a DRAFT report filled in before kickoff has
// passed must never render as a confirmed "FT" result.
describe("MatchScoreHeader", () => {
  it("never shows FT for a played match (kicked off, no report)", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "played",
    });
    render(<MatchScoreHeader presentation={presentation} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText("Played")).toBeInTheDocument();
  });

  it("never shows FT for a report_incomplete match, even though its draft score stays visible", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "report_incomplete",
      ownGoals: 2,
      opponentGoals: 0,
      outcome: "WON",
    });
    render(<MatchScoreHeader presentation={presentation} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText("Report incomplete")).toBeInTheDocument();
    expect(screen.getByText("2 : 0")).toBeInTheDocument();
  });

  it("shows FT and the real score for a done result", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 0,
      outcome: "WON",
    });
    render(<MatchScoreHeader presentation={presentation} />);
    expect(screen.getByText(/^FT/)).toBeInTheDocument();
    expect(screen.getByText("2 : 0")).toBeInTheDocument();
  });
});
