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
  it("Case A shows the declaration as COMPLETE and the actual exposure as a separate NOT_RECORDED claim", () => {
    renderPage();
    expect(screen.getByText("Case A — Declared only")).toBeInTheDocument();
    const declaredPrimaries = screen.getAllByText("Declared primary: CM");
    expect(declaredPrimaries).toHaveLength(2); // Case A and Case B each show their own
    expect(screen.getByText("Actual match exposure: Not recorded")).toBeInTheDocument();

    const badges = screen.getAllByTestId("coverage-badge");
    expect(badges.some((b) => b.textContent === "Complete")).toBe(true);
    expect(badges.some((b) => b.textContent === "Not recorded")).toBe(true);
  });

  it("Case B shows the declaration and the 30-minute/1-match evidence as two separate panels", () => {
    renderPage();
    expect(screen.getByText("Case B — Declared and evidenced")).toBeInTheDocument();
    expect(screen.getByText("CM: 30 recorded minutes, 1 distinct match")).toBeInTheDocument();
  });

  it("never auto-promotes evidence to a declared primary/secondary/tertiary", () => {
    renderPage();
    expect(screen.getByTestId("s6-no-promotion-note").textContent).toMatch(/is ever automatically promoted/i);
  });

  describe("independent review round 1 (PR #778, findings R2/R3): each of the four claims has its own scoped inspector", () => {
    it("Case A's declaration inspector shows only the declaration record", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect case a declaration source/i }));
      expect(screen.getAllByTestId("source-record-row")).toHaveLength(1);
      fireEvent.keyDown(document, { key: "Escape" });
    });

    it("Case A's exposure-check inspector shows only the exposure-absence record, coverage NOT_RECORDED", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect case a exposure-check source/i }));
      const rows = screen.getAllByTestId("source-record-row");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveAttribute("data-source-id");
      fireEvent.keyDown(document, { key: "Escape" });
    });

    it("Case B's declaration inspector is scoped separately from Case B's evidence inspector", () => {
      mockViewport(true);
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /inspect case b declaration source/i }));
      expect(screen.getAllByTestId("source-record-row")).toHaveLength(1);
      fireEvent.keyDown(document, { key: "Escape" });

      fireEvent.click(screen.getByRole("button", { name: /inspect case b evidence sources/i }));
      expect(screen.getAllByTestId("source-record-row")).toHaveLength(2); // LCM + RCM, no declaration
    });
  });
});
