import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AbsenceControl } from "../absence-control";

const { markMatchAbsenceActionMock, clearMatchAbsenceActionMock } = vi.hoisted(() => ({
  markMatchAbsenceActionMock: vi.fn(async () => ({ success: true })),
  clearMatchAbsenceActionMock: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/app/(app)/matches/absence-actions", () => ({
  markMatchAbsenceAction: markMatchAbsenceActionMock,
  clearMatchAbsenceAction: clearMatchAbsenceActionMock,
}));

describe("AbsenceControl (production consistency pass item #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls markMatchAbsenceAction when a reason is selected", async () => {
    render(<AbsenceControl matchId="match-1" playerId="player-1" currentReason={null} isLocked={false} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "SICK" } });

    await waitFor(() => expect(markMatchAbsenceActionMock).toHaveBeenCalledWith("match-1", "player-1", "SICK"));
    expect(clearMatchAbsenceActionMock).not.toHaveBeenCalled();
  });

  it("calls clearMatchAbsenceAction when reverting to Present", async () => {
    render(<AbsenceControl matchId="match-1" playerId="player-1" currentReason="SICK" isLocked={false} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });

    await waitFor(() => expect(clearMatchAbsenceActionMock).toHaveBeenCalledWith("match-1", "player-1"));
    expect(markMatchAbsenceActionMock).not.toHaveBeenCalled();
  });

  it("renders a read-only label with no select when the report is locked", () => {
    render(<AbsenceControl matchId="match-1" playerId="player-1" currentReason="AWAY" isLocked={true} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Away")).toBeTruthy();
  });

  it("renders nothing when locked and no absence was recorded", () => {
    const { container } = render(<AbsenceControl matchId="match-1" playerId="player-1" currentReason={null} isLocked={true} />);
    expect(container.firstChild).toBeNull();
  });
});
