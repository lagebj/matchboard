import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchDetailHeader } from "../match-detail-header";

describe("MatchDetailHeader", () => {
  it("uses the existing canonical lifecycle wording, not a fabricated literal badge string", () => {
    render(
      <MatchDetailHeader
        breadcrumbLabel="Matches"
        breadcrumbHref="/o/test/fixtures"
        title="Hvit vs Huringen 1"
        lifecycleStatus="planning_open"
        metaLine="Wed 23 Sep 2026 · 18:00 · Home · League · 7-a-side"
      />,
    );
    expect(screen.getByText("Planning open")).toBeInTheDocument();
    expect(screen.queryByText("UPCOMING")).not.toBeInTheDocument();
  });

  it("shows the real done state, not a fabricated 'COMPLETED' string", () => {
    render(
      <MatchDetailHeader
        breadcrumbLabel="Matches"
        breadcrumbHref="/o/test/fixtures"
        title="Hvit vs Graabein City"
        lifecycleStatus="done"
        metaLine="Wed 16 Sep 2026 · 18:00 · Away · League · 7-a-side"
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
  });

  it("renders the match title and meta line", () => {
    render(
      <MatchDetailHeader
        breadcrumbLabel="Matches"
        breadcrumbHref="/o/test/fixtures"
        title="Hvit vs Huringen 1"
        lifecycleStatus="live"
        metaLine="Wed 23 Sep 2026 · 18:00 · Home · League · 7-a-side"
      />,
    );
    expect(screen.getByRole("heading", { name: "Hvit vs Huringen 1" })).toBeInTheDocument();
    expect(screen.getByText("Wed 23 Sep 2026 · 18:00 · Home · League · 7-a-side")).toBeInTheDocument();
  });
});
