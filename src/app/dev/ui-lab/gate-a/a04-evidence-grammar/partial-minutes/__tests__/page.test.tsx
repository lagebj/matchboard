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
  it("shows 5/5 eligible rounds with a recorded opportunity, never full-match or start language", () => {
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

  it("the opportunity inspector shows only eligibility + opportunity records, never the minutes-measure record", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /inspect sources/i }));
    const inspector = screen.getByRole("dialog");
    expect(inspector).toHaveAttribute("aria-modal", "false");
    const rows = screen.getAllByTestId("source-record-row");
    expect(rows).toHaveLength(10); // 5 rounds x (eligibility + opportunity)
    expect(rows.some((r) => r.textContent?.includes("Actual playing minutes"))).toBe(false);
  });

  it("the minutes inspector shows only the minutes-measure record, scoped separately from opportunity sources", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /inspect minutes source/i }));
    const inspector = screen.getByRole("dialog");
    expect(inspector).toHaveAttribute("aria-modal", "false");
    const rows = screen.getAllByTestId("source-record-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toMatch(/Actual playing minutes/);
  });

  describe("independent review round 2 (PR #778, finding R4): exactly one active inspector", () => {
    it("clicking the minutes trigger while the opportunity inspector is already open (desktop, no Escape) switches content instead of opening a second dialog", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect sources/i }));
      expect(screen.getAllByTestId("source-record-row")).toHaveLength(10);

      // No Escape here — this is the real desktop switch behavior finding R4 requires.
      fireEvent.click(screen.getByRole("button", { name: /inspect minutes source/i }));

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      const rows = screen.getAllByTestId("source-record-row");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toMatch(/Actual playing minutes/);
      expect(screen.getByText("A04-S1 minutes source")).toBeInTheDocument();
    });

    it("switching back to the opportunity trigger restores its full scoped source list, not a stale combination", () => {
      mockViewport(true);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /inspect minutes source/i }));
      fireEvent.click(screen.getByRole("button", { name: /inspect sources/i }));

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getAllByTestId("source-record-row")).toHaveLength(10);
      expect(screen.getByText("A04-S1 opportunity sources")).toBeInTheDocument();
    });
  });

  it("opens a mobile bottom sheet instead, never both presentations at once", () => {
    mockViewport(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /inspect sources/i }));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape and restores focus to the trigger", () => {
    mockViewport(true);
    renderPage();
    const trigger = screen.getByRole("button", { name: /inspect sources/i });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
