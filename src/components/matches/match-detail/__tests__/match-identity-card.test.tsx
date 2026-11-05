import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MatchIdentityCard } from "../match-identity-card";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

// Narrow-width correction, two passes (maintenance fix, independent of PR #811/B07 — see that
// PR's SOURCE_RECONCILIATION.md for the full history). The component now renders TWO complete,
// always-present compositions — a compact 2-row grid (`medium:hidden`) and the original medium+
// single-row flex (`hidden medium:flex`) — exactly one visible at a time via CSS. Because BOTH
// exist in the DOM simultaneously, most content (team names, the score, the status line) appears
// twice here; tests that care which composition a piece of text is in scope their queries to that
// composition's own container rather than using a bare `getByText` (which would throw on finding
// two matches).
//
// jsdom has no real layout engine (getBoundingClientRect/computed wrapping/line-clamp are not
// meaningfully testable here) — these tests cover what jsdom CAN verify: text content correctness
// (crucially, that team names are NEVER cut mid-name — no `truncate`/fixed-max-width class on the
// compact names, which is the actual contract this second pass exists to enforce), state-specific
// rendering, and which composition each piece of markup belongs to. The real "stays on one line /
// wraps instead of clipping / both teams visibly distinguishable" guarantee is verified against
// actual browser screenshots from the ui-lab-visual-review.yml CI capture — see this fix's own PR
// description for the captured evidence, including same-club-suffix team pairs.
function getCompositions(container: HTMLElement) {
  const compact = container.querySelector(".grid.grid-cols-\\[minmax\\(0\\,1fr\\)_auto_minmax\\(0\\,1fr\\)\\]");
  const desktop = container.querySelector(".hidden.items-center.justify-center");
  if (!compact || !desktop) throw new Error("expected both compact and medium+ compositions to be present");
  return { compact: compact as HTMLElement, desktop: desktop as HTMLElement };
}

describe("MatchIdentityCard", () => {
  it("never shows a fake 0-0 before kickoff — shows an em dash instead, in both compositions", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("0 - 0")).not.toBeInTheDocument();
  });

  it("shows the real score once one exists, in both compositions", () => {
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
    expect(screen.getAllByText("2 - 10")).toHaveLength(2);
    expect(screen.getAllByText("FT")).toHaveLength(2);
  });

  it("renders both team names, in both compositions", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getAllByText("Hvit")).toHaveLength(2);
    expect(screen.getAllByText("Huringen 1")).toHaveLength(2);
  });

  it("the compact composition's score carries whitespace-nowrap — never wraps at narrow widths", () => {
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
    const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    const { compact } = getCompositions(container);
    const score = within(compact).getByText("10 - 2");
    expect(score.className).toMatch(/whitespace-nowrap/);
  });

  it("live match: score and live clock label both render in both compositions", () => {
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
    expect(screen.getAllByText("1 - 0")).toHaveLength(2);
    expect(screen.getAllByText("37′")).toHaveLength(2);
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
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByText("Cancelled")).toHaveLength(2);
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
    expect(screen.getAllByText("2 - 10")).toHaveLength(2);
  });

  describe("compact composition — team identity must never be truncated away (second-pass regression)", () => {
    it("long team names render in full — no truncate class, no fixed max-width clamp on the compact names", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Idrettslaget Framtidens Håp og Ære",
        opponentName: "Sportsklubben Nedre Eiker og Omegn Fotball",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "planning_open",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { compact } = getCompositions(container);
      const home = within(compact).getByText("Idrettslaget Framtidens Håp og Ære");
      const away = within(compact).getByText("Sportsklubben Nedre Eiker og Omegn Fotball");
      // NEGATIVE regression: the first pass's fixed max-w-[4.5rem]/truncate classes must not
      // reappear on the compact names — that combination is exactly what silently cut names down
      // to "Slemme…"/"Spikkest…", the defect this second pass exists to fix.
      expect(home.className).not.toMatch(/truncate/);
      expect(home.className).not.toMatch(/max-w-\[4\.5rem\]/);
      expect(away.className).not.toMatch(/truncate/);
      // The only bound on an extreme name is a 2-line clamp, not single-line truncation.
      expect(home.className).toMatch(/line-clamp-2/);
      expect(away.className).toMatch(/line-clamp-2/);
    });

    it("same-club suffix pairs are both fully readable and distinguishable — Slemmestad Rød vs Slemmestad Hvit", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Slemmestad Rød",
        opponentName: "Slemmestad Hvit",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "planning_open",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { compact } = getCompositions(container);
      // Both full names present, verbatim, as their own complete text nodes — not sharing a
      // truncated common "Slemmestad" prefix that would make the two indistinguishable.
      expect(within(compact).getByText("Slemmestad Rød")).toBeInTheDocument();
      expect(within(compact).getByText("Slemmestad Hvit")).toBeInTheDocument();
      expect(within(compact).queryByText("Slemme…")).not.toBeInTheDocument();
    });

    it("same-club suffix pairs — Slemmestad Rød vs Slemmestad Blå", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Slemmestad Rød",
        opponentName: "Slemmestad Blå",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "planning_open",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { compact } = getCompositions(container);
      expect(within(compact).getByText("Slemmestad Rød")).toBeInTheDocument();
      expect(within(compact).getByText("Slemmestad Blå")).toBeInTheDocument();
    });

    it("the real B07 pairing — Slemmestad Rød vs Spikkestad IL — both render in full", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Slemmestad Rød",
        opponentName: "Spikkestad IL",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "planning_open",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { compact } = getCompositions(container);
      expect(within(compact).getByText("Slemmestad Rød")).toBeInTheDocument();
      expect(within(compact).getByText("Spikkestad IL")).toBeInTheDocument();
    });

    it("the score and both kit marks sit in row 1 (grid), the names and status sit in row 2", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Hvit",
        opponentName: "Huringen 1",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "done",
        ownGoals: 3,
        opponentGoals: 1,
        outcome: "WON",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { compact } = getCompositions(container);
      // Six direct grid children: home-kit, score, away-kit, home-name, status, away-name.
      expect(compact.children).toHaveLength(6);
      const kits = within(compact).getAllByRole("img");
      expect(kits).toHaveLength(2);
    });
  });

  describe("medium+ composition — byte-identical to the pre-fix component", () => {
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
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} size="lg" />);
      const { desktop } = getCompositions(container);
      const score = within(desktop).getByText("2 - 1");
      expect(score.className).toMatch(/text-\[40px\]/);
    });

    it("long team names still truncate at a single line — the original, unchanged desktop contract", () => {
      const presentation = buildMatchPresentation({
        id: "m1",
        teamName: "Idrettslaget Framtidens Håp og Ære",
        opponentName: "Sportsklubben Nedre Eiker og Omegn Fotball",
        isHome: true,
        kickoffAt: new Date("2026-09-23T18:00:00"),
        lifecycleStatus: "planning_open",
      });
      const { container } = render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
      const { desktop } = getCompositions(container);
      const home = within(desktop).getByText("Idrettslaget Framtidens Håp og Ære");
      expect(home.className).toMatch(/truncate/);
      expect(home.className).toMatch(/max-w-\[9rem\]/);
    });
  });

  it("each kit mark is rendered once per composition (twice total), each with the correct accessible name", () => {
    const presentation = buildMatchPresentation({
      id: "m1",
      teamName: "Hvit",
      opponentName: "Huringen 1",
      isHome: true,
      kickoffAt: new Date("2026-09-23T18:00:00"),
      lifecycleStatus: "planning_open",
    });
    render(<MatchIdentityCard presentation={presentation} ownKitColor={null} />);
    expect(screen.getAllByRole("img", { name: "Hvit kit" })).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Huringen 1 kit" })).toHaveLength(2);
  });
});
