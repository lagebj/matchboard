import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A05UnavailablePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A05UnavailablePage />
    </ThemeProvider>,
  );
}

describe("A05-unavailable page", () => {
  it("shows a restrained unavailable notice, never a fabricated hypothesis card", () => {
    renderPage();
    expect(screen.getByTestId("assistant-coach-unavailable")).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.queryByTestId("assistant-coach-hypothesis-card")).not.toBeInTheDocument();
  });

  it("deterministic Match Insights facts remain current and no infrastructure error leaks", () => {
    renderPage();
    expect(screen.getByText(/RCM is unfilled in the current plan/)).toBeInTheDocument();
    expect(screen.queryByText(/prompt|token|api key|stack trace/i)).not.toBeInTheDocument();
  });
});
