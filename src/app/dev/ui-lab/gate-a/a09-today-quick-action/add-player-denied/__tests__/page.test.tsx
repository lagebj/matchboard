import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AddPlayerDeniedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AddPlayerDeniedPage />
    </ThemeProvider>,
  );
}

describe("A09-S2 add-player-denied page", () => {
  it("shows the denial reason, disables the candidate row, and never allows a draft/preview or count change", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");

    const row = within(dialog).getByTestId("today-candidate-row");
    expect(row).toBeDisabled();
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByText(/do not have group access/i)).toBeInTheDocument();

    fireEvent.click(row); // disabled — no-op
    expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/);

    const confirmButton = within(dialog).getByRole("button", { name: "Add player" });
    expect(confirmButton).toBeDisabled();
  });
});
