import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06EventDetailPage from "../page";

describe("B06 Event Detail (B3-R5 fixture-backed navigation)", () => {
  it("links onward to both Before and After for this same match", () => {
    render(
      <ThemeProvider>
        <B06EventDetailPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("link", { name: /Planned, ready/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b06-league-event-parity/event/before",
    );
    expect(screen.getByRole("link", { name: /Report locked/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b06-league-event-parity/event/after",
    );
  });

  it("discloses this is the whole Event's own page, not one match's page", () => {
    render(
      <ThemeProvider>
        <B06EventDetailPage />
      </ThemeProvider>,
    );
    expect(screen.getByText(/not a page scoped to one match/)).toBeInTheDocument();
  });

  it("names the real Event and squad, not a placeholder", () => {
    render(
      <ThemeProvider>
        <B06EventDetailPage />
      </ThemeProvider>,
    );
    expect(screen.getByText(/Lillomarka Sommerturnering/)).toBeInTheDocument();
    expect(screen.getByText(/Slemmestad Rød — Cup Squad/)).toBeInTheDocument();
  });
});
