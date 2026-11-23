import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D07AutomaticNonMaterialPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D07AutomaticNonMaterialPage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D07 automatic non-material change", () => {
  it("renders the attribute change as Evidence engine (AUTOMATIC), not a pending approval", () => {
    renderPage();
    expect(screen.getByText("Evidence engine")).toBeInTheDocument();
    expect(screen.queryByText(/approval required/i)).not.toBeInTheDocument();
  });

  it("shows the real before→after values", () => {
    renderPage();
    expect(screen.getByText("6 → 7")).toBeInTheDocument();
  });

  it("shows the attribute key and evidence basis", () => {
    renderPage();
    expect(screen.getByText("passing")).toBeInTheDocument();
    expect(screen.getByText(/4 matches, confidence 0.82/)).toBeInTheDocument();
  });
});
