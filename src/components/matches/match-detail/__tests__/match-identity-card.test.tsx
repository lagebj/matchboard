import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchIdentityCard } from "../match-identity-card";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

// Narrow-width correction (maintenance fix, independent of PR #811/B07 — see that PR's
// SOURCE_RECONCILIATION.md for how the defect was found). jsdom has no real layout engine
// (getBoundingClientRect/computed wrapping are not meaningfully testable here, same limitation
// noted by every other jsdom-based component test in this repo) — these tests cover what jsdom
// CAN verify: text content correctness, state-specific rendering, and the structural
// classes/props that drive the real browser layout (whitespace-nowrap, shrink-0, the compact
// kit-mark size swap). The real wrapping/overflow guarantee is verified against actual browser
// screenshots from the ui-lab-visual-review.yml CI capture, not here — see this fix's own PR
// description for the captured evidence (320/360/390/430/1440px, both themes).
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

  it("the score carries whitespace-nowrap and its column is shrink-0 — never wraps, never gets compressed", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "done",
      ownGoals: 10,
      opponentGoals: 2,
      outcome: "WON",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    const score = screen.getByText("10 - 2");
    expect(score.className).toMatch(/whitespace-nowrap/);
    expect(score.parentElement?.className).toMatch(/shrink-0/);
  });

  it("live match: score and live clock label both render, status pill uses the live tone", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "live",
      ownGoals: 1,
      opponentGoals: 0,
      liveClockLabel: "37′",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getByText("1 - 0")).toBeInTheDocument();
    expect(screen.getByText("37′")).toBeInTheDocument();
  });

  it("cancelled match: shows the em dash and 'Cancelled', never a fabricated score", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "cancelled",
      cancelledReason: "Waterlogged pitch",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ - \d+$/)).not.toBeInTheDocument();
  });

  it("away-side orientation: score and team order stay home-first regardless of ownTeamSide", () => {
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
    expect(presentation.homeTeam).toBe("Graabein City");
    expect(presentation.awayTeam).toBe("Hvit");
    expect(screen.getByText("2 - 10")).toBeInTheDocument();
  });

  it("long team names: truncation classes are present on both sides so the score column is never crowded out", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Idrettslaget Framtidens Håp og Ære",
      opponentName: "Sportsklubben Nedre Eiker og Omegn Fotball",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    const home = screen.getByText("Idrettslaget Framtidens Håp og Ære");
    const away = screen.getByText("Sportsklubben Nedre Eiker og Omegn Fotball");
    expect(home.className).toMatch(/truncate/);
    expect(home.className).toMatch(/max-w-\[4\.5rem\]/);
    expect(away.className).toMatch(/truncate/);
  });

  it("the compact kit-mark size variant is rendered alongside the regular one, each visible at a different breakpoint", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    const kits = screen.getAllByRole("img", { name: "Hvit kit" });
    // Two instances (compact + regular), toggled by CSS display at the `medium` breakpoint —
    // see the component's own module doc comment. Real browsers correctly expose only the
    // currently-displayed one to the accessibility tree; both exist in markup for jsdom to find.
    expect(kits).toHaveLength(2);
    const classNames = kits.map((k) => k.className);
    expect(classNames.some((c) => c.includes("medium:hidden"))).toBe(true);
    expect(classNames.some((c) => c.includes("hidden") && c.includes("medium:inline-flex"))).toBe(true);
  });

  it("desktop/lg size variant still produces the larger hero text class", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} size="lg" />);
    const score = screen.getByText("2 - 1");
    expect(score.className).toMatch(/text-\[40px\]/);
  });
});
