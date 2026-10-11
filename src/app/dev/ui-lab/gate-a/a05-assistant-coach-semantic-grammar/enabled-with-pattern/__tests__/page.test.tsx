import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A05EnabledWithPatternPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A05EnabledWithPatternPage />
    </ThemeProvider>,
  );
}

describe("A05-enabled-with-pattern page", () => {
  it("shows the hypothesis card with evidence and uncertainty, labelled as a hypothesis not a fact", () => {
    renderPage();
    expect(screen.getByText("Assistant Coach hypothesis")).toBeInTheDocument();
    expect(screen.getByText("Medium uncertainty")).toBeInTheDocument();
    expect(screen.getByText(/never changes the player's record on its own/)).toBeInTheDocument();
    expect(screen.getByText(/Missing evidence:/)).toBeInTheDocument();
  });

  it("Match Insights shows the AI-sourced insight alongside deterministic facts", () => {
    renderPage();
    expect(screen.getByText(/Consider Tobias for the open RCM slot/)).toBeInTheDocument();
    expect(screen.getByText(/RCM is unfilled in the current plan/)).toBeInTheDocument();
  });

  it("promoting is a simulated, local-only outcome — no server call", () => {
    renderPage();
    const focusInput = screen.getByLabelText("Development focus to record if promoted");
    fireEvent.change(focusInput, { target: { value: "Composure under pressure" } });
    fireEvent.click(screen.getByRole("button", { name: "Promote to development focus" }));
    expect(screen.getByText(/Promoted to development focus \(simulated\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/No server called/).length).toBeGreaterThan(0);
  });

  it("dismissing is a simulated, local-only outcome", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByText(/Dismissed \(simulated\)/)).toBeInTheDocument();
  });
});
