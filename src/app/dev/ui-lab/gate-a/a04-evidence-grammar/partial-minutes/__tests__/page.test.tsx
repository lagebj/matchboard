import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import PartialMinutesPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <PartialMinutesPage />
    </ThemeProvider>,
  );
}

describe("A04-S1 partial-minutes page", () => {
  it("shows 5/5 eligible rounds with an opportunity, never full-match or start language", () => {
    renderPage();
    expect(screen.getByText("5/5 eligible rounds with a recorded opportunity")).toBeInTheDocument();
    expect(screen.queryByText(/full match/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bstarts?\b/i)).not.toBeInTheDocument();
  });

  it("shows 'Minutes: Not recorded', never a bare 0 or a dash without explanation", () => {
    renderPage();
    expect(screen.getByText("Minutes: Not recorded")).toBeInTheDocument();
    expect(screen.getByText(/measures recorded opportunity, not played minutes/i)).toBeInTheDocument();
  });

  it("names the measure 'recorded opportunity', never claims 'played'", () => {
    renderPage();
    const caption = screen.getByText(/measures recorded opportunity/i);
    expect(caption.textContent).not.toMatch(/played minutes exist/i);
  });

  it("opens the desktop inline source inspector in place, with every opportunity source and the minutes-measure source", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /inspect/i })[0]);
    const inspector = screen.getByRole("dialog");
    expect(inspector).toHaveAttribute("aria-modal", "false");
    expect(screen.getAllByTestId("source-record-row")).toHaveLength(6); // 5 opportunities + 1 minutes-measure record
  });

  it("opens a mobile bottom sheet instead, never both presentations at once", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /inspect/i })[0]);
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape and restores focus to the trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getAllByRole("button", { name: /inspect/i })[0];
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
