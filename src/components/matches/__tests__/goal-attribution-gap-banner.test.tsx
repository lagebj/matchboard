import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalAttributionGapBanner } from "../goal-attribution-gap-banner";

describe("GoalAttributionGapBanner (2026-09-17 incident follow-up)", () => {
  it("renders nothing when gap is null (never live-reported, or nothing left to compare)", () => {
    render(<GoalAttributionGapBanner gap={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no gap", () => {
    render(<GoalAttributionGapBanner gap={{ liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns with the exact counts and how many are missing — the incident's exact shape (10 recorded, 0 attributed)", () => {
    render(<GoalAttributionGapBanner gap={{ liveGoalsRecorded: 10, attributedGoals: 0, hasGap: true }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("10 goals were recorded during live reporting");
    expect(alert).toHaveTextContent("only 0 have a scorer in this report");
    expect(alert).toHaveTextContent("10 goals are missing scorer attribution");
  });

  it("uses singular phrasing for a single missing goal", () => {
    render(<GoalAttributionGapBanner gap={{ liveGoalsRecorded: 2, attributedGoals: 1, hasGap: true }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("2 goals were recorded during live reporting");
    expect(alert).toHaveTextContent("only 1 has a scorer in this report");
    expect(alert).toHaveTextContent("1 goal is missing scorer attribution");
  });
});
