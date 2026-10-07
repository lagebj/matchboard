import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { completedMatchFixture } from "../fixtures";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { WhatThisMatchAddedPanel } from "@/components/matches/match-detail/what-this-match-added-panel";

/**
 * ADR-0157 C9 — the Completed Match golden-state fixture renders the real production C6 panels
 * against deterministic data. Locks in that the fixture's data flows through the real pure
 * builders and the panels' factual-only composition (`08_COMPLETED_MATCH.md`).
 */
describe("Completed Match golden-state fixture (ADR-0157 C9)", () => {
  it("derives a trustworthy match-flow chronology from the fixture timeline", () => {
    expect(completedMatchFixture.matchFlow.trustworthy).toBe(true);
    expect(completedMatchFixture.matchFlow.points.length).toBeGreaterThan(0);
    // Goals only, in order, never interpolated.
    const goalPoints = completedMatchFixture.matchFlow.points.filter(
      (p) => p.kind === "GOAL_FOR" || p.kind === "GOAL_AGAINST",
    );
    expect(goalPoints.map((p) => p.kind)).toEqual([
      "GOAL_FOR",
      "GOAL_AGAINST",
      "GOAL_FOR",
      "GOAL_FOR",
    ]);
  });

  it("builds shape-change rows only from real position-only changes", () => {
    expect(completedMatchFixture.shapeChangeRows).toHaveLength(1);
    expect(completedMatchFixture.shapeChangeRows[0].changes[0]).toMatchObject({
      playerName: "Emil Johansen",
      fromPosition: "CM",
      toPosition: "RB",
    });
  });

  it("renders the panels with factual content and no momentum language", () => {
    const { container } = render(
      <>
        <MatchFlowPanel
          timeline={completedMatchFixture.timeline}
          ownTeamName={completedMatchFixture.ownTeamName}
          opponentName={completedMatchFixture.opponentName}
        />
        <MatchTimelineList
          items={completedMatchFixture.timeline}
          ownTeamName={completedMatchFixture.ownTeamName}
          opponentName={completedMatchFixture.opponentName}
        />
        <WhatThisMatchAddedPanel input={completedMatchFixture.whatThisMatchAddedInput} />
      </>,
    );

    expect(screen.getByText("Match flow")).toBeInTheDocument();
    expect(screen.getByText(/cumulative score by event, in order/i)).toBeInTheDocument();
    expect(screen.getByText("What this match added")).toBeInTheDocument();
    // The "what this match added" rows come from the real builder: first-time positions.
    expect(screen.getByText(/Mathias Øie recorded their first minutes at CM this season/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/momentum|player of the match/i);
  });
});