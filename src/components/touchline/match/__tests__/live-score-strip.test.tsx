import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveScoreStrip } from "../live-score-strip";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

describe("LiveScoreStrip", () => {
  it("shows the real live score", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      lifecycleStatus: "live",
      ownGoals: 2,
      opponentGoals: 1,
      liveClockLabel: "60'",
    });
    render(<LiveScoreStrip presentation={presentation} />);
    expect(screen.getByText("2–1")).toBeInTheDocument();
  });

  it("never shows FT for a report_incomplete match, even though its draft score stays visible", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      lifecycleStatus: "report_incomplete",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<LiveScoreStrip presentation={presentation} />);
    expect(screen.queryByText("FT")).not.toBeInTheDocument();
    expect(screen.getByText("2–1")).toBeInTheDocument();
    expect(screen.getByText("Report incomplete")).toBeInTheDocument();
  });

  it("shows FT for a done result", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<LiveScoreStrip presentation={presentation} />);
    expect(screen.getByText("FT")).toBeInTheDocument();
  });
});
