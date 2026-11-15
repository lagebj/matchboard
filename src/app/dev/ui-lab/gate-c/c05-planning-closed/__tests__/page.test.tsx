import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoardFixtureHarness } from "../../w2-shared/round-board-fixture-harness";
import {
  buildC05PlanningClosedFixture,
  buildC05ClosedNoWarningFixture,
  buildC05FullyOpenControlFixture,
  buildC05OpenMatchWarningFixture,
  buildC05InsufficientIdentityFixture,
} from "../fixtures";

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
 * Gate C W2 — C05. Proves the official acceptance rule directly: "Read-only meaning, no false
 * Resolve action." Covers the required test matrix: closed+warning, closed+no-warning, mixed
 * boundary, fully-open control, and read-only behavior in both desktop and mobile compositions.
 * "Stale persisted status vs. live boundary" is covered generically (not scenario-specific) by
 * `src/components/round/__tests__/round-board.test.tsx`'s own dedicated describe block — this
 * suite only proves this scenario's own closed-state content and interaction rules.
 */
describe("C05 — Round Board planning closed, mixed boundary", () => {
  it("shows the closed banner and retains the historical BLOCKED warning, a signal the real plan-integrity engine can actually produce for a finalized match", () => {
    render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    expect(screen.getByText(/planning closed/i)).toBeTruthy();
    expect(screen.getByText(/rød is below minimum squad size/i)).toBeTruthy();
  });

  // Gate C W2 remediation (P1-01): the rail must never render Resolve for this item — it has no
  // player, and its match is closed. Scoped to the rail's own list item, not just the broader
  // "no mutation available" chip-level assertions below.
  it("renders no Resolve control for the match-only historical warning on the closed match", () => {
    render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    const warningRow = screen.getByText(/rød is below minimum squad size/i).closest("li") as HTMLElement;
    expect(within(warningRow).queryByRole("button", { name: /resolve/i })).toBeNull();
  });

  it("renders a Resolve control that routes into context for a match-only warning on an OPEN match", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05OpenMatchWarningFixture()} />);
    const warningRow = screen.getByText(/rød is below minimum squad size/i).closest("li") as HTMLElement;
    const resolveButton = within(warningRow).getByRole("button", { name: /resolve/i });

    await user.click(resolveButton);

    // Routes into the compact match-first drill-in for that exact match (no single player to
    // select instead).
    const compactSection = container.querySelector('[class*="medium:hidden"]') as HTMLElement;
    expect(compactSection.querySelector('[data-drop-match="w2-c05-rod-open-warning"]')).toBeTruthy();
  });

  it("fails safe to read-only when a warning has neither a player nor a match identity", () => {
    render(<RoundBoardFixtureHarness initial={buildC05InsufficientIdentityFixture()} />);
    const warningRow = screen.getByText(/a round-level policy condition was flagged/i).closest("li") as HTMLElement;
    expect(within(warningRow).queryByRole("button", { name: /resolve/i })).toBeNull();
  });

  it("shows no closed banner and no retained warning when the round has neither (closed+no-warning)", () => {
    render(<RoundBoardFixtureHarness initial={buildC05ClosedNoWarningFixture()} />);
    expect(screen.getByText(/planning closed/i)).toBeTruthy(); // still closed...
    expect(screen.getByText(/no blockers or decisions right now/i)).toBeTruthy(); // ...but nothing unresolved.
  });

  it("offers no remove/move/repair action on the closed match's player chips (desktop)", () => {
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    const rodLane = container.querySelector('[data-drop-match="w2-c05-rod"]') as HTMLElement;
    expect(within(rodLane).queryByRole("button", { name: /remove oskar/i })).toBeNull();
    expect(within(rodLane).queryByRole("button", { name: /move oskar to/i })).toBeNull();
    expect(within(rodLane).queryByRole("button", { name: /repair options for oskar/i })).toBeNull();
  });

  it("hides Regenerate/Clear because the round-level boundary is closed, even though one match remains open", () => {
    render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    expect(screen.queryByRole("button", { name: /^regenerate$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^clear$/i })).toBeNull();
  });

  it("mixed boundary: does not disable the still-open match's valid action for an unrelated player", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);

    const availableColumn = container.querySelector("[data-drop-available]") as HTMLElement;
    await user.click(within(availableColumn).getByRole("button", { name: /select erik/i }));

    // Erik's own team (Hvit) is still open, so a real assignment remains reachable — the
    // closed Rød match never appears as a destination at all.
    expect(screen.getByRole("button", { name: /assign player/i })).toBeTruthy();
    expect(screen.queryByText(/planning is closed for every other match in this round/i)).toBeNull();

    const addPlayerToMatchAction = vi.mocked(
      (await import("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions")).addPlayerToMatchAction,
    );
    await user.click(screen.getByRole("button", { name: /assign player/i }));
    expect(addPlayerToMatchAction).not.toHaveBeenCalled(); // the fixture command, not the real action, handled it.
  });

  it("mixed boundary: the closed match never appears as a destination for a player with no current match", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    const availableColumn = container.querySelector("[data-drop-available]") as HTMLElement;
    await user.click(within(availableColumn).getByRole("button", { name: /select erik/i }));

    // Only one destination exists at all: Hvit. Rød (closed) is absent, not merely disabled.
    expect(screen.queryByRole("button", { name: /^rød/i })).toBeNull();
  });

  // Real finding, not exercised as a defect: the Board/Allocation toggle itself only renders
  // inside `{planningBoundaryOpen && (...)}`, and round-level `planningBoundaryOpen` is only
  // true when every match in the round is open (ADR-0109). So the Allocation matrix is never
  // reachable at all in a mixed- or fully-closed round — there is no "reachable but guarded"
  // matrix cell to test here. `handleMatrixToggle`'s own `target.isFinalized` guard is
  // consequently unreachable in production today, not incorrect — see
  // `docs/ui-lab/gate-c-w2-candidates/CURRENT_STATE_AUDIT.md`.
  it("never exposes the Allocation matrix toggle at all once the round-level boundary is closed", () => {
    render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    expect(screen.queryByRole("button", { name: /^allocation$/i })).toBeNull();
  });

  it("control: a fully open round still offers a genuinely valid Resolve action", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05FullyOpenControlFixture()} />);
    expect(screen.queryByText(/planning closed/i)).toBeNull();

    const availableColumn = container.querySelector("[data-drop-available]") as HTMLElement;
    await user.click(within(availableColumn).getByRole("button", { name: /select noah/i }));
    expect(screen.getByRole("button", { name: /assign player/i })).toBeTruthy();
  });

  it("mobile composition: drilling into the closed match shows no remove/move action either", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoardFixtureHarness initial={buildC05PlanningClosedFixture()} />);
    const compactSection = container.querySelector('[class*="medium:hidden"]') as HTMLElement;

    await user.click(within(compactSection).getByRole("tab", { name: /matches/i }));
    await user.click(within(compactSection).getByRole("button", { name: /rød/i }));

    expect(within(compactSection).queryByRole("button", { name: /remove oskar/i })).toBeNull();
    expect(within(compactSection).queryByRole("button", { name: /move oskar to/i })).toBeNull();
  });
});
