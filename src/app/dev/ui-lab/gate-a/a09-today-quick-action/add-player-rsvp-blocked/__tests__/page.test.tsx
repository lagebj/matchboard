import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { installViewportMock } from "../../shared/__tests__/mock-viewport";
import AddPlayerRsvpBlockedPage from "../page";

const mockViewport = installViewportMock();

function renderPage() {
  return render(
    <ThemeProvider>
      <AddPlayerRsvpBlockedPage />
    </ThemeProvider>,
  );
}

describe("A09-S3 add-player-rsvp-blocked page", () => {
  it("blocks the candidate at entry with the RSVP-cutoff reason, discloses the separate match-day path as text only, and never changes the count", () => {
    mockViewport(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));
    const dialog = screen.getByRole("dialog");

    const row = within(dialog).getByTestId("today-candidate-row");
    expect(row).toBeDisabled();
    expect(within(dialog).getByText(/RSVP cutoff/i)).toBeInTheDocument();

    fireEvent.click(row);
    expect(within(dialog).queryByTestId("today-diff-preview")).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("today-count").textContent).toMatch(/8 \/ 9/);

    expect(screen.getByTestId("match-day-addition-disclosure")).toHaveTextContent(/separate match-day addition workflow/i);
    expect(screen.queryByRole("button", { name: /match-day/i })).not.toBeInTheDocument();
  });
});
