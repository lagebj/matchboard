import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchScoreRow, MatchCard, MatchHeader } from "../match-presentation";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

const scheduled = buildMatchPresentation({
  id: "m1",
  teamName: "Slemmestad Hvit",
  opponentName: "ROS",
  isHome: true,
  kickoffAt: new Date("2026-09-12T17:30:00"),
  lifecycleStatus: "planning_open",
  planningAttention: { label: "2 decisions", tone: "warning" },
});

const finalHomeWin = buildMatchPresentation({
  id: "m2",
  teamName: "Slemmestad Rød",
  opponentName: "Heggedal",
  isHome: true,
  kickoffAt: new Date("2026-09-12T17:30:00"),
  lifecycleStatus: "done",
  ownGoals: 3,
  opponentGoals: 2,
  outcome: "WON",
});

const finalAwayWin = buildMatchPresentation({
  id: "m3",
  teamName: "Slemmestad Rød",
  opponentName: "Heggedal",
  isHome: false,
  kickoffAt: new Date("2026-09-12T17:30:00"),
  lifecycleStatus: "done",
  ownGoals: 3,
  opponentGoals: 1,
  outcome: "WON",
});

const live = buildMatchPresentation({
  id: "m4",
  teamName: "Slemmestad Rød",
  opponentName: "Heggedal",
  isHome: true,
  lifecycleStatus: "live",
  ownGoals: 2,
  opponentGoals: 1,
  liveClockLabel: "37′",
});

const cancelled = buildMatchPresentation({
  id: "m5",
  teamName: "Slemmestad Blå",
  opponentName: "Asker",
  isHome: true,
  lifecycleStatus: "cancelled",
  cancelledReason: "Pitch frozen",
});

describe("buildMatchPresentation", () => {
  it("keeps football home/away order and re-orients an away win to home:away", () => {
    expect(finalAwayWin.homeTeam).toBe("Heggedal");
    expect(finalAwayWin.awayTeam).toBe("Slemmestad Rød");
    expect(finalAwayWin.score).toEqual({ home: 1, away: 3 });
    expect(finalAwayWin.ownTeamSide).toBe("away");
  });

  it("marks the own team side for a home match", () => {
    expect(finalHomeWin.ownTeamSide).toBe("home");
    expect(finalHomeWin.score).toEqual({ home: 3, away: 2 });
  });

  it("never produces a score for a cancelled match", () => {
    expect(cancelled.score).toBeNull();
  });
});

describe("MatchScoreRow", () => {
  it("scheduled: kickoff time in the value lane, no score, attention on the status line", () => {
    render(<MatchScoreRow presentation={scheduled} />);
    expect(screen.getByText("Slemmestad Hvit")).toBeTruthy();
    expect(screen.getByText("ROS")).toBeTruthy();
    expect(screen.getByText("17:30")).toBeTruthy();
    expect(screen.queryByText(/^\d+ : \d+$/)).toBeNull();
    expect(screen.getByText("2 decisions")).toBeTruthy();
  });

  it("final: home value then away value, FT + outcome on the status line", () => {
    render(<MatchScoreRow presentation={finalHomeWin} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("FT · WON")).toBeTruthy();
  });

  it("live: score values and a LIVE marker with the clock", () => {
    render(<MatchScoreRow presentation={live} />);
    expect(screen.getByText("LIVE · 37′")).toBeTruthy();
  });

  it("cancelled: em dash values, CANCELLED, reason line", () => {
    render(<MatchScoreRow presentation={cancelled} />);
    expect(screen.getByText("CANCELLED")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.getByText("Pitch frozen")).toBeTruthy();
  });

  it("inTimeline: a scheduled row does not repeat the kickoff time (the rail owns it)", () => {
    render(<MatchScoreRow presentation={scheduled} inTimeline />);
    expect(screen.queryByText("17:30")).toBeNull();
    // The planning attention still reads on the status line.
    expect(screen.getByText("2 decisions")).toBeTruthy();
  });
});

describe("MatchCard", () => {
  it("shows a date/time eyebrow, teams, and a dominant action slot", () => {
    render(
      <MatchCard
        presentation={scheduled}
        attentionDetail="2 decisions need attention"
        action={<button type="button">Open Round Board</button>}
      />,
    );
    expect(screen.getByText(/12 SEP.* · 17:30/)).toBeTruthy();
    expect(screen.getByText("Planning open")).toBeTruthy();
    expect(screen.getByText("2 decisions need attention")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Round Board" })).toBeTruthy();
  });
});

describe("MatchHeader", () => {
  it("renders the match identity and a back affordance", () => {
    render(<MatchHeader presentation={live} backHref="/fixtures" backLabel="League" />);
    expect(screen.getByRole("link", { name: /League/ })).toBeTruthy();
    expect(screen.getAllByText("Slemmestad Rød").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LIVE · 37′/).length).toBeGreaterThan(0);
  });
});
