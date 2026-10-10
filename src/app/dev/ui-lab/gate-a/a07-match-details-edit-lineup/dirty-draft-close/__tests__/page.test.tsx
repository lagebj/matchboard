import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import DirtyDraftClosePage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <DirtyDraftClosePage />
    </ThemeProvider>,
  );
}

describe("A07-S6 dirty-draft-close page", () => {
  it("closes immediately on the X button when there is no draft yet", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the X button shows a discard/continue prompt instead of closing once a draft exists", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Discard this change?")).toBeInTheDocument();
    expect(screen.queryByTestId("lineup-diff-preview")).not.toBeInTheDocument(); // prompt replaces the body, draft is not shown but not lost
  });

  it("Escape triggers the same guard — it does not unconditionally close with a dirty draft", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Discard this change?")).toBeInTheDocument();
  });

  it("'Simulate browser Back' triggers the same guard with a dirty draft", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Simulate browser Back" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Discard this change?")).toBeInTheDocument();
  });

  it("'Keep editing' dismisses the prompt and the draft is still intact", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByTestId("keep-editing"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("lineup-diff-preview")).toBeInTheDocument();
  });

  it("'Discard and close' actually closes, clears the draft, and restores focus to the trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: "Edit lineup" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByTestId("confirm-discard-and-close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);

    // Reopening shows a fresh, undrafted editor — the discard really cleared the draft.
    fireEvent.click(trigger);
    expect(screen.queryByTestId("lineup-diff-preview")).not.toBeInTheDocument();
  });

  it("works identically on the mobile sheet presentation", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit lineup" }));
    fireEvent.click(screen.getByTestId("lineup-candidate-row"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Discard this change?")).toBeInTheDocument();
  });
});
