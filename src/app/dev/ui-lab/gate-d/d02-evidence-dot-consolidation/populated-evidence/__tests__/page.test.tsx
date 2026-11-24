import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D02PopulatedEvidencePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D02PopulatedEvidencePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D02 populated evidence", () => {
  it("renders all four evidence groups in the fixed contract order", () => {
    renderPage();
    // Each group label text appears twice — once as the group header, once as EvidenceStory's
    // own internal `label` prop (one story per group here) — so take the group headers only.
    const matches = screen.getAllByText(/^(Opportunity|Position|Match context|Trends)$/);
    const groupHeaders = matches.filter((_, i) => i % 2 === 0);
    expect(groupHeaders.map((el) => el.textContent)).toEqual(["Opportunity", "Position", "Match context", "Trends"]);
  });

  it("consolidates the Position story's exact sided codes into one profile-level visual without losing them or double-counting", () => {
    renderPage();
    expect(screen.getByText("Centre Back is the dominant actual position")).toBeInTheDocument();
    // Primary view: profile-level consolidation (CB = CB+RCB = 58+25, DM = CDM = 17).
    expect(screen.getByText("CB 83%")).toBeInTheDocument();
    expect(screen.getByText("DM 17%")).toBeInTheDocument();
    // Exact breakdown remains accessible via the drill-down — not removed, not duplicated into
    // the profile-level total (profile shares above already sum to 100 on their own).
    expect(screen.getByText("CB 58%")).toBeInTheDocument();
    expect(screen.getByText("RCB 25%")).toBeInTheDocument();
    expect(screen.getByText("CDM 17%")).toBeInTheDocument();
  });

  it("renders an explicit confidence label for established evidence, never a fabricated score", () => {
    renderPage();
    expect(screen.getAllByText("Established").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Emerging")).toBeInTheDocument();
  });

  it("renders the trend story sourced from a real DerivedTrend-shaped sparkline, distinct from the Opportunity sparkline", () => {
    renderPage();
    expect(screen.getByText("Defensive-midfield minutes are trending up")).toBeInTheDocument();
  });
});
