import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  TrendSpark,
  DistributionBar,
  PeriodBars,
  RangeBand,
  DeltaMetric,
  MetricStory,
} from "../index";

describe("viz primitives — every primitive carries a text equivalent and no colour-only meaning", () => {
  it("TrendSpark: describes the series and its direction in words", () => {
    render(
      <TrendSpark
        question="Is match involvement changing over recent rounds?"
        values={[2, 3, 3, 5, 4]}
        sampleContext="Last 5 completed rounds"
      />,
    );
    const group = screen.getByRole("group", { name: /involvement changing/i });
    expect(within(group).getByText(/2, 3, 3, 5, 4/)).toBeInTheDocument();
    expect(within(group).getByText(/Latest 4, up from 2 at the start/)).toBeInTheDocument();
  });

  it("TrendSpark: degrades gracefully with fewer than two points", () => {
    render(<TrendSpark question="Trend?" values={[3]} />);
    expect(screen.getByText(/Not enough data to show a trend yet/)).toBeInTheDocument();
  });

  it("DistributionBar: lists each category with value and share, hides zero categories", () => {
    render(
      <DistributionBar
        question="How is role exposure split?"
        segments={[
          { label: "Core", value: 6 },
          { label: "Support", value: 2 },
          { label: "Development", value: 0 },
        ]}
        sampleContext="8 realised appearances"
      />,
    );
    const group = screen.getByRole("group", { name: /role exposure/i });
    expect(within(group).getByText(/Core: 6 \(75%\); Support: 2 \(25%\)/)).toBeInTheDocument();
    expect(within(group).queryByText(/Development/)).not.toBeInTheDocument();
  });

  it("PeriodBars: names each phase and its value in the text equivalent", () => {
    render(
      <PeriodBars
        question="When are goals conceded?"
        bars={[
          { label: "Opening 10", value: 1 },
          { label: "Final 10", value: 3 },
        ]}
      />,
    );
    expect(screen.getByText(/Opening 10: 1; Final 10: 3/)).toBeInTheDocument();
  });

  it("RangeBand: states position relative to a supplied range, using neutral wording", () => {
    render(
      <RangeBand
        question="Is squad size inside the usual range?"
        value={9}
        min={5}
        max={16}
        rangeLow={11}
        rangeHigh={14}
        sampleContext="Team's own finalised squads this season"
      />,
    );
    const group = screen.getByRole("group", { name: /squad size/i });
    expect(within(group).getByText(/Current value 9 is below range \(11 to 14\)/)).toBeInTheDocument();
    // Neutral vocabulary only.
    expect(within(group).queryByText(/good|bad|poor|weak|concern/i)).not.toBeInTheDocument();
  });

  it("DeltaMetric: carries direction with a glyph and a neutral word, not colour", () => {
    render(
      <DeltaMetric
        label="Minutes together"
        current={54}
        baseline={60}
        baselineLabel="vs last match"
        unit="min"
      />,
    );
    const group = screen.getByRole("group", { name: "Minutes together" });
    expect(within(group).getByText(/down by 6 min vs last match \(60 min\)/)).toBeInTheDocument();
    expect(within(group).getByText("▼")).toBeInTheDocument();
  });

  it("MetricStory: exposes the question as its accessible name and renders the interpretation", () => {
    render(
      <MetricStory
        question="How settled is this line-up?"
        label="Retained players"
        value={8}
        interpretation="Eight of eleven starters also started the previous round."
        sampleContext="2 rounds compared"
        detailHref="/o/x/insights/continuity"
      />,
    );
    const section = screen.getByRole("region", { name: /how settled is this line-up/i });
    expect(within(section).getByText(/Eight of eleven starters/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /Details/ })).toHaveAttribute(
      "href",
      "/o/x/insights/continuity",
    );
  });
});
