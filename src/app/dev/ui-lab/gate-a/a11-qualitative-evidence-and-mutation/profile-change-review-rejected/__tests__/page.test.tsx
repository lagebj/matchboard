import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A11ProfileChangeReviewRejectedPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A11ProfileChangeReviewRejectedPage />
    </ThemeProvider>,
  );
}

describe("A11-profile-change-review-rejected page", () => {
  it("rejecting leaves no change and no implicit write — explicit local-only outcome", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const outcome = screen.getByTestId("profile-change-outcome");
    expect(outcome.textContent).toMatch(/Rejected \(simulated\)/);
    expect(outcome.textContent).toMatch(/no change made/i);
  });

  it("deferring is a distinct third outcome from rejecting", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Defer" }));
    expect(screen.getByTestId("profile-change-outcome").textContent).toMatch(/Deferred \(simulated\)/);
  });
});
