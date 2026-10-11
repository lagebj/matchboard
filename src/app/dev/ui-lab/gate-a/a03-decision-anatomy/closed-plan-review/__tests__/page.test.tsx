import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A03ClosedPlanReviewPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A03ClosedPlanReviewPage />
    </ThemeProvider>,
  );
}

describe("A03-S2 closed-plan-review page", () => {
  it("has no editable/active Save, Resolve, or Assign control anywhere on the page", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /assign|save|resolve/i })).not.toBeInTheDocument();
  });

  it("'Review plan' is the only control, and it is read-only (toggles an explanation, no mutation)", () => {
    renderPage();
    const reviewButton = screen.getByRole("button", { name: "Review plan" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(reviewButton);
    expect(screen.getByTestId("review-panel")).toHaveTextContent(/planning closed when the match kicked off/i);
  });

  it("never implies an exception is possible", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review plan" }));
    expect(screen.queryByText(/exception/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/override/i)).not.toBeInTheDocument();
  });
});
