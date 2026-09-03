import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpponentTacticalTendencySection } from "../opponent-tactical-tendency-section";
import type { OpponentTacticalTendency, OpponentTendencyOutcome } from "@/lib/opponents/playing-style-aggregation";

function makeTendency(overrides: Partial<OpponentTacticalTendency> = {}): OpponentTacticalTendency {
  return {
    opponentTeamId: "opp1",
    tag: "HIGH_PRESSING",
    occurrences: 4,
    confidence: "ESTABLISHED",
    firstObservedAt: new Date("2026-01-01"),
    lastObservedAt: new Date("2026-04-01"),
    sourceMatchIds: ["m1", "m2", "m3", "m4"],
    ...overrides,
  };
}

describe("OpponentTacticalTendencySection", () => {
  it("shows a human label, not the raw enum", () => {
    render(<OpponentTacticalTendencySection tendencies={[makeTendency()]} outcomes={[]} />);
    expect(screen.getByText("High pressing")).toBeTruthy();
    expect(screen.queryByText("HIGH_PRESSING")).toBeNull();
  });

  it("excludes INSUFFICIENT-confidence tendencies from the shown list", () => {
    render(
      <OpponentTacticalTendencySection
        tendencies={[makeTendency({ tag: "DIRECT_PLAY", confidence: "INSUFFICIENT", occurrences: 1 })]}
        outcomes={[]}
      />,
    );
    expect(screen.queryByText("Direct play")).toBeNull();
    expect(screen.getByText(/Not enough observations recorded yet/)).toBeTruthy();
  });

  it("shows the confidence label for a shown tendency", () => {
    render(<OpponentTacticalTendencySection tendencies={[makeTendency({ confidence: "EMERGING" })]} outcomes={[]} />);
    expect(screen.getByText(/Emerging/)).toBeTruthy();
  });

  it("shows the factual outcome sentence when one exists for the tag", () => {
    const outcome: OpponentTendencyOutcome = { tag: "HIGH_PRESSING", matchCount: 4, goalsFor: 5, goalsAgainst: 3 };
    render(<OpponentTacticalTendencySection tendencies={[makeTendency()]} outcomes={[outcome]} />);
    expect(screen.getByText(/5 goals for and 3 against/)).toBeTruthy();
  });

  it("does not show an outcome sentence when none exists for the tag", () => {
    render(<OpponentTacticalTendencySection tendencies={[makeTendency()]} outcomes={[]} />);
    expect(screen.queryByText(/goals for/)).toBeNull();
  });

  it("never claims certainty language like 'always'", () => {
    render(<OpponentTacticalTendencySection tendencies={[makeTendency()]} outcomes={[]} />);
    expect(screen.queryByText(/always/i)).toBeNull();
  });
});
