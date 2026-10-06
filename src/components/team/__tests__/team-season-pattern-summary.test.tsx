import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamSeasonPatternSummary } from "../team-season-pattern-summary";
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

describe("TeamSeasonPatternSummary", () => {
  it("renders nothing when there are no patterns", () => {
    const { container } = render(<TeamSeasonPatternSummary patterns={[]} viewPatternsHref="/teams/t1?tab=patterns" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders up to 3 pattern cards with title, evidence sentence, and confidence badge", () => {
    render(
      <TeamSeasonPatternSummary
        patterns={[
          view(),
          view({ key: "p2", title: "Late concessions", evidenceSentence: "4 of 8 recorded goals against came in the closing phase across 5 matches.", confidenceLabel: "Emerging pattern" }),
        ]}
        viewPatternsHref="/teams/t1?tab=patterns"
      />,
    );
    expect(screen.getByText("Strong starts")).toBeTruthy();
    expect(screen.getByText("Late concessions")).toBeTruthy();
    expect(screen.getByText(view().evidenceSentence)).toBeTruthy();
    expect(screen.getByText("4 of 8 recorded goals against came in the closing phase across 5 matches.")).toBeTruthy();
    expect(screen.getByText("Established pattern")).toBeTruthy();
    expect(screen.getByText("Emerging pattern")).toBeTruthy();
  });

  it("links the 'View patterns' action to the supplied href", () => {
    render(<TeamSeasonPatternSummary patterns={[view()]} viewPatternsHref="/teams/t1?periodId=s1&tab=patterns" />);
    const link = screen.getByRole("link", { name: /view patterns/i });
    expect(link.getAttribute("href")).toBe("/teams/t1?periodId=s1&tab=patterns");
  });
});
