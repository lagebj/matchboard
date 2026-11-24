import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D09AmbiguousReferenceRejectedPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D09AmbiguousReferenceRejectedPage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D09 ambiguous reference rejected", () => {
  it("shows the submitted text and the rejection reason", () => {
    renderPage();
    expect(screen.getByText(/He was really strong in the second half/)).toBeInTheDocument();
    expect(screen.getByText(/discarded entirely rather than attributed to a guess/)).toBeInTheDocument();
  });

  it("reports zero resulting observations — no phantom rating from an unresolvable reference", () => {
    renderPage();
    expect(screen.getByTestId("observation-count")).toHaveTextContent("Resulting observations created: 0");
  });
});
