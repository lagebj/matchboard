import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C07StalePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C07StalePage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C07-STALE outdated context", () => {
  it("falls back to normal Today behavior rather than presenting stale advice as current", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 9.")).toBeInTheDocument();
    expect(screen.queryByText(/Assistant Coach hypothes/)).not.toBeInTheDocument();
  });

  it("reuses the real freshness-fallback presentation, never a new staleness mechanism", () => {
    renderPage();
    expect(screen.getByText("Plan changed · Advisor update pending")).toBeInTheDocument();
  });
});
