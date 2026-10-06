import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { TeamPatternsTab, type TeamPatternsTabData } from "../team-patterns-tab";
import type { PatternViewModel } from "@/lib/team-season-profile/presentation";

function view(overrides: Partial<PatternViewModel> = {}): PatternViewModel {
  return {
    key: "p1",
    family: "MATCH_RHYTHM",
    title: "Strong starts",
    evidenceSentence: "5 of 11 recorded goals came in the opening phase across 6 matches.",
    secondarySentence: null,
    sampleLine: "6 matches",
    confidenceLabel: "Established pattern",
    trajectoryLabel: "Persistent",
    tone: "POSITIVE",
    approximateTiming: false,
    playerIds: [],
    isCombination: false,
    ...overrides,
  };
}

function baseData(overrides: Partial<TeamPatternsTabData> = {}): TeamPatternsTabData {
  return {
    seasonLabel: "Fall 2026",
    completedMatches: 6,
    hasApproximateTiming: false,
    strongest: [],
    rhythm: [],
    themes: [],
    playerContributions: [],
    combinations: [],
    weeklyExcerpt: null,
    ...overrides,
  };
}

function renderWithOrg(ui: React.ReactElement) {
  return render(<OrgSlugProvider orgSlug="test-org">{ui}</OrgSlugProvider>);
}

describe("TeamPatternsTab", () => {
  it("shows the zero-completed-matches empty state", () => {
    renderWithOrg(<TeamPatternsTab data={baseData({ completedMatches: 0 })} />);
    expect(screen.getByText("No completed matches in this season")).toBeTruthy();
  });

  it("shows the sparse-evidence state when there are completed matches but no surfaceable pattern", () => {
    renderWithOrg(<TeamPatternsTab data={baseData({ completedMatches: 2 })} />);
    expect(screen.getByText("Season patterns will appear as completed-match evidence builds.")).toBeTruthy();
  });

  it("does not render a family section that has no patterns", () => {
    renderWithOrg(<TeamPatternsTab data={baseData({ rhythm: [view()] })} />);
    expect(screen.getByText("Match rhythm")).toBeTruthy();
    expect(screen.queryByText("Tactical themes")).toBeNull();
    expect(screen.queryByText("Player contributions")).toBeNull();
    expect(screen.queryByText("Combinations")).toBeNull();
  });

  it("renders the strongest-patterns section when provided", () => {
    renderWithOrg(<TeamPatternsTab data={baseData({ strongest: [view()], rhythm: [view()] })} />);
    expect(screen.getByText("Strongest patterns")).toBeTruthy();
  });

  it("shows the association-not-causation note only for the combinations section", () => {
    renderWithOrg(
      <TeamPatternsTab
        data={baseData({
          rhythm: [view()],
          combinations: [view({ key: "c1", family: "COMBINATION", title: "Right corridor · Noah, Emil", isCombination: true })],
        })}
      />,
    );
    expect(screen.getByText("Association, not causation.")).toBeTruthy();
  });

  it("links a single-player contribution card's title to Player Detail", () => {
    renderWithOrg(
      <TeamPatternsTab
        data={baseData({
          playerContributions: [view({ key: "pc1", family: "PLAYER_CONTRIBUTION", title: "Noah · Goals", playerIds: ["player-1"] })],
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "Noah · Goals" });
    expect(link.getAttribute("href")).toBe("/o/test-org/players/player-1");
  });

  it("shows an approximate-timing note at the season level when any pattern carries it", () => {
    renderWithOrg(<TeamPatternsTab data={baseData({ rhythm: [view()], hasApproximateTiming: true })} />);
    expect(screen.getByText("Some timing is approximate.")).toBeTruthy();
  });
});
