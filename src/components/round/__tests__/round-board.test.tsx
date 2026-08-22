import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoard } from "../round-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions", () => ({
  addPlayerToMatchAction: vi.fn(async () => ({ success: true })),
  removePlayerFromMatchAction: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/actions", () => ({
  clearRoundDraftAction: vi.fn(),
  regenerateRoundAction: vi.fn(),
  finalizeSingleMatchFromBoardAction: vi.fn(),
  unfinalizeRoundAction: vi.fn(),
  unfinalizeSingleMatchFromBoardAction: vi.fn(),
}));

const { addPlayerToMatchAction, removePlayerFromMatchAction } = vi.mocked(
  await import("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions"),
);

function baseProps() {
  return {
    roundLabel: "Round 1",
    roundStatus: "DRAFT" as const,
    matchRoundId: "round-1",
    hasDraftSelections: true,
    matches: [
      {
        matchId: "m-blue",
        teamId: "team-blue",
        teamName: "Blue",
        opponent: "Rivals",
        matchDate: new Date("2026-01-01"),
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: false,
        players: [
          {
            id: "p-alice",
            name: "Alice",
            coreTeamName: "Blue",
            coreTeamId: "team-blue",
            playerCoreTeamId: "team-blue",
            role: "CORE" as const,
          },
        ],
      },
      {
        matchId: "m-white",
        teamId: "team-white",
        teamName: "White",
        opponent: "Foxes",
        matchDate: new Date("2026-01-01"),
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: false,
        players: [],
      },
    ],
    availablePlayers: [
      {
        id: "p-alice",
        name: "Alice",
        coreTeamName: "Blue",
        coreTeamId: "team-blue",
        role: "CORE" as const,
      },
    ],
    rotationPathMap: {},
    warnings: [],
    movementSummary: {
      supportSent: 0,
      supportReceived: 0,
      developmentSent: 0,
      developmentReceived: 0,
      squadRepairReceived: 0,
      drops: 0,
    },
    fairnessMetrics: [],
  };
}

/** Tabs forward until `target` has focus, or throws if not reached. */
async function tabTo(
  user: ReturnType<typeof userEvent.setup>,
  target: HTMLElement,
  maxTabs = 60,
) {
  for (let i = 0; i < maxTabs; i++) {
    if (document.activeElement === target) return;
    await user.tab();
  }
  throw new Error("Could not reach target element via Tab within maxTabs presses");
}

describe("RoundBoard — non-drag Move alternative (UX-2.8-01)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
    removePlayerFromMatchAction.mockClear();
  });

  it("shows a Move action on each player chip (not drag-only)", () => {
    render(<RoundBoard {...baseProps()} />);
    expect(screen.getByRole("button", { name: /move alice to/i })).toBeTruthy();
  });

  it("moves a player to another match via keyboard-only navigation, calling the same mutation drag uses", async () => {
    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);

    const moveBtn = screen.getByRole("button", { name: /move alice to/i });
    await tabTo(user, moveBtn);
    await user.keyboard("{Enter}");

    // Destination picker opens (Dialog on desktop-width default from jsdom's
    // matchMedia polyfill), focus moves to its close button first.
    const destinationBtn = await screen.findByRole("button", { name: /white/i });

    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    expect(document.activeElement).toBe(closeBtn);

    await tabTo(user, destinationBtn);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(addPlayerToMatchAction).toHaveBeenCalledOnce();
    });
    const addFd = addPlayerToMatchAction.mock.calls[0][0] as FormData;
    expect(addFd.get("matchId")).toBe("m-white");
    expect(addFd.get("playerId")).toBe("p-alice");

    await waitFor(() => {
      expect(removePlayerFromMatchAction).toHaveBeenCalledOnce();
    });
    const rmFd = removePlayerFromMatchAction.mock.calls[0][0] as FormData;
    expect(rmFd.get("matchId")).toBe("m-blue");
    expect(rmFd.get("playerId")).toBe("p-alice");
  });

  it("closes the destination picker via Escape without moving the player", async () => {
    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /move alice to/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(addPlayerToMatchAction).not.toHaveBeenCalled();
  });
});
