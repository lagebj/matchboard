import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round",
  useSearchParams: () => searchParamsState.value,
}));

const { default: E01MidSeasonCurrentRoundPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <E01MidSeasonCurrentRoundPage />
    </ThemeProvider>,
  );
}

describe("Gate E W1 — E01 mid-season, current round", () => {
  beforeEach(() => {
    routerPush.mockClear();
    searchParamsState.value = new URLSearchParams();
  });

  it("identifies the current round distinctly from past and future rounds", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Current round")).toBeInTheDocument();
      expect(screen.getByText("Round 9")).toBeInTheDocument();
    });
  });

  it("shows the past round's FINAL and NEEDS_CLOSURE states as distinct labels, never both as 'Current'", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Final").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Needs closure").length).toBeGreaterThan(0);
    });
  });

  it("renders the cancelled match as Cancelled with its real reason, not as a missing result", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
      expect(screen.getByText(/Opponent withdrew/)).toBeInTheDocument();
    });
  });

  it("the earlier-rounds disclosure is collapsed by default and reveals Round 6 on toggle", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Round 9")).toBeInTheDocument());
    expect(screen.queryByText("Round 6")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /earlier rounds/i });
    toggle.click();
    await waitFor(() => expect(screen.getByText("Round 6")).toBeInTheDocument());
  });

  it("offers both league seasons in the season selector, defaulting to the current one", async () => {
    renderPage();
    await waitFor(() => {
      const select = screen.getByLabelText("League season") as HTMLSelectElement;
      expect(select.value).toContain("spring-2027");
      expect(screen.getByRole("option", { name: /Autumn 2026/ })).toBeInTheDocument();
    });
  });

  it("selecting the current round via the URL round param overrides the temporal default, and selecting a round pushes season+round together", async () => {
    searchParamsState.value = new URLSearchParams("round=gate-e-w1-e01-mid-round-7");
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Round 7")).toBeInTheDocument();
      expect(screen.getAllByText("Final").length).toBeGreaterThan(0);
    });
  });

  it("'Review season' preserves the active league season in its href (ADR-0157 C7 context preservation)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /review season/i })).toHaveAttribute(
        "href",
        "/o/acme/season?leagueSeasonId=gate-e-w1-e01-mid-period-spring-2027",
      );
    });
  });
});
