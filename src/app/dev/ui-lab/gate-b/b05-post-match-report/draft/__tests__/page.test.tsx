import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B05DraftPage from "../page";

// `FootballObservationSection` statically imports a real "use server" action module that
// transitively pulls in next-auth, which fails to resolve in this project's Vitest+jsdom
// component-test environment — the same documented, unrelated blocker every prior Gate B wave's
// own page test discloses and mocks around. Everything else here is real and unmocked:
// `PostMatchReportShell`, `PostMatchDebrief` (its own action imports are dynamic, never
// triggered since this scenario always passes `readOnly`), `GoalAttributionGapBanner`,
// `RecoveredTimingCallout`, `PostMatchSummaryTab`, `MatchTimelineList`.
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
  searchParamsState.value = new URLSearchParams("tab=players");
  replaceMock.mockClear();
  return render(
    <ThemeProvider>
      <B05DraftPage />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  // `PostMatchReportShell`'s "Complete report"/"Reopen report" controls gate on a native
  // `confirm()` dialog before calling the action — jsdom has no real dialog, so without this
  // stub every click would silently no-op (default `false`), never reaching the action at all.
  vi.stubGlobal("confirm", () => true);
});

describe("B05 draft page (fixtureVersion 2 — B2-R3/R5/R6 remediation)", () => {
  it("shows exactly one goal-attribution-gap banner and one unresolved-timing callout, never duplicated", () => {
    renderPage();
    expect(screen.getAllByRole("alert").length + screen.getAllByText(/missing scorer attribution/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/missing scorer attribution/i)).toHaveLength(1);
    expect(screen.getAllByText("Confirm duration")).toHaveLength(1);
  });

  it("rejects completion while timing still needs review, and does not change report state", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Complete report" }));
    expect(await screen.findByText(/Cannot complete report/)).toBeInTheDocument();
    expect(screen.getByText("Confirm duration")).toBeInTheDocument();
    expect(screen.queryByText("Reopen report")).not.toBeInTheDocument();
  });

  it("confirming timing resolves the real hard blocker — completion then succeeds (matching production: the goal-attribution gap is advisory, never itself an enforced completion gate per the real completeReport()/getTimingSubmissionBlockers() contract)", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Confirm duration" }));
    await waitFor(() => expect(screen.queryByText("Confirm duration")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Complete report" }));
    expect(await screen.findByText("Reopen report")).toBeInTheDocument();
    expect(screen.queryByText(/Cannot complete report/)).not.toBeInTheDocument();
  });

  it("the goal/report discrepancy is independently resolvable via the real Add goal control — Sindre's 34' goal, local state only", async () => {
    renderPage();
    expect(screen.getByText(/missing scorer attribution/i)).toBeInTheDocument();

    const scorerSelect = screen.getByDisplayValue("Select scorer");
    fireEvent.change(scorerSelect, { target: { value: "player-gb5-sindre" } });
    fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(screen.queryByText(/missing scorer attribution/i)).not.toBeInTheDocument());
  });

  it("never imports the real production post-match server action module (structural guarantee, not just behavioural)", () => {
    const forbidden = "/matches/[matchId]/post-match/actions";
    for (const file of [
      "../page.tsx",
      "../../shared/safe-post-match-report-shell.tsx",
      "../../shared/use-safe-report-lifecycle.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toContain(forbidden);
      expect(source).not.toContain("completeMatchReport");
      expect(source).not.toContain("addGoalToReport");
      expect(source).not.toContain("reopenMatchReport");
    }
  });
});
