import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A05DisabledPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A05DisabledPage />
    </ThemeProvider>,
  );
}

describe("A05-disabled page", () => {
  it("renders no Assistant Coach hypothesis section at all — no reserved gap", () => {
    renderPage();
    expect(screen.queryByTestId("assistant-coach-hypothesis-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Assistant Coach hypotheses")).not.toBeInTheDocument();
    expect(screen.queryByText(/Assistant Coach hypothesis/)).not.toBeInTheDocument();
  });

  it("Match Insights deterministic facts remain present and current", () => {
    renderPage();
    expect(screen.getByText("Match Insights")).toBeInTheDocument();
    expect(screen.getByText(/RCM is unfilled in the current plan/)).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updating insights/)).not.toBeInTheDocument();
  });
});
