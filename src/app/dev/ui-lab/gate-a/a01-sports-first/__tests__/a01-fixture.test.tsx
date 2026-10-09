import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A01SportsFirstPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A01SportsFirstPage />
    </ThemeProvider>,
  );
}

/**
 * A01 context-local interaction invariant (PR #777 remediation, XR-I01): the "Lineup" quick
 * action must stay on this page — it must never read as a navigation to a different route or
 * demonstration.
 */
describe("A01 sports-first candidate — context-local Lineup action", () => {
  it("renders Lineup as a button, not a link to another page", () => {
    renderPage();
    const lineupControl = screen.getByText("Lineup").closest("button, a");
    expect(lineupControl?.tagName).toBe("BUTTON");
  });

  it("opens an in-page lineup preview without unmounting the page's own content", () => {
    renderPage();
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Lineup"));

    expect(screen.getByTestId("lineup-preview-list")).toBeInTheDocument();
    // The page heading is still present — we did not navigate away.
    expect(screen.getByText("A01 — Sports-first composition")).toBeInTheDocument();
    // Read-only preview, not an editor: no save/submit control anywhere in the sheet.
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("the lineup preview lists real squad members, not placeholder rows", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    expect(screen.getByText("Kristian")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("closes back to the same page via the sheet's close control", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();
  });

  it("closes on Escape (keyboard access)", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lineup"));
    expect(screen.getByTestId("lineup-preview-list")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("lineup-preview-list")).not.toBeInTheDocument();
  });

  it("restores focus to the Lineup trigger after closing (focus restoration)", () => {
    renderPage();
    const trigger = screen.getByText("Lineup").closest("button")!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(document.activeElement).toBe(trigger);
  });
});
