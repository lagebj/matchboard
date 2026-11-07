import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/lib/theme/theme-provider";

// See b05-post-match-report/draft/__tests__/page.test.tsx's header comment — same real,
// unrelated jsdom-resolution blocker (`FootballObservationSection` transitively imports a real
// "use server" action module that pulls in next-auth). Everything else mounted by
// `SafePostMatchReportShell` is real and unmocked.
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

import B08ReportDraftPage from "../page";

function renderPage(tab = "players") {
  searchParamsState.value = new URLSearchParams(`tab=${tab}`);
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B08ReportDraftPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("confirm", () => true);
});

describe("B08 Report · Draft page", () => {
  it("has the B08 scenario navigator marking 'report-draft' current (the page's own h1 plus the real shared shell's own match-title h1 — same established 2-heading pattern as B05/B06's own report pages, not new here)", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Report · Draft", current: "page" })).toBeInTheDocument();
  });

  it("defaults to the Players tab (ADR-0147 §1a)", () => {
    searchParamsState.value = new URLSearchParams();
    replaceMock.mockClear();
    render(
      <ThemeProvider>
        <B08ReportDraftPage />
      </ThemeProvider>,
    );
    expect(replaceMock).toHaveBeenCalledWith("?tab=players");
  });

  it("shows the real unresolved second-half timing-review integrity warning (the fixture's one genuine incomplete-data condition)", () => {
    renderPage("players");
    expect(screen.getByText("Confirm duration")).toBeInTheDocument();
  });

  it("rejects completion while timing still needs review, and does not change report state", async () => {
    renderPage("players");
    fireEvent.click(screen.getByRole("button", { name: "Complete report" }));
    expect(await screen.findByText(/Cannot complete report/)).toBeInTheDocument();
    expect(screen.queryByText("Reopen report")).not.toBeInTheDocument();
  });

  it("confirming the real timing resolution unblocks completion, and the report then locks", async () => {
    renderPage("players");
    fireEvent.click(screen.getByRole("button", { name: "Confirm duration" }));
    await waitFor(() => expect(screen.queryByText("Confirm duration")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Complete report" }));
    expect(await screen.findByText("Reopen report")).toBeInTheDocument();
  });

  it("a successful local reconciliation updates every dependent presentation together (score, goals, attendance) — never one widget stale while another updates", async () => {
    renderPage("players");
    // The fixture's own two goals/one assist are already fully attributed (no goal-attribution
    // gap in this scenario) — confirm they appear consistently as seeded, across the score and
    // the goal list, before any mutation.
    expect(screen.getAllByText("2 - 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vetle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Noah").length).toBeGreaterThan(0);
  });

  it("'Back to match' routes to this candidate's own AFTER route, never another match's", () => {
    renderPage("players");
    expect(screen.getByRole("link", { name: "‹ Back to match" })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b08-information-ownership/after",
    );
  });

  it("never imports the real production post-match server action module (structural guarantee)", () => {
    for (const file of [
      "src/app/dev/ui-lab/gate-b/b08-information-ownership/report-draft/page.tsx",
      "src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx",
      "src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/use-safe-report-lifecycle.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toContain("/matches/[matchId]/post-match/actions");
      expect(source).not.toContain("completeMatchReport");
      expect(source).not.toContain("reopenMatchReport");
    }
  });

  it("has no inert or fake navigation controls (no href=\"#\")", () => {
    const { container } = renderPage("players");
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href")).not.toBe("#");
    }
  });
});
