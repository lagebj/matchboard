import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoard, type SignalEntry } from "../round-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/draft-selection-actions", () => ({
  addPlayerToMatchAction: vi.fn(async () => ({ success: true })),
  removePlayerFromMatchAction: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/app/(app)/rounds/[matchRoundId]/actions", () => ({
  clearRoundDraftAction: vi.fn(),
  regenerateRoundAction: vi.fn(),
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
    planningBoundaryOpen: true,
    matchRoundId: "round-1",
    matches: [
      {
        matchId: "m-blue",
        teamId: "team-blue",
        teamName: "Blue",
        teamKitColor: "#1d4fa8",
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
        teamKitColor: "#f2f2f2",
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
    warnings: [] as SignalEntry[],
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
          positionFit: "STRONG",
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

// Atlas Follow-up Phase F9 superseded the old scroll-snap phone tier (ADR-0124 §12's original
// "one column, horizontally snap-scrollable below expanded" design) with a match-first
// drill-down (Overview -> Matches -> one match's squad, feature file "Mobile Round Board is
// match-first"): the desktop multi-match workbench is now a plain grid shown only at `medium+`,
// and everything below that renders the separate compact composition instead of a
// scroll-snapped copy of the same columns.
describe("RoundBoard — desktop multi-match workbench vs. compact match-first composition", () => {
  it("desktop workbench (medium+) is a plain grid, hidden below medium — no scroll-snap tier", () => {
    const { container } = render(<RoundBoard {...baseProps()} />);
    const desktopWorkbench = container.querySelector('[data-drop-available]')?.parentElement;
    expect(desktopWorkbench?.className).toContain("hidden");
    expect(desktopWorkbench?.className).toContain("medium:grid");
    expect(desktopWorkbench?.className).not.toContain("overflow-x-auto");
    expect(desktopWorkbench?.className).not.toContain("snap-x");
  });

  it("non-compact viewport: no compact match selector, every match column renders in the desktop workbench", () => {
    const { container } = render(<RoundBoard {...baseProps()} />);
    expect(screen.queryByRole("tablist", { name: /select match/i })).toBeNull();
    expect(container.querySelector('[data-drop-match="m-blue"]')).toBeTruthy();
    expect(container.querySelector('[data-drop-match="m-white"]')).toBeTruthy();
  });

  it("compact viewport: Overview first, then a match list, then one match's squad on drill-in (ADR-0124 §12 / contract §7)", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoundBoard {...baseProps()} />);
    // The desktop grid is always mounted (CSS-hidden below `medium`, not JS-conditional), so
    // scope every assertion to the compact composition's own wrapper to avoid matching it.
    const compactSection = container.querySelector('[class*="medium:hidden"]') as HTMLElement;
    expect(compactSection).toBeTruthy();

    // Overview mode by default: the "Round board views" tab strip is present, no match's squad
    // is mounted yet in the compact composition — it only mounts once the coach drills in.
    const viewTabs = within(compactSection).getByRole("tablist", { name: /round board views/i });
    expect(within(viewTabs).getByRole("tab", { name: /overview/i })).toBeTruthy();
    expect(compactSection.querySelector('[data-drop-match="m-blue"]')).toBeNull();

    // Matches mode: a list of matches with per-match readiness, not a column.
    await user.click(within(viewTabs).getByRole("tab", { name: /matches/i }));
    expect(within(compactSection).getByRole("button", { name: /Blue/ })).toBeTruthy();
    expect(within(compactSection).getByRole("button", { name: /White/ })).toBeTruthy();
    expect(compactSection.querySelector('[data-drop-match="m-blue"]')).toBeNull();

    // Drilling into one match mounts only that match's squad within the compact composition.
    await user.click(within(compactSection).getByRole("button", { name: /Blue/ }));
    expect(compactSection.querySelector('[data-drop-match="m-blue"]')).toBeTruthy();
    expect(compactSection.querySelector('[data-drop-match="m-white"]')).toBeNull();
  });
});

// Real production bug: a round finalized by the coach-operated "Finalize round" action that
// existed before ADR-0109 removed it can retain a stale MatchRound.status of "FINALIZED" even
// though none of its matches have ever actually reached their real planning boundary (kickoff
// passed / live reporting started) -- the migration that introduced the boundary model never
// went back and corrected historical MatchRound rows finalized early under the old model. The
// board no longer receives the persisted MatchRound.status at all -- only the live-derived
// `planningBoundaryOpen` prop -- so this class of staleness can no longer leak into the editing
// gate, whatever the persisted status says.
// Gate C W2 (C04): `computeRoundPlanIntegrity()`'s `coverage` is the canonical eligible-opportunity
// denominator (rule 3) — the board must surface it as given, not re-derive a second definition.
describe("RoundBoard — eligible-player coverage (Gate C W2 / C04)", () => {
  it("shows the coverage prop's distinct-player denominator, labeled separately from squad placements", () => {
    const props = {
      ...baseProps(),
      coverage: {
        eligibleAvailablePlayerCount: 5,
        assignedEligibleAvailablePlayerCount: 3,
        unassignedEligibleAvailablePlayerIds: ["p-x", "p-y"],
      },
    };
    render(<RoundBoard {...props} />);
    expect(screen.getByText("3 / 5")).toBeTruthy();
    expect(screen.getByText(/eligible players with an opportunity/i)).toBeTruthy();
  });

  it("renders 0 / 0 without throwing when no coverage prop is supplied", () => {
    render(<RoundBoard {...baseProps()} />);
    expect(screen.getByText("0 / 0")).toBeTruthy();
  });
});

// Gate C W2 (C05): a closed match must never appear as an assignable suggestion. Before this fix,
// `buildAssignmentContext`'s caller offered every other match regardless of `isFinalized`, and
// `handleAssignSuggestion` had no guard (unlike `handleMatrixToggle`, which already checked
// `target.isFinalized`) — so a closed match could still accept an assignment from the
// inspector/sheet suggestion-card path.
describe("RoundBoard — closed destinations are never offered as assignable (Gate C W2 / C05 fix)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
  });

  it("excludes a finalized match from the selected player's suggestions and explains why", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches[1]!.isFinalized = true; // White is Alice's only other match.
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));

    expect(screen.queryByRole("button", { name: /assign player/i })).toBeNull();
    expect(screen.queryByText(/suggested assignments/i)).toBeNull();
    expect(screen.getByText(/planning is closed for every other match in this round/i)).toBeTruthy();
  });

  it("still offers a destination that remains open, with no closed notice, when only one of several is closed", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches.push({
      matchId: "m-green",
      teamId: "team-green",
      teamName: "Green",
      teamKitColor: "#00aa44",
      opponent: "Hawks",
      matchDate: new Date("2026-01-01"),
      targetSquadSize: 11,
      minSquadSize: 7,
      isFinalized: false,
      players: [],
    });
    props.matches[1]!.isFinalized = true; // White closed, Green stays open.
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));

    // Exactly one destination (Green) survives the filter, so it is the suggestion rendered —
    // proven below by the committed assignment's matchId, not by a fragile team-name text query
    // (the closed match's own name, "White", is also the match lane's column header elsewhere
    // on the page).
    expect(screen.getByText(/suggested assignments/i)).toBeTruthy();
    expect(screen.queryByText(/planning is closed for every other match in this round/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /assign player/i }));
    await waitFor(() => expect(addPlayerToMatchAction).toHaveBeenCalledOnce());
    expect((addPlayerToMatchAction.mock.calls[0][0] as FormData).get("matchId")).toBe("m-green");
  });
});

// Gate C W2: narrow command boundary so UI Lab fixtures can inject deterministic responses
// without touching real server actions, while production (which never passes `commands`) is
// unaffected — see `RoundBoardCommands`.
describe("RoundBoard — command boundary (Gate C W2)", () => {
  beforeEach(() => {
    removePlayerFromMatchAction.mockClear();
  });

  it("calls an injected command instead of the real action when `commands` is supplied", async () => {
    const user = userEvent.setup();
    const fixtureRemove = vi.fn(async () => ({ success: true, errors: [], warnings: [] }));
    render(<RoundBoard {...baseProps()} commands={{ removePlayerFromMatch: fixtureRemove }} />);

    await user.click(screen.getByRole("button", { name: /remove alice/i }));

    await waitFor(() => expect(fixtureRemove).toHaveBeenCalledOnce());
    expect(removePlayerFromMatchAction).not.toHaveBeenCalled();
  });

  it("falls back to the real action when `commands` is omitted (zero production behavior change)", async () => {
    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /remove alice/i }));

    await waitFor(() => expect(removePlayerFromMatchAction).toHaveBeenCalledOnce());
  });
});

describe("RoundBoard — editing is gated by the live planning boundary, not a persisted status (production bug)", () => {
  it("does not show the 'Planning closed' banner when the boundary is still open", () => {
    const props = { ...baseProps(), planningBoundaryOpen: true };
    render(<RoundBoard {...props} />);
    expect(screen.queryByText(/Planning closed/i)).toBeNull();
  });

  it("shows the 'Planning closed' banner when the boundary is genuinely closed", () => {
    const props = { ...baseProps(), planningBoundaryOpen: false };
    render(<RoundBoard {...props} />);
    expect(screen.getByText(/Planning closed/i)).toBeTruthy();
  });

  it("shows Regenerate/Clear when the boundary is still open", () => {
    const props = { ...baseProps(), planningBoundaryOpen: true };
    render(<RoundBoard {...props} />);
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /clear/i })).toBeTruthy();
  });

  it("hides Regenerate/Clear when the boundary is genuinely closed", () => {
    const props = { ...baseProps(), planningBoundaryOpen: false };
    render(<RoundBoard {...props} />);
    expect(screen.queryByRole("button", { name: /regenerate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });
});

// Gate C W2 remediation (second pass, P2): the round-level `planningBoundaryOpen` banner
// previously claimed "Every match's planning boundary has closed" unconditionally whenever it
// was false — but that flag requires only that round-wide operations (Regenerate/Clear) are
// unavailable, per ADR-0109's "every match must be open" rule. A single closed match in an
// otherwise-open round made this literally untrue.
describe("RoundBoard — the closed-boundary banner distinguishes mixed from fully-closed rounds (Gate C W2 remediation)", () => {
  it("shows the mixed-boundary banner, never claiming every match is closed, when only one match has closed", () => {
    const props = baseProps();
    props.planningBoundaryOpen = false;
    props.matches[0]!.isFinalized = true; // Blue closed, White stays open.
    render(<RoundBoard {...props} />);

    expect(screen.getByText(/round-wide planning locked/i)).toBeTruthy();
    expect(screen.getByText(/some matches have closed/i)).toBeTruthy();
    expect(screen.queryByText(/every match's planning boundary has closed/i)).toBeNull();
  });

  it("shows the fully-closed banner when every match has actually closed", () => {
    const props = baseProps();
    props.planningBoundaryOpen = false;
    props.matches[0]!.isFinalized = true;
    props.matches[1]!.isFinalized = true;
    render(<RoundBoard {...props} />);

    expect(screen.getByText(/^planning closed/i)).toBeTruthy();
    expect(screen.getByText(/all matches have passed their planning boundary/i)).toBeTruthy();
    expect(screen.queryByText(/round-wide planning locked/i)).toBeNull();
  });

  it("falls back to a neutral closed message without claiming every match closed when the round has no matches at all", () => {
    const props = baseProps();
    props.planningBoundaryOpen = false;
    props.matches = [];
    render(<RoundBoard {...props} />);

    expect(screen.getByText(/^planning closed/i)).toBeTruthy();
    expect(screen.queryByText(/all matches have passed their planning boundary/i)).toBeNull();
    expect(screen.queryByText(/round-wide planning locked/i)).toBeNull();
  });
});

// Gate C W2 remediation (second pass, P2): the desktop "Move to..." picker offered every other
// match regardless of its planning boundary — the central movePlayerToMatch command already
// rejects a closed destination, but the picker still invited the coach to pick one.
describe("RoundBoard — the Move picker only offers genuinely open destinations (Gate C W2 remediation)", () => {
  it("excludes a closed match from the Move picker's destination list", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches[1]!.isFinalized = true; // White is closed.
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /move alice to/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /white/i })).toBeNull();
    expect(screen.getByText(/other matches exist, but their planning is closed/i)).toBeTruthy();
  });

  it("distinguishes 'no other matches exist' from 'other matches exist but are closed'", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches = [props.matches[0]!]; // Only Blue exists at all.
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /move alice to/i }));
    expect(await screen.findByText(/no other matches exist/i)).toBeTruthy();
    expect(screen.queryByText(/their planning is closed/i)).toBeNull();
  });

  it("still offers a genuinely open destination", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /move alice to/i }));
    expect(await screen.findByRole("button", { name: /white/i })).toBeTruthy();
  });
});

// Gate C W2 remediation (second pass): a match-specific Resolve previously only updated
// mobile-only state, which the desktop workbench never reads — clicking it did nothing visible
// on desktop even though the control looked actionable.
describe("RoundBoard — match-specific Resolve has a real effect on desktop (Gate C W2 remediation)", () => {
  it("scrolls the real match lane into view and moves focus to a useful control inside it", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const scrollSpy = vi.fn();
    props.warnings = [{ code: "SQUAD_BELOW_MINIMUM", message: "White is below minimum squad size.", severity: "HARD_BLOCK", matchId: "m-white" }];
    const { container } = render(<RoundBoard {...props} />);
    const whiteLane = container.querySelector('[data-drop-match="m-white"]') as HTMLElement;
    whiteLane.scrollIntoView = scrollSpy;

    await user.click(screen.getByRole("button", { name: /resolve/i }));

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    // White's lane has no players, so there's no "Select {name}" button inside it — focus
    // falls back to the lane itself, which is still a real, observable destination.
    await waitFor(() => expect(document.activeElement).toBe(whiteLane));
  });

  it("focuses the first selectable player inside the resolved match when one exists", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.warnings = [{ code: "SQUAD_BELOW_MINIMUM", message: "Blue is below minimum squad size.", severity: "HARD_BLOCK", matchId: "m-blue" }];
    const { container } = render(<RoundBoard {...props} />);
    const blueLane = container.querySelector('[data-drop-match="m-blue"]') as HTMLElement;
    blueLane.scrollIntoView = vi.fn();

    await user.click(screen.getByRole("button", { name: /resolve/i }));

    // Resolving also sets the compact match-first state (for mobile), which mounts a SECOND
    // "Select Alice" button in jsdom (CSS-hidden at this width in a real browser, but present
    // regardless here) — scope to the one inside the desktop lane this test is actually about.
    await waitFor(() => {
      expect(document.activeElement).toBe(within(blueLane).getByRole("button", { name: "Select Alice" }));
    });
  });
});

// Gate C W2 remediation (P1-03): movePlayerToMatch previously only guarded the DESTINATION
// boundary. A player currently on a CLOSED match could still be removed from it, as a side
// effect of toggling a *different*, open match's cell for them (matrix), or of a suggestion-card
// assignment into a genuinely open destination (handleAssignSuggestion only checked the target).
describe("RoundBoard — movePlayerToMatch guards the SOURCE match's boundary too (Gate C W2 remediation P1-03)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
    removePlayerFromMatchAction.mockClear();
  });

  it("matrix: does not remove a player from a closed source match when toggling a different, open match's cell", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches[0]!.isFinalized = true; // Alice's current match (Blue) is closed; White stays open.
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /^allocation$/i }));
    await user.click(screen.getByRole("button", { name: "Alice in White, not assigned" }));

    expect(addPlayerToMatchAction).not.toHaveBeenCalled();
    expect(removePlayerFromMatchAction).not.toHaveBeenCalled();
    // Alice remains assigned to Blue — the cell state is unchanged.
    expect(screen.getByRole("button", { name: "Alice in Blue" })).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(/planning is closed for the player's current match/i);
  });

  it("suggestion-card path: proactively shows no destination at all for a player whose own current match is closed, rather than offering one that would only fail when tapped", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.matches[0]!.isFinalized = true; // Alice's current match (Blue) is closed.
    props.matches.push({
      matchId: "m-green",
      teamId: "team-green",
      teamName: "Green",
      teamKitColor: "#00aa44",
      opponent: "Hawks",
      matchDate: new Date("2026-01-01"),
      targetSquadSize: 11,
      minSquadSize: 7,
      isFinalized: false,
      players: [],
    });
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));

    // White and Green are both genuinely open, but Alice's own match (Blue) is closed — every
    // possible move touches that closed source, so nothing is offered at all, immediately on
    // selection (not only after a doomed attempt).
    expect(screen.queryByRole("button", { name: /assign player/i })).toBeNull();
    expect(screen.getByText(/planning is closed for this player's current match/i)).toBeTruthy();
    expect(addPlayerToMatchAction).not.toHaveBeenCalled();
  });

  // Unlike the suggestion-card path above, the matrix shows every player row regardless of
  // their current match's boundary (it is not a per-player "selected" view), so it still relies
  // on `movePlayerToMatch`'s own reactive guard — see the dedicated matrix test earlier in this
  // describe block ("matrix: does not remove a player from a closed source match...").
});

// Gate C W2 remediation (P1-05): a rejected or errored move must never look like a silent no-op
// or a success — the sheet/inspector stay open, the selection is preserved, and the real reason
// is shown.
describe("RoundBoard — truthful feedback on a rejected or errored assignment (Gate C W2 remediation P1-05)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
    removePlayerFromMatchAction.mockClear();
  });

  it("keeps the inspector open and preserves the selection when the server rejects the assignment", async () => {
    const user = userEvent.setup();
    addPlayerToMatchAction.mockResolvedValueOnce({ success: false, errors: ["No eligible slot remains."], warnings: [] });
    const props = baseProps();
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    await user.click(screen.getByRole("button", { name: /assign player/i }));

    // Rejected — the suggestion list (and Alice's selection) remains, with the real reason shown.
    await screen.findByText("No eligible slot remains.");
    expect(screen.getByRole("button", { name: /assign player/i })).toBeTruthy();
    expect(removePlayerFromMatchAction).not.toHaveBeenCalled();
  });

  it("surfaces a partial-completion error truthfully when add succeeds but remove fails, rather than claiming success", async () => {
    const user = userEvent.setup();
    addPlayerToMatchAction.mockResolvedValueOnce({ success: true, errors: [], warnings: [] });
    removePlayerFromMatchAction.mockResolvedValueOnce({ success: false, errors: ["Conflict."], warnings: [] });
    const props = baseProps();
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    await user.click(screen.getByRole("button", { name: /assign player/i }));

    expect(await screen.findByText(/added to the new match but could not be removed from the previous one/i)).toBeTruthy();
  });

  it("shows no error banner or false rejection message after a genuine success", async () => {
    const user = userEvent.setup();
    addPlayerToMatchAction.mockResolvedValueOnce({ success: true, errors: [], warnings: [] });
    const props = baseProps();
    render(<RoundBoard {...props} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    await user.click(screen.getByRole("button", { name: /assign player/i }));

    await waitFor(() => expect(removePlayerFromMatchAction).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/was rejected|could not be removed/i)).toBeNull();
  });
});

/** `useMediaQuery("(max-width: 839px)")` drives `isCompactViewport` — see
 * `src/app/dev/ui-lab/gate-a/a01-sports-first/__tests__/a01-fixture.test.tsx` for this pattern. */
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

describe("RoundBoard — mobile assignment sheet retains context on rejection (Gate C W2 remediation P1-05)", () => {
  beforeEach(() => {
    addPlayerToMatchAction.mockClear();
    removePlayerFromMatchAction.mockClear();
  });
  afterEach(() => {
    restoreMatchMedia?.();
    restoreMatchMedia = undefined;
  });

  it("stays open and shows the real reason when the server rejects the assignment", async () => {
    mockCompactViewport();
    const user = userEvent.setup();
    addPlayerToMatchAction.mockResolvedValueOnce({ success: false, errors: ["No eligible slot remains."], warnings: [] });
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    const sheet = await screen.findByRole("dialog", { name: /assign player/i });
    await user.click(within(sheet).getByRole("button", { name: /assign to white/i }));

    // The desktop inspector column is CSS-hidden but still present in jsdom — scope to the
    // sheet itself, which is the thing actually visible at this (compact) viewport.
    expect(await within(sheet).findByText("No eligible slot remains.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /assign player/i })).toBeTruthy(); // still open.
  });

  it("closes on a genuine success", async () => {
    mockCompactViewport();
    const user = userEvent.setup();
    addPlayerToMatchAction.mockResolvedValueOnce({ success: true, errors: [], warnings: [] });
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    const sheet = await screen.findByRole("dialog", { name: /assign player/i });
    await user.click(within(sheet).getByRole("button", { name: /assign to white/i }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /assign player/i })).toBeNull());
  });

  it("cancel closes the sheet without calling any assignment action", async () => {
    mockCompactViewport();
    const user = userEvent.setup();
    render(<RoundBoard {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /select alice/i }));
    await screen.findByRole("dialog", { name: /assign player/i });
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: /assign player/i })).toBeNull();
    expect(addPlayerToMatchAction).not.toHaveBeenCalled();
  });
});
