import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AssignReserveDeniedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AssignReserveDeniedPage />
    </ThemeProvider>,
  );
}

describe("A07-S3 assign-reserve-denied page", () => {
  it("opens, selects, previews, confirms, and resolves to a permission-denied banner", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    expect(screen.getByText("Saving… (fixture simulation)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText("You do not have lineup edit access for this team's planning group.")).toBeInTheDocument();
  });

  it("the pitch still shows 6 assignments (RCM empty) after the denial — authoritative state untouched", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).queryByText("Tobias")).not.toBeInTheDocument();
  });

  it("the draft stays selected/visible after denial for inspection", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
  });

  describe("PENDING blocks closing; PERMISSION_DENIED then requires an explicit discard confirmation", () => {
    it("Close is blocked while PENDING (no prompt); once resolved to PERMISSION_DENIED, Close asks for discard confirmation instead of closing immediately", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
      fireEvent.click(screen.getByTestId("lineup-candidate-row"));
      fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));

      // Blocked while PENDING: no prompt, dialog stays open, draft/status untouched.
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByText("Saving… (fixture simulation)")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
      expect(screen.getByText("Permission denied")).toBeInTheDocument();

      // Now resolved: a draft still exists, so Close requires an explicit discard confirmation —
      // never a silent close, never a silent re-resolve.
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument(); // still open until confirmed
      fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
