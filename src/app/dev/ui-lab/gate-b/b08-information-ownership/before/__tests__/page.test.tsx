import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B08BeforePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B08BeforePage />
    </ThemeProvider>,
  );
}

describe("B08 Before page", () => {
  it("has exactly one h1 and the B08 scenario navigator", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "B08 scenario navigator" })).toBeInTheDocument();
  });

  it("marks 'before' as the current stage in the scenario navigator, exposed to assistive tech (not color-only)", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "B08 scenario navigator" });
    const current = screen.getByRole("link", { name: "Before", current: "page" });
    expect(nav).toContainElement(current);
    for (const label of ["Live", "After", "Report · Draft", "Report · Completed"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  it("'Start live reporting' is a real working link into this candidate's own LIVE route", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Start live reporting/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b08-information-ownership/live",
    );
  });

  it("shows no post-match chronology or completed-report information", () => {
    renderPage();
    expect(screen.queryByText(/Final score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Locked/i)).not.toBeInTheDocument();
  });

  it("has no inert or fake navigation controls (no href=\"#\")", () => {
    const { container } = renderPage();
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href")).not.toBe("#");
    }
  });
});
