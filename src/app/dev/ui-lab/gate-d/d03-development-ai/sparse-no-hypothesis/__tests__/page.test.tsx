import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D03SparsePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D03SparsePage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D03 sparse evidence, no defensible hypothesis", () => {
  it("renders the honest no-hypothesis state, not a silently empty section", () => {
    renderPage();
    expect(screen.getByText("No defensible hypothesis")).toBeInTheDocument();
    expect(screen.getByText(/does not have enough comparable evidence yet/)).toBeInTheDocument();
  });

  it("never fabricates generic advice to fill the space", () => {
    renderPage();
    expect(screen.queryByText(/we recommend|you should focus on|try to improve/i)).not.toBeInTheDocument();
  });

  it("states the open coaching question and the real available facts", () => {
    renderPage();
    expect(screen.getByText(/What does the available evidence tell us about Leah's development so far\?/)).toBeInTheDocument();
    expect(screen.getByText(/1 recorded appearance \(11 Oct 2026 vs Grorud\)/)).toBeInTheDocument();
  });

  it("renders no Assistant Coach promote/dismiss controls — there is nothing to confirm", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /promote to development focus/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^dismiss$/i })).not.toBeInTheDocument();
  });
});
