import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerAssignmentBoard } from "../player-assignment-board";
import type { PlayerAssignmentBoard as BoardType } from "@/domain/player-assignment/types";

vi.mock("@/domain/player-assignment/actions", () => ({
  fetchPlayerAssignmentBoard: vi.fn(),
  movePlayerToTeamAction: vi.fn(),
}));

const { fetchPlayerAssignmentBoard } = vi.mocked(
  await import("@/domain/player-assignment/actions"),
);

const mockBoard: BoardType = {
  teams: [
    {
      teamId: "team-1",
      name: "Bla",
      players: [
        { playerId: "p1", displayName: "Ada Berg", primaryPosition: "GK", rotatable: true, teamId: "team-1", coreGroup: "Bla" },
        { playerId: "p2", displayName: "Erik Dal", primaryPosition: "CB", rotatable: false, teamId: "team-1", coreGroup: "Bla" },
      ],
    },
    {
      teamId: "team-2",
      name: "Hvit",
      players: [
        { playerId: "p3", displayName: "Ola Fin", primaryPosition: "CM", rotatable: true, teamId: "team-2", coreGroup: "Hvit" },
      ],
    },
  ],
  unassigned: [
    { playerId: "p4", displayName: "Unassigned Player", primaryPosition: "W", rotatable: true },
  ],
};

describe("PlayerAssignmentBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders team columns and player cards", async () => {
    fetchPlayerAssignmentBoard.mockResolvedValue(mockBoard);

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("Bla")).toBeInTheDocument();
      expect(screen.getByText("Hvit")).toBeInTheDocument();
    });

    expect(screen.getByText("Ada Berg")).toBeInTheDocument();
    expect(screen.getByText("Erik Dal")).toBeInTheDocument();
    expect(screen.getByText("Ola Fin")).toBeInTheDocument();
    expect(screen.getByText("Unassigned Player")).toBeInTheDocument();
  });

  it("shows non-rotatable badge", async () => {
    fetchPlayerAssignmentBoard.mockResolvedValue(mockBoard);

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("non-rotatable")).toBeInTheDocument();
    });
  });

  it("shows player count per team column", async () => {
    fetchPlayerAssignmentBoard.mockResolvedValue(mockBoard);

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("2 players")).toBeInTheDocument();
      const onePlayers = screen.getAllByText("1 players");
      expect(onePlayers.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty board state as empty columns", async () => {
    fetchPlayerAssignmentBoard.mockResolvedValue({ teams: [], unassigned: [] });

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("Players")).toBeInTheDocument();
      expect(screen.getByText("No unassigned players")).toBeInTheDocument();
    });
  });

  it("shows null board state with not found message", async () => {
    fetchPlayerAssignmentBoard.mockResolvedValue(null as unknown as BoardType);

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("No players found.")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", async () => {
    fetchPlayerAssignmentBoard.mockImplementation(() => new Promise(() => {}));

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    expect(screen.getByText("Loading players...")).toBeInTheDocument();
  });

  it("reveals move dropdown on double-click", async () => {
    const user = userEvent.setup();
    fetchPlayerAssignmentBoard.mockResolvedValue(mockBoard);

    await act(() => {
      render(<PlayerAssignmentBoard />);
    });

    await waitFor(() => {
      expect(screen.getByText("Ada Berg")).toBeInTheDocument();
    });

    const card = screen.getByText("Ada Berg").closest("div")!;
    await user.dblClick(card);

    await waitFor(() => {
      expect(screen.getByText("Move to...")).toBeInTheDocument();
    });
  });
});