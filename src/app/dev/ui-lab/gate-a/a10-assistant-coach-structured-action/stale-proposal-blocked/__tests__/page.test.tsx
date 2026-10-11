import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import A10StaleProposalBlockedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <A10StaleProposalBlockedPage />
    </ThemeProvider>,
  );
}

describe("A10-stale-proposal-blocked page", () => {
  it("shows the stale reason, mentioning both the expected and current revision", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    const reason = screen.getByTestId("proposal-blocked-reason");
    expect(reason.textContent).toMatch(/stale/i);
    expect(reason.textContent).toMatch(/lineup-rev-1/);
    expect(reason.textContent).toMatch(/lineup-rev-2/);
  });

  it("never renders an Apply proposal button — no executable-looking affordance", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.queryByRole("button", { name: "Apply proposal" })).not.toBeInTheDocument();
  });

  it("the proposal's evidence and rationale are still inspectable", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.getByTestId("proposal-evidence-count").textContent).toMatch(/2 cited sources/);
  });

  it("does not alter the authoritative pitch — Tobias stays unassigned", () => {
    mockViewport(true);
    renderPage();
    const pitch = screen.getAllByTestId("touchline-planning-pitch")[0];
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    fireEvent.click(screen.getByTestId("lineup-proposal-row"));
    expect(pitch.textContent).not.toMatch(/Tobias/);
  });
});
