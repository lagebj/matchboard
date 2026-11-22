import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C07EmptyPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C07EmptyPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C07-EMPTY no useful hypothesis", () => {
  it("retains the existing operational composition unchanged", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 9.")).toBeInTheDocument();
  });

  it("manufactures no generic AI advice and reserves no empty insight section", () => {
    renderPage();
    expect(screen.queryByText(/assistant coach/i)).not.toBeInTheDocument();
    expect(screen.queryByText("AI Advisor")).not.toBeInTheDocument();
  });
});
