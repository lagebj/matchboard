import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C07ErrorPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C07ErrorPage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C07-ERROR capability failure", () => {
  it("continues normal Today functionality, operational priorities unchanged", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("Available and active, but not assigned to any match in Round 9.")).toBeInTheDocument();
  });

  it("shows a proportionate, non-dominating error — no false insight, no retry control", () => {
    renderPage();
    expect(screen.getByText(/Assistant Coach analysis is unavailable right now/)).toBeInTheDocument();
    expect(screen.getByText(/Your match report and evidence are saved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Assistant Coach hypothes/)).not.toBeInTheDocument();
  });
});
