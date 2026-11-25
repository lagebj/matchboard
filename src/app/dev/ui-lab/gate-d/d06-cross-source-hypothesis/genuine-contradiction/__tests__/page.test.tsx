import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D06ContradictionPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D06ContradictionPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D06 genuine cross-source contradiction", () => {
  it("renders both contradicting sources, neither hidden nor silently resolved", () => {
    renderPage();
    expect(screen.getAllByText("Coach assessment, 20 Sep 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Coach observation, 11 Oct 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it("the panel's own Contradicting line lists both disagreeing sources", () => {
    renderPage();
    expect(screen.getByText(/Contradicting: Coach assessment, 20 Sep 2026, Coach observation, 11 Oct 2026/)).toBeInTheDocument();
  });

  it("the source inspector resolves the earlier assessment's own real text", async () => {
    renderPage();
    const details = screen.getByText("Coach assessment, 20 Sep 2026").closest("details");
    expect(details).not.toBeNull();
    expect(details).toHaveTextContent(/needs another full season at right-back/);
  });
});
