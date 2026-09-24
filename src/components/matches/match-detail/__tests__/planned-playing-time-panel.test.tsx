import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlannedPlayingTimePanel, formatPlannedPositionSummary } from "../planned-playing-time-panel";

/**
 * Match Detail Overview — planned playing time per squad player, per position. Self-fetches (like
 * `MatchInsights`) so it stays current after a coach edits the rotation plan on the separate
 * Rotations tab and comes back to Overview (a full unmount/remount, not a live-shared state).
 */

const { getPlannedPlayingTimeActionMock } = vi.hoisted(() => ({
  getPlannedPlayingTimeActionMock: vi.fn(),
}));

vi.mock("@/app/(app)/matches/planned-rotation-actions", () => ({
  getPlannedPlayingTimeAction: (...args: unknown[]) => getPlannedPlayingTimeActionMock(...args),
}));

const SQUAD_PLAYERS = [
  { playerId: "anton", playerName: "Anton BB" },
  { playerId: "ibro", playerName: "Ibro O" },
  { playerId: "sindre", playerName: "Sindre K" },
];

describe("formatPlannedPositionSummary", () => {
  it("returns an em dash for a player never on the pitch", () => {
    expect(formatPlannedPositionSummary([])).toBe("—");
  });

  it("returns the single position for a player who never changed position", () => {
    expect(formatPlannedPositionSummary([{ position: "DEFENDER" }])).toBe("DEFENDER");
  });

  it("joins multiple distinct positions in order", () => {
    expect(formatPlannedPositionSummary([{ position: "DEFENDER" }, { position: "MIDFIELDER" }])).toBe("DEFENDER → MIDFIELDER");
  });

  it("collapses consecutive identical positions (subbed off and back on at the same spot)", () => {
    expect(
      formatPlannedPositionSummary([{ position: "DEFENDER" }, { position: "DEFENDER" }, { position: "MIDFIELDER" }]),
    ).toBe("DEFENDER → MIDFIELDER");
  });
});

describe("PlannedPlayingTimePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state before the fetch resolves", () => {
    getPlannedPlayingTimeActionMock.mockReturnValue(new Promise(() => {}));
    render(<PlannedPlayingTimePanel matchId="match-1" teamId="team-1" squadPlayers={SQUAD_PLAYERS} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("prompts to set a starting line-up when none exists yet", async () => {
    getPlannedPlayingTimeActionMock.mockResolvedValue({ success: true, hasLineup: false });
    render(<PlannedPlayingTimePanel matchId="match-1" teamId="team-1" squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(screen.getByText(/starting line-up/i)).toBeInTheDocument());
  });

  it("shows an error message when the fetch fails", async () => {
    getPlannedPlayingTimeActionMock.mockResolvedValue({ success: false, error: "Something broke." });
    render(<PlannedPlayingTimePanel matchId="match-1" teamId="team-1" squadPlayers={SQUAD_PLAYERS} />);
    await waitFor(() => expect(screen.getByText("Something broke.")).toBeInTheDocument());
  });

  it("renders each squad player's name, position summary, and rounded minutes", async () => {
    getPlannedPlayingTimeActionMock.mockResolvedValue({
      success: true,
      hasLineup: true,
      totalMatchSeconds: 3000,
      rows: [
        { playerId: "anton", plannedMinutes: 25, startingPosition: "DEFENDER", positions: [{ position: "DEFENDER", fromSeconds: 0, toSeconds: 1500 }] },
        {
          playerId: "ibro",
          plannedMinutes: 27.6,
          startingPosition: "MIDFIELDER",
          positions: [
            { position: "MIDFIELDER", fromSeconds: 0, toSeconds: 1500 },
            { position: "DEFENDER", fromSeconds: 1500, toSeconds: 3000 },
          ],
        },
        { playerId: "sindre", plannedMinutes: 0, startingPosition: null, positions: [] },
      ],
    });

    render(<PlannedPlayingTimePanel matchId="match-1" teamId="team-1" squadPlayers={SQUAD_PLAYERS} />);

    await waitFor(() => expect(screen.getByText("Anton BB")).toBeInTheDocument());
    expect(screen.getByText("DEFENDER")).toBeInTheDocument();
    expect(screen.getByText("25'")).toBeInTheDocument();

    expect(screen.getByText("Ibro O")).toBeInTheDocument();
    expect(screen.getByText("MIDFIELDER → DEFENDER")).toBeInTheDocument();

    expect(screen.getByText("Sindre K")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("0'")).toBeInTheDocument();
  });
});
