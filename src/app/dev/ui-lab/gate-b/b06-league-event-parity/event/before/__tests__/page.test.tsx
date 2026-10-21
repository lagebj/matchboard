import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06EventBeforePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B06EventBeforePage />
    </ThemeProvider>,
  );
}

describe("B06 Event · Before page", () => {
  it("discloses this is a design proposal, not a production route", () => {
    renderPage();
    expect(screen.getByText("Design proposal, not a production route")).toBeInTheDocument();
  });

  it("shows the Event and Squad context the League candidate has no equivalent for", () => {
    renderPage();
    expect(screen.getByText("Lillomarka Sommerturnering")).toBeInTheDocument();
    expect(screen.getAllByText(/Slemmestad Rød — Cup Squad/).length).toBeGreaterThan(0);
  });

  it("renders a helper (amber H badge) and a guest player badge, distinct from squad players", () => {
    renderPage();
    expect(screen.getByText(/Jonas/)).toBeInTheDocument();
    expect(screen.getByText(/William \(Guest\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Guest").length).toBeGreaterThan(0);
  });

  it("the comparison nav marks Event · Before as the active stop", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Event · Before" })).toHaveAttribute("aria-current", "page");
  });
});
