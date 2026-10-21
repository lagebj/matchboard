import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B06EventAfterPage from "../page";

// `FootballObservationSection` statically imports a real "use server" action module that
// transitively pulls in next-auth, which fails to resolve in this project's Vitest+jsdom
// component-test environment — the same documented blocker B05's own page test discloses and
// mocks around (see b05-post-match-report/draft/__tests__/page.test.tsx). Everything else here
// is real: `PostMatchReportShell`, `PostMatchDebrief` (its own action imports are dynamic, never
// triggered by this read-only fixture), `MatchCombinationEvidencePanel`.
vi.mock("@/components/player-development/football-observation-section", () => ({
  FootballObservationSection: () => null,
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <B06EventAfterPage />
    </ThemeProvider>,
  );
}

describe("B06 Event · After page", () => {
  it("shows the locked report with the real shared shell", () => {
    renderPage();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(screen.getByText("3 – 1")).toBeInTheDocument();
  });

  it("discloses the Event-scoped return destination, contrasted with League's match-scoped one", () => {
    renderPage();
    expect(screen.getByText("Return destination is Event-scoped, not match-scoped")).toBeInTheDocument();
  });

  it("every mutating control is genuinely absent or disabled, not fake-interactive", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: "Complete report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reopen report/ })).toBeInTheDocument();
  });

  it("the comparison nav marks Event · After as the active stop", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Event · After" })).toHaveAttribute("aria-current", "page");
  });
});
