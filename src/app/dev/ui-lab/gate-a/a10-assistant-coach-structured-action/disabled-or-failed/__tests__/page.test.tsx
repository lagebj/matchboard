import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import A10DisabledOrFailedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <A10DisabledOrFailedPage />
    </ThemeProvider>,
  );
}

describe("A10-disabled-or-failed page", () => {
  it("Review lineup remains a reachable action even with no proposal", () => {
    mockViewport(true);
    renderPage();
    expect(screen.getByRole("button", { name: "Review lineup" })).toBeEnabled();
  });

  it("shows an honest unavailability reason, never a fabricated proposal card", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.getByTestId("proposal-blocked-reason").textContent).toMatch(/unavailable/i);
    expect(screen.queryByTestId("lineup-proposal-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply proposal" })).not.toBeInTheDocument();
  });

  it("explicitly points back to manual editing as still available", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review lineup" }));
    expect(screen.getByText(/edit the lineup manually/)).toBeInTheDocument();
  });
});
