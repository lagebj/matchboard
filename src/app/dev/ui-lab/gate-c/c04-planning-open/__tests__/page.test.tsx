import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoardFixtureHarness } from "../../w2-shared/round-board-fixture-harness";
import {
  buildC04PlanningOpenFixture,
  buildC04NoEligiblePlayersFixture,
  buildC04AllAssignedFixture,
  buildC04SeveralMissingFixture,
} from "../fixtures";

// The real `RoundBoard` imports server-action modules that don't resolve meaningfully under
// jsdom; mirror `src/components/round/__tests__/round-board.test.tsx`'s own mocks. The fixture
// harness always supplies `commands`, so none of these mocked functions are ever actually
// called here — this is purely to let the module graph resolve.
import { vi } from "vitest";

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

/**
 * Gate C W2 — C04. Proves the real `RoundBoard` genuinely renders an actionable unresolved
 * decision from the canonical `coverage` denominator, not a re-derived/invented one, and that
 * selecting the affected player reaches a valid next action (XR-A02).
 */
describe("C04 — Round Board planning open, unresolved player decision", () => {
  it("shows the eligible-player coverage denominator distinctly from squad placements", () => {
    render(<RoundBoardFixtureHarness initial={buildC04PlanningOpenFixture()} />);
    // 21 of 22 eligible players have an opportunity (Noah is the one unresolved decision) — a
    // genuinely different number from the 21/24 squad-placement tile (target squad size 12 per
    // team, roster 11), proving the two measures are not conflated into one ambiguous percentage.
    expect(screen.getByText("21 / 22")).toBeTruthy();
    expect(screen.getByText(/eligible players with an opportunity/i)).toBeTruthy();
    expect(screen.getByText("21 / 24")).toBeTruthy();
    expect(screen.getByText(/opportunities planned/i)).toBeTruthy();
  });

  it("surfaces the specific unresolved player as a decision, not a generic count", () => {
    render(<RoundBoardFixtureHarness initial={buildC04PlanningOpenFixture()} />);
    expect(screen.getByText(/noah is available but has no planned match opportunity/i)).toBeTruthy();
  });

  it("selecting the unresolved player reaches a valid next action with both a valid and an override-required destination", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC04PlanningOpenFixture()} />);

    // Noah's "Select" button appears in both the desktop and (unmounted-but-present-in-jsdom)
    // compact Available panels — scope to the desktop workbench's available column explicitly.
    const availableColumn = container.querySelector("[data-drop-available]") as HTMLElement;
    await user.click(within(availableColumn).getByRole("button", { name: /select noah/i }));

    // Core-team destination (Rød's own match) is the recommended, valid-path suggestion.
    expect(screen.getByRole("button", { name: /assign player/i })).toBeTruthy();
    // The cross-team destination (Hvit, no rotation path) still appears as a second, non-default
    // option the coach can still choose (would need an override reason server-side).
    expect(screen.getByRole("button", { name: /hvit/i })).toBeTruthy();
  });

  it("does not divide by zero when no eligible players exist (both tiles read 0/0, honestly)", () => {
    render(<RoundBoardFixtureHarness initial={buildC04NoEligiblePlayersFixture()} />);
    // Both the squad-placement tile and the eligible-coverage tile are legitimately 0/0 here —
    // there is nothing to plan, not a division-by-zero bug papered over with a fake percentage.
    expect(screen.getAllByText("0 / 0")).toHaveLength(2);
    expect(screen.queryByText(/eligible players with an opportunity \(/i)).toBeNull();
  });

  it("shows full coverage with zero decisions when every eligible player is already assigned", () => {
    render(<RoundBoardFixtureHarness initial={buildC04AllAssignedFixture()} />);
    expect(screen.getByText("11 / 11")).toBeTruthy(); // eligible coverage: complete.
    expect(screen.getByText("11 / 12")).toBeTruthy(); // squad placements: still below target size.
    expect(screen.getByText(/decisions need attention/i)).toBeTruthy();
    expect(screen.getByText(/no blockers or decisions right now/i)).toBeTruthy();
  });

  it("surfaces every affected player individually when several are missing an opportunity", () => {
    render(<RoundBoardFixtureHarness initial={buildC04SeveralMissingFixture()} />);
    // 3 players missing (2 Rød + 1 Hvit) out of 22 eligible — never collapsed into one row.
    expect(screen.getByText("19 / 22")).toBeTruthy();
    const decisionTiles = screen.getAllByText(/is available but has no planned match opportunity/i);
    expect(decisionTiles.length).toBe(3);
  });
});
