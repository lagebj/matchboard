import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AddPlayerConflictPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AddPlayerConflictPage />
    </ThemeProvider>,
  );
}

describe("A09-S5 add-player-conflict page", () => {
  it("resolves to a CONFLICT banner, never a duplicate add, and preserves the draft for a discard", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));

    expect(within(dialog).getByText("Already a participant — recheck match")).toBeInTheDocument();
    expect(within(dialog).getByText(/already added by another coach/i)).toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/); // no duplicate add

    fireEvent.click(within(dialog).getByRole("button", { name: "Discard draft" }));
    expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
  });

  it("closing and reopening after a CONFLICT starts a clean new session — no stale conflict banner, count unchanged (regression: close() previously left the draft and operation status stuck)", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
    expect(within(dialog).getByText("Already a participant — recheck match")).toBeInTheDocument();

    // CONFLICT retains the draft, so close requests the discard-confirmation prompt.
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Already a participant — recheck match")).not.toBeInTheDocument();
    expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("today-candidate-row")).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/); // no duplicate add, ever
  });

  it("Close is blocked while PENDING (no prompt); once resolved to CONFLICT, Close asks for discard confirmation instead of closing immediately", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByTestId("today-candidate-row"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add player" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // blocked — still PENDING
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Saving… (fixture simulation)")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue fixture simulation →" }));
    expect(within(dialog).getByText("Already a participant — recheck match")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
