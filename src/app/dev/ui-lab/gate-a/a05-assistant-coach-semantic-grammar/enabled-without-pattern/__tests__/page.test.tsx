import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A05EnabledWithoutPatternPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A05EnabledWithoutPatternPage />
    </ThemeProvider>,
  );
}

describe("A05-enabled-without-pattern page", () => {
  it("shows an honest quiet notice, never a fabricated hypothesis card", () => {
    renderPage();
    expect(screen.getByTestId("assistant-coach-no-pattern")).toHaveTextContent(/no useful pattern/i);
    expect(screen.queryByTestId("assistant-coach-hypothesis-card")).not.toBeInTheDocument();
  });

  it("is distinguishable from the disabled state by its explicit quiet notice", () => {
    renderPage();
    expect(screen.getByText("Assistant Coach hypotheses")).toBeInTheDocument();
  });

  it("Match Insights deterministic facts remain present", () => {
    renderPage();
    expect(screen.getByText(/RCM is unfilled in the current plan/)).toBeInTheDocument();
  });
});
