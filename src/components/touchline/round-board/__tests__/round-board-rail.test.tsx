import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundBoardRail } from "../round-board-rail";
import type { RoundBoardAttentionItem } from "@/lib/touchline/presentation/round-board-view-model";

const ATTENTION: RoundBoardAttentionItem[] = [
  { id: "b1", playerId: null, matchId: null, summary: "Squad below minimum", detail: "Blue has 5 of 7", severity: "BLOCKED" },
];

function baseProps() {
  return {
    attention: ATTENTION,
    onResolve: vi.fn(),
    assistantCoach: null,
    fairnessMetrics: [{ label: "Minutes spread", value: "12%" }],
    movementSummary: { supportSent: 2, supportReceived: 1, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    developmentContext: null,
  };
}

describe("RoundBoardRail", () => {
  it("shows the deterministic attention list on the Insights tab by default", () => {
    render(<RoundBoardRail {...baseProps()} />);
    expect(screen.getByText("Squad below minimum")).toBeInTheDocument();
  });

  it("renders Assistant Coach insights after the deterministic list, clearly labelled, never replacing it", () => {
    render(
      <RoundBoardRail
        {...baseProps()}
        assistantCoach={{ status: "fresh", insights: [{ title: "Shared constraint", body: "Two exceptions share a support-path constraint." }] }}
      />,
    );
    const container = screen.getByRole("tablist").parentElement!;
    const text = container.textContent ?? "";
    expect(text.indexOf("Squad below minimum")).toBeLessThan(text.indexOf("Assistant Coach"));
    expect(screen.getByText("Assistant Coach")).toBeInTheDocument();
    expect(screen.getByText("Shared constraint")).toBeInTheDocument();
  });

  it("shows the stale advisor state without any deterministic-looking insight rows", () => {
    render(<RoundBoardRail {...baseProps()} assistantCoach={{ status: "stale" }} />);
    expect(screen.getByText("Plan changed · Advisor update pending")).toBeInTheDocument();
  });

  it("Balance tab shows factual counts and never a composite score or Save/Finalize action", async () => {
    const user = userEvent.setup();
    render(<RoundBoardRail {...baseProps()} />);
    await user.click(screen.getByRole("tab", { name: "balance" }));
    expect(screen.getByText("Minutes spread")).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save|finalize/i })).not.toBeInTheDocument();
  });

  it("Development tab prompts for a selection when no player is selected", async () => {
    const user = userEvent.setup();
    render(<RoundBoardRail {...baseProps()} />);
    await user.click(screen.getByRole("tab", { name: "development" }));
    expect(screen.getByText("Select a player to see development context.")).toBeInTheDocument();
  });

  it("Development tab renders the selected player's context-only facts and never offers an action", async () => {
    const user = userEvent.setup();
    render(
      <RoundBoardRail
        {...baseProps()}
        developmentContext={{
          playerId: "p1",
          displayName: "Noah",
          activeFocusCategories: ["FIRST_TOUCH"],
          effectivePositions: [{ positionId: "CM", supportBand: "STRONG", confidence: "MEDIUM", appearances: 3, minutes: 180 }],
        }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "development" }));
    expect(screen.getByText("Noah")).toBeInTheDocument();
    expect(screen.getByText("FIRST_TOUCH")).toBeInTheDocument();
    expect(screen.getByText("CM")).toBeInTheDocument();
    expect(screen.getByText("Context only — does not change which moves are valid.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
