import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B05CompletedPage from "../page";

// See draft/__tests__/page.test.tsx's header comment — same component mocked for the same
// unrelated reason. Everything else here is real and unmocked.
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

function renderPage() {
  searchParamsState.value = new URLSearchParams();
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B05CompletedPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("confirm", () => true);
});

describe("B05 completed page (fixtureVersion 2 — B2-R4/R5/R6/R7 remediation)", () => {
  it("defaults to the Summary tab (ADR-0147 §1a — no completion-action urgency once locked)", () => {
    renderPage();
    expect(replaceMock).toHaveBeenCalledWith("?tab=summary");
  });

  it("shows no goal-attribution-gap or unresolved-timing banner once locked", () => {
    renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/missing scorer attribution/i)).not.toBeInTheDocument();
  });

  it("Players tab shows the real shared shell, fully locked — no add/remove controls, Reopen is the only live control", () => {
    searchParamsState.value = new URLSearchParams("tab=players");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Reopen report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add goal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete report" })).not.toBeInTheDocument();
  });

  it("Reopen uses this candidate's own fixture-local lifecycle, never the real reopenMatchReport action — reopening restores the draft's real mutation controls", async () => {
    searchParamsState.value = new URLSearchParams("tab=players");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reopen report" }));
    expect(await screen.findByRole("button", { name: "Complete report" })).toBeInTheDocument();
  });

  it("shows the Combinations tab with real, per-match-valid evidence (opponentDiversity 1, never ESTABLISHED)", () => {
    searchParamsState.value = new URLSearchParams("tab=combinations");
    render(
      <ThemeProvider>
        <B05CompletedPage />
      </ThemeProvider>,
    );
    expect(screen.getByText("Combination evidence")).toBeInTheDocument();
    expect(screen.getByText("Noah + Sindre — horizontal partnership")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/established/i);
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

  it("never imports the real production post-match server action module (structural guarantee, not just behavioural)", () => {
    const forbidden = "/matches/[matchId]/post-match/actions";
    for (const file of ["../page.tsx", "../../shared/safe-post-match-report-shell.tsx", "../../shared/use-safe-report-lifecycle.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toContain(forbidden);
      expect(source).not.toContain("completeMatchReport");
      expect(source).not.toContain("reopenMatchReport");
    }
  });
});
