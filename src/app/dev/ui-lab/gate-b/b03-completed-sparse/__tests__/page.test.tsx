import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B03CompletedSparsePage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B03CompletedSparsePage />
    </ThemeProvider>,
  );
}

describe("B03 completed-sparse page", () => {
  it("shows the final result separately from the partial recorded chronology", () => {
    renderPage();
    expect(screen.getByText("6-4")).toBeInTheDocument();
    expect(screen.getByText("1 recorded event")).toBeInTheDocument();
  });

  it("never fabricates a chronology matching the full scoreline", () => {
    renderPage();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/only 1 individual event was logged/i);
  });

  it("omits the 'What this match added' panel entirely when nothing genuinely qualifies — no empty padded section", () => {
    renderPage();
    expect(screen.queryByText("What this match added")).not.toBeInTheDocument();
  });
});
