import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A08OnNoInsightPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A08OnNoInsightPage />
    </ThemeProvider>,
  );
}

describe("A08-on-no-insight page", () => {
  it("renders the assistant-coach-slot container with an honest quiet notice — no filler, no fabricated card", () => {
    renderPage();
    const slot = screen.getByTestId("assistant-coach-slot");
    expect(slot).toContainElement(screen.getByTestId("assistant-coach-no-pattern"));
    expect(screen.queryByTestId("assistant-coach-hypothesis-card")).not.toBeInTheDocument();
  });
});
