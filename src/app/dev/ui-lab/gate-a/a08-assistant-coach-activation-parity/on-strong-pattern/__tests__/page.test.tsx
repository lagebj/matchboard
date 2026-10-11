import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A08OnStrongPatternPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A08OnStrongPatternPage />
    </ThemeProvider>,
  );
}

describe("A08-on-strong-pattern page", () => {
  it("renders the assistant-coach-slot container with a conspicuous hypothesis card inside it — no filler", () => {
    renderPage();
    const slot = screen.getByTestId("assistant-coach-slot");
    expect(slot).toContainElement(screen.getByTestId("assistant-coach-hypothesis-card"));
    expect(screen.getByText("Assistant Coach hypothesis")).toBeInTheDocument();
  });
});
