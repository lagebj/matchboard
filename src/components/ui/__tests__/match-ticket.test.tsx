import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MatchTicket } from "../match-ticket";

describe("MatchTicket", () => {
  it("scheduled: shows both teams and the kickoff time, no score", () => {
    render(
      <MatchTicket
        teamName="Slemmestad Hvit"
        opponentName="ROS"
        isHome
        lifecycleStatus="planning_open"
        kickoffTimeLabel="17:30"
        dateLabel="SAT 12 SEP"
      />,
    );
    expect(screen.getByText("Slemmestad Hvit")).toBeTruthy();
    expect(screen.getByText("ROS")).toBeTruthy();
    expect(screen.getByText("17:30")).toBeTruthy();
    // A rendered score looks like "3 : 2" (spaces around the colon); the kickoff time "17:30" does not.
    expect(screen.queryByText(/^\d+ : \d+$/)).toBeNull();
  });

  it("final home win: home team is on the left and reads home:away order", () => {
    const { container } = render(
      <MatchTicket
        teamName="Slemmestad Rød"
        opponentName="Heggedal"
        isHome
        lifecycleStatus="done"
        homeScore={3}
        awayScore={2}
        result="win"
        outcomeLabel="WON"
      />,
    );
    const row = container.querySelector("div.flex.items-center.gap-2") as HTMLElement;
    const sides = within(row).getAllByText(/Slemmestad Rød|Heggedal/);
    // Left side first in DOM order = home = our team.
    expect(sides[0].textContent).toBe("Slemmestad Rød");
    expect(screen.getByText("3 : 2")).toBeTruthy();
    expect(screen.getByText("FT · WON")).toBeTruthy();
  });

  it("final away win: score is oriented home:away, our team is on the right and marked the winner", () => {
    const { container } = render(
      <MatchTicket
        teamName="Slemmestad Rød"
        opponentName="Heggedal"
        isHome={false}
        lifecycleStatus="done"
        // home = Heggedal scored 1, away = us scored 3
        homeScore={1}
        awayScore={3}
        result="win"
        outcomeLabel="WON"
      />,
    );
    const row = container.querySelector("div.flex.items-center.gap-2") as HTMLElement;
    const names = within(row).getAllByText(/Slemmestad Rød|Heggedal/);
    // Home (Heggedal) is rendered first / on the left; our away team is second / on the right.
    expect(names[0].textContent).toBe("Heggedal");
    expect(names[1].textContent).toBe("Slemmestad Rød");
    // Score reads home:away, not our-relative — 1 : 3, never 3 : 1.
    expect(screen.getByText("1 : 3")).toBeTruthy();
    expect(screen.queryByText("3 : 1")).toBeNull();
    // Non-colour winner cue: the winning (away) side name is bold, the losing side is dimmed.
    expect(names[1].className).toContain("font-semibold");
    expect(names[0].closest("div")?.className).toContain("opacity-55");
  });

  it("live: shows the score and a LIVE marker with the clock", () => {
    render(
      <MatchTicket
        teamName="Slemmestad Rød"
        opponentName="Heggedal"
        isHome
        lifecycleStatus="live"
        homeScore={2}
        awayScore={1}
        liveClockLabel="37′"
      />,
    );
    expect(screen.getByText("2 : 1")).toBeTruthy();
    expect(screen.getByText("LIVE · 37′")).toBeTruthy();
  });
});
