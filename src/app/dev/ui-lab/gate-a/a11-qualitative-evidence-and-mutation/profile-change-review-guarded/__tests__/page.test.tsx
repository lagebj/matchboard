import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A11ProfileChangeReviewGuardedPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A11ProfileChangeReviewGuardedPage />
    </ThemeProvider>,
  );
}

describe("A11-profile-change-review-guarded page", () => {
  it("shows the before/after diff, evidence, and never-silent disclaimer before any decision", () => {
    renderPage();
    expect(screen.getByTestId("profile-change-diff").textContent).toMatch(/DM → CM/);
    expect(screen.getByText(/never changes the player's declared primary position on its own/)).toBeInTheDocument();
  });

  it("offers Accept, Reject, and Defer — three distinct outcomes, not a binary apply", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Accept change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer" })).toBeInTheDocument();
  });

  it("accepting is a simulated, local-only outcome — no real write", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Accept change" }));
    const outcome = screen.getByTestId("profile-change-outcome");
    expect(outcome.textContent).toMatch(/Accepted \(simulated\)/);
    expect(outcome.textContent).toMatch(/No real provider or database write occurred/);
  });
});
