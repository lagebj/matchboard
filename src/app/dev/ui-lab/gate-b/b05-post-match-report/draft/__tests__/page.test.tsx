import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B05DraftPage from "../page";

// `PostMatchPage`, `FootballObservationSection`, and `ObservationSection` all statically import
// real "use server" action modules that transitively pull in next-auth — which fails to resolve
// in this project's Vitest+jsdom component-test environment (unrelated to this fixture; the same
// reason `post-match-report-page-shell.test.tsx` mocks `PostMatchPage` away). Real coverage of
// these three comes from the CI capture run (`ui-lab-visual-review.yml`) against the real dev
// server, where next-auth resolves normally — see BLOCKERS.md. Everything else real:
// `PostMatchReportHeader`, `PostMatchSummaryTab`, `PostMatchReviewTab`,
// `MatchCombinationEvidencePanel`, `GoalAttributionGapBanner`, `PostMatchDebrief` (its own action
// imports are dynamic, never triggered here).
const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));

// `replace` actually updates the mocked search params (mirroring what the real browser's URL
// does after `router.replace`) — without this, the shell's own re-render after the fixture
// simulation's state flip would see `requestedTab` still unset and silently recompute the
// COMPLETED-surface default (`summary`) instead of staying pinned to `players`, which would make
// this exact test unable to tell a passing pin from the real bug it exists to catch.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string, opts?: unknown) => {
      replaceMock(url, opts);
      searchParamsState.value = new URLSearchParams(url.split("?")[1] ?? "");
    },
    refresh: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
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
      <B05DraftPage />
    </ThemeProvider>,
  );
}

describe("B05 draft page", () => {
  it("defaults to the Players tab (ADR-0147 §1a) and pins it into the URL", () => {
    renderPage();
    expect(replaceMock).toHaveBeenCalledWith("?tab=players", { scroll: false });
    expect(screen.getByTestId("players-tab")).toHaveTextContent("status: REPORTED");
  });

  it("shows the real goal-attribution-gap banner for this draft's one real unresolved goal", () => {
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/missing scorer attribution/i);
  });

  it("shows the debrief in its real read-only Submitted view, on the Debrief tab", () => {
    // The mocked router doesn't re-render on tab-click the way real Next.js navigation does
    // (see the header comment) — select the tab via the URL before mounting instead, exactly
    // like `post-match-report-page-shell.test.tsx`'s own established pattern.
    searchParamsState.value = new URLSearchParams("tab=reflection");
    render(
      <ThemeProvider>
        <B05DraftPage />
      </ThemeProvider>,
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("shows the real Summary tab with this fixture's own facts", () => {
    searchParamsState.value = new URLSearchParams("tab=summary");
    render(
      <ThemeProvider>
        <B05DraftPage />
      </ThemeProvider>,
    );
    expect(screen.getByText("7/8 present")).toBeInTheDocument();
    // Only 2 of the 3 real goals are attributed in the draft — the third is this scenario's own
    // unresolved goal-attribution gap (see the banner test above), not a miscount.
    expect(screen.getByText("2 goals")).toBeInTheDocument();
  });

  it("demonstrates a real fixture-backed Draft -> Completed transition, staying on the Players tab, without any production mutation", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Continue fixture simulation → Complete report" }));

    expect(screen.getByText(/Surface state: COMPLETED/)).toBeInTheDocument();
    // Still on the pinned Players-tab content, now reflecting the locked report.
    expect(screen.getByTestId("players-tab")).toHaveTextContent("status: LOCKED");
    // The goal-attribution gap banner (DRAFT-only, per the shell's own `isDraft &&` guard) is gone.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The replace mock was only ever called once, for the initial pin — the local fixture
    // simulation never touches the URL or router again.
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
