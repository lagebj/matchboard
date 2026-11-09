import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/lib/theme/theme-provider";

// Same real device-local primitives every other `LiveMatchClient` test in this repo mocks for
// jsdom (no real IndexedDB/service-worker registration in a component test environment) — see
// `src/components/live-match/__tests__/live-match-client-forgotten-start.test.tsx`. This does NOT
// touch the fixture-local `actions` prop B08-LIVE itself supplies (`useB08LiveFixtureActions`),
// which remains real and unmocked.
vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: vi.fn().mockResolvedValue([]),
  getRetryableCommands: vi.fn().mockResolvedValue([]),
  getUnresolvedCommands: vi.fn().mockResolvedValue([]),
  isActionableForCoach: (c: { status: string; resolvedByCoach?: boolean }) =>
    c.status === "NEEDS_REVIEW" || (c.status === "FAILED_TERMINAL" && !c.resolvedByCoach),
  recoverInterruptedSends: vi.fn().mockResolvedValue([]),
  clearPersistedCommands: vi.fn().mockResolvedValue({ removed: 0, retainedUnresolved: 0 }),
  saveSessionLocally: vi.fn().mockResolvedValue(undefined),
  savePreparedPackage: vi.fn().mockResolvedValue(undefined),
  clearPreparedPackage: vi.fn().mockResolvedValue(undefined),
  getLocalSession: vi.fn().mockResolvedValue(null),
  clearLocalSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/live-match/offline/register-live-service-worker", () => ({
  registerLiveServiceWorker: vi.fn(),
}));

import B08LivePage from "../page";
import { MATCH_B_TEAM_NAME } from "../../../shared/match-b-fixture";
import { B08_OPPONENT_NAME } from "../../shared/fixture";

function renderPage() {
  return render(
    <ThemeProvider>
      <B08LivePage />
    </ThemeProvider>,
  );
}

describe("B08 Live page", () => {
  it("has exactly one h1 and the B08 scenario navigator marking 'live' current", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Live", current: "page" })).toBeInTheDocument();
  });

  it("shows a real route back to the originating match", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Back to this match/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b08-information-ownership/before",
    );
  });

  it("discloses that live events feed AFTER later, distinguishing live recording from post-match reconciliation", () => {
    renderPage();
    expect(screen.getByText(/feed the AFTER Events tab later/)).toBeInTheDocument();
  });

  it("shows a read-only follower summary separate from the reporter controls", () => {
    renderPage();
    expect(screen.getByText(/Read-only follower view/)).toBeInTheDocument();
  });

  it("mounts the real LiveMatchClient (reporter scoreboard/clock are present once its real async pre-match load resolves, already mid-session since the fixture seeds an active session)", async () => {
    renderPage();
    await waitFor(() => expect(screen.queryByText("Loading match data...")).not.toBeInTheDocument());
    expect(screen.getAllByText(MATCH_B_TEAM_NAME).length).toBeGreaterThan(0);
    expect(screen.getAllByText(B08_OPPONENT_NAME).length).toBeGreaterThan(0);
  });

  it("the fixture-local actions hook never imports the real realtime hook or either production live adapter (structural guarantee)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/safe-transition-controller.ts"),
      "utf8",
    );
    expect(source).not.toContain("use-live-realtime");
    expect(source).not.toContain("league-live-match-client");
    expect(source).not.toContain("event-live-match-client");
  });

  it("has no inert or fake navigation controls (no href=\"#\")", () => {
    const { container } = renderPage();
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href")).not.toBe("#");
    }
  });

  describe("P2-9: the read-only follower summary is derived from the same event ledger as the reporter — never a second, independently frozen score", () => {
    beforeEach(() => {
      window.sessionStorage.clear();
    });
    afterEach(() => {
      window.sessionStorage.clear();
    });

    it("starts in agreement with the reporter's own seeded score (1-1 at the B08 LIVE cutoff instant)", async () => {
      renderPage();
      await waitFor(() => expect(screen.queryByText("Loading match data...")).not.toBeInTheDocument());
      const follower = screen.getByText(/Read-only follower view/).closest("div")!.parentElement!;
      expect(within(follower).getByText("1")).toBeInTheDocument();
    });

    it("recording a goal in the real reporter panel updates the follower's own score on the next render — they can no longer disagree", async () => {
      renderPage();
      await waitFor(() => expect(screen.queryByText("Loading match data...")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Goal for us" }));

      await waitFor(() => {
        const follower = screen.getByText(/Read-only follower view/).closest("div")!.parentElement!;
        // 1-1 (seeded) -> 2-1 after one more own goal is recorded.
        expect(within(follower).getByText("2")).toBeInTheDocument();
      });
    });
  });
});
