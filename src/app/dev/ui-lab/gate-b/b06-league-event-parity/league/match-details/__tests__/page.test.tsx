import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06LeagueMatchDetailsPage from "../page";

describe("B06 League Match Details (B3-R5 fixture-backed navigation)", () => {
  it("links onward to both Before and After for this same match", () => {
    render(
      <ThemeProvider>
        <B06LeagueMatchDetailsPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("link", { name: /Before kickoff/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b06-league-event-parity/league/before",
    );
    expect(screen.getByRole("link", { name: /After the match/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b06-league-event-parity/league/after",
    );
  });

  it("names the real opponent, not a placeholder", () => {
    render(
      <ThemeProvider>
        <B06LeagueMatchDetailsPage />
      </ThemeProvider>,
    );
    expect(screen.getAllByText(/Hvalstad IL/).length).toBeGreaterThan(0);
  });
});
