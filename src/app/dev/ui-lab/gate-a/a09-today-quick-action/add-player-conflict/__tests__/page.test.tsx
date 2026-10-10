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
});
