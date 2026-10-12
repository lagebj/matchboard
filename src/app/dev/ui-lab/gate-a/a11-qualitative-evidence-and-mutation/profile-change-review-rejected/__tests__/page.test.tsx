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
  it("rejecting leaves the real authoritative primary unchanged — message and state agree", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const outcome = screen.getByTestId("profile-change-outcome");
    expect(outcome.textContent).toMatch(/Rejected \(simulated\)/);
    expect(outcome.textContent).toMatch(/no change made/i);
    expect(screen.getByTestId("authoritative-primary-after")).toHaveTextContent("Declared primary (unchanged): DM");
  });

  it("deferring is a distinct third outcome from rejecting, also leaving the primary unchanged", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Defer" }));
    expect(screen.getByTestId("profile-change-outcome").textContent).toMatch(/Deferred \(simulated\)/);
    expect(screen.getByTestId("authoritative-primary-after")).toHaveTextContent("Declared primary (unchanged): DM");
  });

  it("no real provider or database write is claimed", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText(/No real provider or database write occurred/)).toBeInTheDocument();
  });
});
