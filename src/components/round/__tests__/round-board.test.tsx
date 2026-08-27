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

vi.mock("@/app/(app)/matches/emergency-repair-actions", () => ({
  generateEmergencyRepairOptionsAction: vi.fn(async () => ({
    success: true,
    vacatedPlayerId: "p-alice",
    vacatedPlayerName: "Alice",
    vacatedRole: "CORE",
    options: [],
  })),
}));

const { addPlayerToMatchAction, removePlayerFromMatchAction } = vi.mocked(
  await import("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions"),
);

const { generateEmergencyRepairOptionsAction } = vi.mocked(
  await import("@/app/(app)/matches/emergency-repair-actions"),
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

describe("RoundBoard — player chip explains its selection (ARR-0033)", () => {
  it("surfaces selectionReason and soft (non-hard-rule) explanations via the chip tooltip", () => {
    const props = baseProps();
    props.matches[0]!.players[0] = {
      ...props.matches[0]!.players[0]!,
      selectionReason: "Selected as an eligible core player for Blue.",
      explanations: [
        { code: "eligible_core_player", summary: "Selected as an eligible core player for Blue.", hardRule: true },
        { code: "combination_evidence", summary: "Established horizontal partnership: 104 min across 5 matches.", hardRule: false },
      ],
    } as never;

    render(<RoundBoard {...props} />);

    const tooltip = screen.getByTitle((content) => content.includes("Established horizontal partnership"));
    expect(tooltip.getAttribute("title")).toContain("Selected as an eligible core player for Blue.");
    expect(tooltip.getAttribute("title")).toContain("Established horizontal partnership: 104 min across 5 matches.");
  });

  it("does not duplicate the hard-rule explanation that already matches selectionReason", () => {
    const props = baseProps();
    props.matches[0]!.players[0] = {
      ...props.matches[0]!.players[0]!,
      selectionReason: "Selected as an eligible core player for Blue.",
      explanations: [
        { code: "eligible_core_player", summary: "Selected as an eligible core player for Blue.", hardRule: true },
      ],
    } as never;

    render(<RoundBoard {...props} />);

    const tooltip = screen.getByTitle((content) => content.includes("Alice · Blue"));
    const occurrences = tooltip.getAttribute("title")!.split("Selected as an eligible core player for Blue.").length - 1;
    expect(occurrences).toBe(1);
  });
});

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

describe("RoundBoard — emergency repair options (Phase 9)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
    removePlayerFromMatchAction.mockClear();
    generateEmergencyRepairOptionsAction.mockClear();
  });

  it("shows a Repair options action on a player chip in a match column", () => {
    render(<RoundBoard {...baseProps()} />);
    expect(screen.getByRole("button", { name: /repair options for alice/i })).toBeTruthy();
  });

  it("does not show a Repair options action on a finalized match's player chip", () => {
    const props = baseProps();
    props.matches[0]!.isFinalized = true;
    render(<RoundBoard {...props} />);
    expect(screen.queryByRole("button", { name: /repair options for alice/i })).toBeNull();
  });

  it("generates and lists options, then applies the chosen option via remove + add", async () => {
    generateEmergencyRepairOptionsAction.mockResolvedValueOnce({
      success: true,
      vacatedPlayerId: "p-alice",
      vacatedPlayerName: "Alice",
      vacatedRole: "CORE",
      options: [
        {
          playerId: "p-bob",
          playerName: "Bob",
          coreTeamName: "White",
          role: "SUPPORT",
          isOwnTeam: false,
          positionMatch: true,
          combinationNotes: [],
          newBlockedSignals: [],
          newDecisionRequiredSignals: [],
          resolvedSignals: [],
        },
      ],
    });

    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /repair options for alice/i }));

    expect(await screen.findByText("Bob")).toBeTruthy();
    await waitFor(() => {
      expect(generateEmergencyRepairOptionsAction).toHaveBeenCalledWith("m-blue", "p-alice");
    });

    await user.click(screen.getByRole("button", { name: /use this player/i }));

    await waitFor(() => {
      expect(removePlayerFromMatchAction).toHaveBeenCalledOnce();
    });
    const rmFd = removePlayerFromMatchAction.mock.calls[0][0] as FormData;
    expect(rmFd.get("matchId")).toBe("m-blue");
    expect(rmFd.get("playerId")).toBe("p-alice");

    await waitFor(() => {
      expect(addPlayerToMatchAction).toHaveBeenCalledOnce();
    });
    const addFd = addPlayerToMatchAction.mock.calls[0][0] as FormData;
    expect(addFd.get("matchId")).toBe("m-blue");
    expect(addFd.get("playerId")).toBe("p-bob");
    expect(addFd.get("role")).toBe("SUPPORT");
    expect(addFd.get("overrideReasonCategory")).toBe("availability_changed");
  });

  it("shows an empty-options message without applying anything", async () => {
    generateEmergencyRepairOptionsAction.mockResolvedValueOnce({
      success: true,
      vacatedPlayerId: "p-alice",
      vacatedPlayerName: "Alice",
      vacatedRole: "CORE",
      options: [],
    });

    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);
    await user.click(screen.getByRole("button", { name: /repair options for alice/i }));

    expect(await screen.findByText(/no viable alternative found/i)).toBeTruthy();
    expect(addPlayerToMatchAction).not.toHaveBeenCalled();
    expect(removePlayerFromMatchAction).not.toHaveBeenCalled();
  });
});

describe("RoundBoard — phone-responsive match columns", () => {
  it("gives match columns horizontal-scroll-snap classes below the expanded tier, and a grid at expanded+", () => {
    const { container } = render(<RoundBoard {...baseProps()} />);
    const scrollContainer = container.querySelector('[data-drop-available]')?.parentElement;
    expect(scrollContainer?.className).toContain("overflow-x-auto");
    expect(scrollContainer?.className).toContain("snap-x");
    expect(scrollContainer?.className).toContain("expanded:grid");
    expect(scrollContainer?.className).toContain("expanded:snap-none");
  });

  it("gives each column a bounded width for snap-scrolling, reset to auto at expanded+", () => {
    const { container } = render(<RoundBoard {...baseProps()} />);
    const availableColumn = container.querySelector('[data-drop-available]');
    const matchColumn = container.querySelector('[data-drop-match="m-blue"]');
    for (const el of [availableColumn, matchColumn]) {
      expect(el?.className).toContain("snap-start");
      expect(el?.className).toContain("expanded:w-auto");
    }
  });

  it("shows a swipe hint only when there is more than one match", () => {
    const { rerender } = render(<RoundBoard {...baseProps()} />);
    expect(screen.getByText(/swipe to see other matches/i)).toBeTruthy();

    const singleMatchProps = baseProps();
    singleMatchProps.matches = [singleMatchProps.matches[0]];
    rerender(<RoundBoard {...singleMatchProps} />);
    expect(screen.queryByText(/swipe to see other matches/i)).toBeNull();
  });
});
