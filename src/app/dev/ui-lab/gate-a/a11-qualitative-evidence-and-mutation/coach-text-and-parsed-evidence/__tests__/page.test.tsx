import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A11CoachTextAndParsedEvidencePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A11CoachTextAndParsedEvidencePage />
    </ThemeProvider>,
  );
}

describe("A11-coach-text-and-parsed-evidence page", () => {
  it("shows the original coach note, labelled as coach-authored", () => {
    renderPage();
    expect(screen.getByText("Coach-authored observation")).toBeInTheDocument();
    expect(screen.getByText(/looked composed receiving the ball in deeper midfield today/)).toBeInTheDocument();
  });

  it("shows each parsed observation as a distinct card, distinguishing explicit from tentative", () => {
    renderPage();
    const cards = screen.getAllByTestId("extracted-observation-card");
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Explicit claim").length).toBeGreaterThan(0);
    expect(screen.getByText("Tentative claim")).toBeInTheDocument();
  });

  it("never claims the extraction was an inference — caption says parsing, not inference", () => {
    renderPage();
    expect(screen.getByTestId("fixture-simulation-caption").textContent).toMatch(/Parsing, not inference/);
  });
});
