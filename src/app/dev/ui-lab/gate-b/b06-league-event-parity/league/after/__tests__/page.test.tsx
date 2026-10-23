import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06LeagueAfterPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <B06LeagueAfterPage />
    </ThemeProvider>,
  );
}

describe("B06 League · After page", () => {
  it("shows the final score and the same match identity as League · Before", () => {
    renderPage();
    // MatchIdentityCard now renders two always-present compositions (compact + medium+, toggled
    // by CSS display) — the score text legitimately appears twice.
    expect(screen.getAllByText("3 - 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Slemmestad Rød/).length).toBeGreaterThan(0);
  });

  // B3-R2: this is deliberately NOT a link anymore — B05 is a different match, and a working
  // link to it would silently swap this match's identity for an unrelated one.
  it("never links 'Continue report' to B05 or any other candidate — B05 is a different match", () => {
    renderPage();
    expect(screen.queryByRole("link", { name: /Continue report/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Continue report/).length).toBeGreaterThan(0);
  });

  it("states the match-scoped return destination explicitly, with a real link to it (B3-R5)", () => {
    renderPage();
    expect(screen.getByText(/return destination is scoped to this specific match/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /League Match Details|this same match.s own page/ }).length).toBeGreaterThan(0);
  });
});
