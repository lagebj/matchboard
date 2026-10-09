import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import DeclaredOnlyVersusEvidencedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <DeclaredOnlyVersusEvidencedPage />
    </ThemeProvider>,
  );
}

describe("A04-S6 declared-only-versus-evidenced page", () => {
  it("Case A shows the declaration with no invented actual minutes or derived ability", () => {
    renderPage();
    expect(screen.getByText("Case A — Declared only")).toBeInTheDocument();
    expect(screen.getByText("Declared primary: CM")).toBeInTheDocument();
    expect(screen.getByText(/no actual match interval exists/i)).toBeInTheDocument();
  });

  it("Case B shows the declaration and the 30-minute/1-match evidence as two separate facts", () => {
    renderPage();
    expect(screen.getByText("Case B — Declared and evidenced")).toBeInTheDocument();
    expect(screen.getByText("Declared primary: CM — separately, 30 recorded minutes across 1 distinct match")).toBeInTheDocument();
  });

  it("never auto-promotes evidence to a declared primary/secondary/tertiary", () => {
    renderPage();
    expect(screen.getByTestId("s6-no-promotion-note").textContent).toMatch(/is ever automatically promoted/i);
  });

  it("opens Case A's inspector to exactly the declaration source, and Case B's to declaration + both intervals", () => {
    mockViewport(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /inspect declaration source/i }));
    expect(screen.getAllByTestId("source-record-row")).toHaveLength(1);
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: /inspect declaration and evidence sources/i }));
    expect(screen.getAllByTestId("source-record-row")).toHaveLength(3); // declaration + LCM + RCM
  });
});
