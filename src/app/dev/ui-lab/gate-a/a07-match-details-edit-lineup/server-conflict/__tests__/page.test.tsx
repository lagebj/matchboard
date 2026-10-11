import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import ServerConflictPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <ServerConflictPage />
    </ThemeProvider>,
  );
}

describe("A07-S4 server-conflict page", () => {
  it("resolves to a conflict banner showing expected and current revisions, with no auto-merge", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    expect(screen.getByText("Server conflict — recheck before continuing")).toBeInTheDocument();
    expect(screen.getByText("Another coach already assigned Markus to RCM.")).toBeInTheDocument();
    expect(screen.getByText(/Expected revision lineup-rev-1, current revision lineup-rev-2/)).toBeInTheDocument();
  });

  it("the pitch still shows RCM empty after the conflict — no silent overwrite with the current server snapshot", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));

    const pitches = screen.getAllByTestId("touchline-planning-pitch");
    expect(within(pitches[0]).queryByText("Tobias")).not.toBeInTheDocument();
  });

  it("offers Discard draft after a conflict", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation →" }));
    // Both the body's own action row and the conflict banner render a "Discard draft" button
    // while CONFLICT + a draft are both present — either is a valid real control to click.
    fireEvent.click(screen.getAllByRole("button", { name: "Discard draft" })[0]);
    expect(screen.queryByTestId("lineup-diff-preview")).not.toBeInTheDocument();
  });
});
