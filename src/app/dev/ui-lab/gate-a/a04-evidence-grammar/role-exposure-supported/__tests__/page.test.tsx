import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import RoleExposureSupportedPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <RoleExposureSupportedPage />
    </ThemeProvider>,
  );
}

/**
 * A04-S3 permits only a descriptive comparison (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`: "Forbidden:
 * faster development, higher skill, better performance, causal coaching improvement, or claims
 * about unobserved matches").
 */
describe("A04-S3 role-exposure-supported page", () => {
  it("states the permitted descriptive conclusion with the real computed totals", () => {
    renderPage();
    expect(screen.getByText("Recorded CM exposure was higher in the latest three matches in this sample")).toBeInTheDocument();
    expect(screen.getByText("37 → 67 min")).toBeInTheDocument();
    expect(screen.getByText("Prior 3 matches vs latest 3 matches")).toBeInTheDocument();
  });

  it("shows exactly which matches belong to each window", () => {
    renderPage();
    const prior = screen.getByTestId("s3-prior-window");
    const latest = screen.getByTestId("s3-latest-window");
    expect(prior.textContent).toMatch(/Match 21/);
    expect(prior.textContent).toMatch(/Match 23/);
    expect(latest.textContent).toMatch(/Match 24/);
    expect(latest.textContent).toMatch(/Match 26/);
  });

  it("never uses forbidden causal/skill/development language", () => {
    renderPage();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/faster development|higher skill|better performance|causal|coaching improvement/i);
  });

  it("never implies a universal six-match sufficiency rule", () => {
    renderPage();
    expect(screen.getByText(/not a universal six-match sufficiency rule/i)).toBeInTheDocument();
  });
});
