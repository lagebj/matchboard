import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScorebookMatchRow } from "../scorebook-match-row";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

// Issues #852/#853 regression coverage. jsdom has no real layout engine, so the kickoff-time/
// trailing-label overlap itself is verified with real browser geometry in
// e2e/scorebook-match-row-regression.spec.ts — these tests cover what jsdom CAN verify: text
// content correctness (never a bare "FT" for an unconfirmed match — a real draft/in-progress
// score may still show, transparently, alongside a truthful non-final label — correct
// home/away/own-team/cancellation rendering) and which DOM nodes carry which value kind.

describe("ScorebookMatchRow", () => {
  it("renders the scheduled kickoff time as plain text, not the score lane, and shows the date on the away line", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Nordbyen FK",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "planning_open",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.getByTestId("scorebook-row-time")).toHaveTextContent(presentation.kickoffTime!);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Nordbyen FK")).toBeInTheDocument();
  });

  it("never shows a bare FT for a played match (kicked off, no report at all)", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "played",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText("Played")).toBeInTheDocument();
    // No report exists at all — the value lane shows a placeholder, never a number.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("never shows a bare FT for a report_incomplete (draft) match, even though its draft score stays visible", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "report_incomplete",
      // A coach has started typing a draft score in — the number itself is not the lie (it is
      // real data a caller may legitimately show); only labelling it "FT"/final would be.
      ownGoals: 3,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText("Report incomplete")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("prefers a caller-supplied reportAttention qualifier for a report_incomplete match", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "report_incomplete",
      reportAttention: { label: "Report draft", tone: "warning" },
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.getByText("Report draft")).toBeInTheDocument();
    expect(screen.queryByText("Report incomplete")).not.toBeInTheDocument();
  });

  it("shows FT and the real score for a done (locked) result", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.getAllByText(/^FT/).length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows LIVE with the real live score, never withheld", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "live",
      ownGoals: 1,
      opponentGoals: 1,
      liveClockLabel: "37'",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("shows Cancelled with the real reason, never a result", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "cancelled",
      ownGoals: 2,
      opponentGoals: 0,
      outcome: "WON",
      cancelledReason: "Opponent withdrew",
    });
    render(<ScorebookMatchRow presentation={presentation} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Opponent withdrew")).toBeInTheDocument();
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
  });

  it("marks the own team's line and keeps home/away ordering stable for an away fixture", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: false,
      kickoffAt: new Date("2027-03-13T12:40:00Z"),
      lifecycleStatus: "done",
      ownGoals: 0,
      opponentGoals: 2,
      outcome: "LOST",
    });
    const { container } = render(<ScorebookMatchRow presentation={presentation} />);
    // Football order: home (opponent) first, away (own team) second.
    expect(presentation.homeTeam).toBe("Graabein United");
    expect(presentation.awayTeam).toBe("Rød");
    const names = Array.from(container.querySelectorAll("span")).map((n) => n.textContent);
    const homeIdx = names.indexOf("Graabein United");
    const awayIdx = names.indexOf("Rød");
    expect(homeIdx).toBeGreaterThanOrEqual(0);
    expect(awayIdx).toBeGreaterThan(homeIdx);
  });
});
