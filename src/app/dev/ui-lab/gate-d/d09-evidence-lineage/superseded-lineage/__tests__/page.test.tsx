import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D09SupersededLineagePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D09SupersededLineagePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D09 superseded lineage", () => {
  it("preserves the original statement's wording verbatim rather than rewriting it", () => {
    renderPage();
    expect(screen.getByText("First touch was inconsistent under pressure in the second half.")).toBeInTheDocument();
  });

  it("marks the original as Superseded and the resubmission as Active", () => {
    renderPage();
    expect(screen.getByText("Superseded")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the active version's tentative wording distinctly from the superseded explicit one", () => {
    renderPage();
    expect(screen.getByText(/though it was a wet pitch/)).toBeInTheDocument();
    expect(screen.getByText("Tentative")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => (element?.tagName === "SPAN" && !!element.textContent?.startsWith("Explicit")) ?? false),
    ).toBeInTheDocument();
  });
});
