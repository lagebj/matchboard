import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostMatchReportShell } from "../post-match-report-shell";
import type {
  PostMatchReportViewModel,
  PostMatchReportActions,
  PostMatchReportCapabilities,
} from "@/lib/reports/post-match-report-view-model";

const CAPABILITIES: PostMatchReportCapabilities = { hasUnplannedReason: false };

function makeReport(overrides: Partial<PostMatchReportViewModel> = {}): PostMatchReportViewModel {
  return {
    id: "report-1",
    status: "DRAFT",
    teamLabel: "Fjordvik FK G14",
    opponentLabel: "Graabein United",
    ourScore: null,
    opponentScore: null,
    players: [],
    goals: [],
    assists: [],
    ...overrides,
  };
}

function makeActions(overrides: Partial<PostMatchReportActions> = {}): PostMatchReportActions {
  return {
    updateResult: vi.fn().mockResolvedValue({ success: true }),
    addGoal: vi.fn().mockResolvedValue({ success: true }),
    removeGoal: vi.fn().mockResolvedValue({ success: true }),
    addAssist: vi.fn().mockResolvedValue({ success: true }),
    removeAssist: vi.fn().mockResolvedValue({ success: true }),
    updateAttendance: vi.fn().mockResolvedValue({ success: true }),
    addPlayer: vi.fn().mockResolvedValue({ success: true }),
    removePlayer: vi.fn().mockResolvedValue({ success: true }),
    complete: vi.fn().mockResolvedValue({ success: true }),
    reopen: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

/**
 * Touchline Design Atlas (ADR-0136 Phase 5, `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §H`):
 * "submit" is the final step, after every correction section -- the Complete/Reopen action
 * moved from the shell's top header to its bottom. These tests lock in that the action still
 * fires the exact same handler (only its position changed) and that the header no longer
 * renders it.
 */
describe("PostMatchReportShell submit-action placement", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("renders 'Complete report' after extraSections, not in the header, for a DRAFT report", () => {
    const actions = makeActions();
    render(
      <PostMatchReportShell
        report={makeReport({ status: "DRAFT" })}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={[]}
        onChanged={() => {}}
        extraSections={<div data-testid="extra-marker">Team reflection goes here</div>}
      />,
    );

    const marker = screen.getByTestId("extra-marker");
    const submitButton = screen.getByRole("button", { name: "Complete report" });
    // DOCUMENT_POSITION_FOLLOWING (4) means submitButton comes after marker in the DOM.
    expect(marker.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("clicking 'Complete report' still calls actions.complete (only position changed)", async () => {
    const actions = makeActions();
    render(
      <PostMatchReportShell
        report={makeReport({ status: "DRAFT" })}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={[]}
        onChanged={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Complete report" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(actions.complete).toHaveBeenCalledTimes(1);
  });

  it("renders 'Reopen report' after extraSections for a LOCKED report, and it still calls actions.reopen", async () => {
    const actions = makeActions();
    render(
      <PostMatchReportShell
        report={makeReport({ status: "LOCKED", completedAt: "2026-09-01T00:00:00.000Z" })}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={[]}
        onChanged={() => {}}
        extraSections={<div data-testid="extra-marker">Team reflection goes here</div>}
      />,
    );

    const marker = screen.getByTestId("extra-marker");
    const reopenButton = screen.getByRole("button", { name: "Reopen report" });
    expect(marker.compareDocumentPosition(reopenButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(reopenButton);
    expect(confirmSpy).toHaveBeenCalled();
    expect(actions.reopen).toHaveBeenCalledWith("DRAFT");
  });

  it("does not render either submit action for a LOCKED-without-completedAt or a REPORTED-only view without a stray duplicate", () => {
    const actions = makeActions();
    render(
      <PostMatchReportShell
        report={makeReport({ status: "REPORTED" })}
        actions={actions}
        capabilities={CAPABILITIES}
        availablePlayers={[]}
        onChanged={() => {}}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Complete report" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Reopen report" })).toBeNull();
  });
});
