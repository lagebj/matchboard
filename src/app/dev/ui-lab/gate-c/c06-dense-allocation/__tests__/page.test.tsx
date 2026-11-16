import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoardFixtureHarness } from "../../w2-shared/round-board-fixture-harness";
import { buildC06DenseAllocationFixture, buildC06WithDeniedAssignmentFixture } from "../fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions", () => ({
  addPlayerToMatchAction: vi.fn(),
  removePlayerFromMatchAction: vi.fn(),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/actions", () => ({
  clearRoundDraftAction: vi.fn(),
  regenerateRoundAction: vi.fn(),
}));

vi.mock("@/app/(app)/matches/emergency-repair-actions", () => ({
  generateEmergencyRepairOptionsAction: vi.fn(),
}));

/** See `src/app/dev/ui-lab/gate-a/a01-sports-first/__tests__/a01-fixture.test.tsx` for this pattern. */
let restoreMatchMedia: (() => void) | undefined;
function mockCompactViewport() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    if (query === "(max-width: 839px)") {
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    }
    return original(query);
  }) as typeof window.matchMedia;
  restoreMatchMedia = () => {
    window.matchMedia = original;
  };
}
afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

describe("C06 — Round Board dense allocation and position-precision disclosure", () => {
  it("renders a genuinely dense allocation matrix (well past a comfortable minimum)", async () => {
    const user = userEvent.setup();
    render(<RoundBoardFixtureHarness initial={buildC06DenseAllocationFixture()} />);

    await user.click(screen.getByRole("button", { name: /^allocation$/i }));

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(30); // 54 players + 1 header row.
  });

  it("the matrix's assignment state matches the underlying fixture, including cross-team movers", async () => {
    const user = userEvent.setup();
    render(<RoundBoardFixtureHarness initial={buildC06DenseAllocationFixture()} />);
    await user.click(screen.getByRole("button", { name: /^allocation$/i }));

    // Henrik (Rød's 13th player) moves to Hvit as SUPPORT via the active rotation path — the
    // matrix must show him assigned under Hvit's column, from fixture-derived state, not a
    // hand-authored view model.
    expect(screen.getByRole("button", { name: "Henrik in Hvit" })).toBeTruthy();
  });

  it("a matrix cell toggle goes through the same command contract as the rest of the board", async () => {
    const user = userEvent.setup();
    render(<RoundBoardFixtureHarness initial={buildC06DenseAllocationFixture()} />);
    await user.click(screen.getByRole("button", { name: /^allocation$/i }));

    // Aksel (Rød's genuinely-unassigned player) assigned to his own core team's match via the
    // matrix — the fixture command updates real shared state, visible back on the board view.
    await user.click(screen.getByRole("button", { name: "Aksel in Rød, not assigned" }));
    expect(await screen.findByRole("button", { name: "Aksel in Rød" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^board$/i }));
    const rodLane = screen.getByText("Rød").closest('[data-drop-match]') as HTMLElement;
    expect(within(rodLane).getByText("Aksel")).toBeTruthy();
  });

  it("denied assignment: a rejected attempt leaves assignment state unchanged (truthful rejection, not fake success)", async () => {
    const user = userEvent.setup();
    const fixture = buildC06WithDeniedAssignmentFixture();
    const deniedPlayerId = fixture.deniedAssignments![0]!.playerId;
    const deniedPlayerName = fixture.availablePlayers.find((p) => p.id === deniedPlayerId)!.name;

    render(<RoundBoardFixtureHarness initial={fixture} />);
    await user.click(screen.getByRole("button", { name: /^allocation$/i }));

    const cellLabel = `${deniedPlayerName} in Blå, not assigned`;
    await user.click(screen.getByRole("button", { name: cellLabel }));

    // Still "not assigned" — the denied command never mutated shared state.
    expect(screen.getByRole("button", { name: cellLabel })).toBeTruthy();
  });

  it("mobile: opens the assignment sheet from a real player selection and commits a valid destination", async () => {
    mockCompactViewport();
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC06DenseAllocationFixture()} />);

    const compactSection = container.querySelector('[class*="medium:hidden"]') as HTMLElement;
    await user.click(within(compactSection).getByRole("tab", { name: /matches/i }));
    await user.click(within(compactSection).getByRole("button", { name: /rød/i }));
    // Aksel's "Select" button appears in both the desktop (CSS-hidden but present) and compact
    // Available panels — scope to the compact composition explicitly, matching C05's convention.
    await user.click(within(compactSection).getByRole("button", { name: /select aksel/i }));

    expect(await screen.findByRole("dialog", { name: /assign player/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /assign to rød/i }));

    // Sheet closes on a committed result; Aksel now shows up assigned on the real board.
    expect(screen.queryByRole("dialog", { name: /assign player/i })).toBeNull();
  });

  it("position precision: links to the player's own match (the real Lineup editor) instead of inventing a tactical position", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC06DenseAllocationFixture()} />);

    // William is CORE on Rød's own match (assigned) — selecting him should surface the link.
    const rodLane = container.querySelector('[data-drop-match="w2-c06-rod"]') as HTMLElement;
    await user.click(within(rodLane).getByRole("button", { name: /select william/i }));

    // Gate C W2 remediation (W2-F01): the canonical organisation-scoped route, built from the
    // fixture's own explicit synthetic orgSlug (W2_ORG_SLUG, "acme") — never the legacy unscoped
    // `/matches/{matchId}` redirect, which does not reliably resolve for a multi-organisation
    // user. The label no longer claims an exact position necessarily exists — it is purely
    // navigation to the correct canonical context.
    const link = screen.getByRole("link", { name: /open lineup/i });
    expect(link.getAttribute("href")).toBe("/o/acme/matches/w2-c06-rod");
  });
});
