import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A08OffPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A08OffPage />
    </ThemeProvider>,
  );
}

describe("A08-off page", () => {
  it("renders no assistant-coach-slot container at all — no reserved gap", () => {
    renderPage();
    expect(screen.queryByTestId("assistant-coach-slot")).not.toBeInTheDocument();
  });

  it("deterministic Match Insights is unaffected", () => {
    renderPage();
    expect(screen.getByText(/RCM is unfilled in the current plan/)).toBeInTheDocument();
  });
});
