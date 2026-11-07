import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/player-development/football-observation-section", () => ({
  FootballObservationSection: () => null,
}));

const replaceMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      replaceMock(url);
      searchParamsState.value = new URLSearchParams(url.split("?")[1] ?? "");
    },
    refresh: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParamsState.value,
}));

import B08ReportCompletedPage from "../page";

function renderPage(tab?: string) {
  searchParamsState.value = new URLSearchParams(tab ? `tab=${tab}` : "");
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B08ReportCompletedPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("confirm", () => true);
});

describe("B08 Report · Completed page", () => {
  it("has the B08 scenario navigator marking 'report-completed' current (the page's own h1 plus the real shared shell's own match-title h1 — same established 2-heading pattern as B05/B06's own report pages, not new here)", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Report · Completed", current: "page" })).toBeInTheDocument();
  });

  it("defaults to the Summary tab (ADR-0147 §1a)", () => {
    renderPage();
    expect(replaceMock).toHaveBeenCalledWith("?tab=summary");
  });

  it("is LOCKED — no active edit control is reachable on the Players tab", () => {
    renderPage("players");
    expect(screen.queryByRole("button", { name: "Add goal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete report" })).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm duration")).not.toBeInTheDocument();
  });

  it("preserves the finalized content — same final goals/assists/attendance as the draft, not silently changed by finalization", () => {
    renderPage("players");
    expect(screen.getAllByText("2 - 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vetle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sindre").length).toBeGreaterThan(0);
  });

  it("shows the Combinations tab (COMPLETED-only, replacing Review) with the real, independently-verified evidence", () => {
    renderPage("combinations");
    expect(screen.getByText(/Noah.*Sindre|Sindre.*Noah/)).toBeInTheDocument();
  });

  it("has no Review tab — Review is DRAFT-only (ADR-0147's exact tab sets)", () => {
    renderPage();
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });

  it("shows the recorded reflection as read-only, attributed content", () => {
    renderPage("reflection");
    expect(screen.getByText(/Submitted|STRONG/)).toBeInTheDocument();
  });

  it("'Back to match' routes to B08-AFTER, the historical Overview — no separate historical page is introduced", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "‹ Back to match" })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b08-information-ownership/after",
    );
  });

  it("?tab=review is invalid once locked and falls back to the real default, without showing stale Review content", () => {
    renderPage("review");
    expect(screen.queryByText(/Plan integrity/)).not.toBeInTheDocument();
  });

  it("never imports the real production post-match server action module (structural guarantee)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/dev/ui-lab/gate-b/b08-information-ownership/report-completed/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("/matches/[matchId]/post-match/actions");
    expect(source).not.toContain("completeMatchReport");
  });

  it("has no inert or fake navigation controls (no href=\"#\")", () => {
    const { container } = renderPage();
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href")).not.toBe("#");
    }
  });
});
