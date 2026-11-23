import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D02SparseEvidencePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D02SparseEvidencePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 — D02 sparse evidence", () => {
  it("renders the real insufficient-evidence state for every sparse story, never a fabricated confidence", () => {
    renderPage();
    const insufficientEvidenceLabels = screen.getAllByText("Not enough evidence yet");
    expect(insufficientEvidenceLabels).toHaveLength(3);
    expect(screen.queryByText("Established")).not.toBeInTheDocument();
    expect(screen.queryByText("Emerging")).not.toBeInTheDocument();
  });

  it("omits the Match context group entirely rather than rendering a fabricated empty-data card", () => {
    renderPage();
    expect(screen.queryByText("Match context")).not.toBeInTheDocument();
  });

  it("still renders the Opportunity and Position groups, with their sparse-but-real sample sizes", () => {
    renderPage();
    // Each group label text appears twice (group header + EvidenceStory's own internal label).
    expect(screen.getAllByText("Opportunity")).toHaveLength(2);
    expect(screen.getByText("1 eligible round")).toBeInTheDocument();
    expect(screen.getAllByText("Position")).toHaveLength(2);
    expect(screen.getByText("1 match with recorded actual position")).toBeInTheDocument();
  });
});
