import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C08AfterAvailabilityChangePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C08AfterAvailabilityChangePage />
    </ThemeProvider>,
  );
}

describe("Gate C W3 — C08-B tentative availability (supplementary — not an RSVP deadline)", () => {
  it("discloses that this is not an RSVP-deadline demonstration", () => {
    renderPage();
    expect(screen.getByText(/Matchboard has no RSVP-deadline mechanism/)).toBeInTheDocument();
  });

  it("still surfaces the decision (availability does not silently remove it) but withholds the one-click action", () => {
    renderPage();
    expect(screen.getByText("Tentative")).toBeInTheDocument();
    expect(screen.getByText("CURRENT SITUATION")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Mia Berg/i })).not.toBeInTheDocument();
  });

  it("names the specific availability reason, never conflated with a planning-closed message", () => {
    renderPage();
    expect(screen.getByText("Player availability is tentative — review before assigning.")).toBeInTheDocument();
    expect(screen.queryByText(/planning is closed/i)).not.toBeInTheDocument();
  });

  it("keeps the legitimate review workflow (Round Board) reachable", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Review in Round Board/i })).toBeInTheDocument();
  });
});
