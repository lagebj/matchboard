import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round",
  useSearchParams: () => searchParamsState.value,
}));

const { default: E01SeasonClosedNoCurrentRoundPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <E01SeasonClosedNoCurrentRoundPage />
    </ThemeProvider>,
  );
}

describe("Gate E W1 — E01 season closed, no current round", () => {
  beforeEach(() => {
    routerPush.mockClear();
    searchParamsState.value = new URLSearchParams();
  });

  it("never renders 'Current round' when no round is temporally current", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Round 2")).toBeInTheDocument());
    expect(screen.queryByText("Current round")).not.toBeInTheDocument();
  });

  it("shows the honest 'Needs closure' label on the most recent unclosed round instead", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Round 2")).toBeInTheDocument();
      expect(screen.getAllByText("Needs closure").length).toBeGreaterThan(0);
    });
  });

  it("does not render a season selector when only one league season exists", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Round 2")).toBeInTheDocument());
    expect(screen.queryByLabelText("League season")).not.toBeInTheDocument();
  });

  it("still preserves the active (only) league season on the 'Review season' link", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /review season/i })).toHaveAttribute(
        "href",
        "/o/acme/season?leagueSeasonId=gate-e-w1-e01-closed-period-autumn-2026",
      );
    });
  });
});
