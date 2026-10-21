import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B05CompletedPage from "../page";

// See draft/__tests__/page.test.tsx's header comment — same three components mocked for the
// same reason (real "use server" action imports transitively break next-auth resolution in this
// project's Vitest+jsdom component-test environment).
const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParamsState.value,
}));
vi.mock("@/components/live-match/post-match-unresolved-banner", () => ({
  PostMatchUnresolvedBanner: () => null,
}));
vi.mock("@/components/assistant/post-match-page", () => ({
  PostMatchPage: ({ initialReport }: { initialReport: { status: string } | null }) => (
    <div data-testid="players-tab">Players tab — status: {initialReport?.status ?? "NONE"}</div>
  ),
}));
vi.mock("@/components/player-development/football-observation-section", () => ({
  FootballObservationSection: () => null,
}));
vi.mock("@/components/opponents/observation-section", () => ({ ObservationSection: () => null }));

function renderPage() {
  searchParamsState.value = new URLSearchParams();
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B05CompletedPage />
    </ThemeProvider>,
  );
}

describe("B05 completed page", () => {
  it("defaults to the Summary tab (ADR-0147 §1a — no completion-action urgency once locked)", () => {
    renderPage();
    expect(replaceMock).toHaveBeenCalledWith("?tab=summary", { scroll: false });
    expect(screen.getByText("7/8 present")).toBeInTheDocument();
  });

  it("shows the Players tab reflecting the locked status (real mutation controls are the real PostMatchReportShell's own concern — see BLOCKERS.md for why this tab is mocked here)", () => {
    // The mocked router doesn't re-render on tab-click the way real Next.js navigation does —
    // select the tab via the URL before mounting instead, exactly like
    // `post-match-report-page-shell.test.tsx`'s own established pattern.
    searchParamsState.value = new URLSearchParams("tab=players");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("players-tab")).toHaveTextContent("status: LOCKED");
  });

  it("shows no goal-attribution-gap banner once locked — the real gap was resolved", () => {
    renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Combinations tab with real, match-scoped evidence (no chemistry score, no leaderboard)", () => {
    searchParamsState.value = new URLSearchParams("tab=combinations");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    expect(screen.getByText("Combination evidence")).toBeInTheDocument();
    // Two real rows: a partnership and a triangle, not one row counted twice.
    expect(screen.getByText("Noah + Sindre — horizontal partnership")).toBeInTheDocument();
    expect(screen.getByText("Noah + Sindre + Kasper — attacking triangle")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/chemistry|leaderboard/i);
  });

  it("shows the debrief in its real read-only Submitted view", () => {
    searchParamsState.value = new URLSearchParams("tab=reflection");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("has no Review tab — Review is DRAFT-only (ADR-0147's exact tab sets)", () => {
    renderPage();
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });
});
