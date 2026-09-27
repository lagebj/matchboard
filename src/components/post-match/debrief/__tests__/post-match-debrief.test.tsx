import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostMatchDebrief } from "../post-match-debrief";
import { EMPTY_DEBRIEF_ANSWERS } from "@/lib/post-match/debrief/v1";

/**
 * The League/Event action modules are dynamically imported inside the component based on
 * `reportRef.kind` (matching this codebase's existing convention, e.g. team-reflection-section.tsx
 * before its retirement) — `vi.mock` intercepts the module regardless of static-vs-dynamic import
 * syntax, so this still isolates the component from the real server actions/DB.
 */
vi.mock("@/app/(app)/matches/[matchId]/post-match/debrief-actions", () => ({
  saveDebriefDraftAction: vi.fn(),
  submitDebriefAction: vi.fn(),
  reopenDebriefAction: vi.fn(),
}));

const { saveDebriefDraftAction, submitDebriefAction } = vi.mocked(await import("@/app/(app)/matches/[matchId]/post-match/debrief-actions"));

function renderDebrief(overrides: Partial<React.ComponentProps<typeof PostMatchDebrief>> = {}) {
  return render(
    <PostMatchDebrief
      reportRef={{ kind: "LEAGUE", matchId: "match-1" }}
      debriefId="debrief-1"
      status="DRAFT"
      initialAnswers={EMPTY_DEBRIEF_ANSWERS}
      opponentName="Rivals"
      matchupLabel="Home Team vs Rivals"
      playerOptions={[]}
      periodOptions={["First half", "Second half"]}
      {...overrides}
    />,
  );
}

describe("PostMatchDebrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveDebriefDraftAction.mockResolvedValue({ success: true, data: undefined });
    submitDebriefAction.mockResolvedValue({ success: true, data: undefined });
  });

  it("gates Continue on team execution until all four rows are answered (bundle §6)", async () => {
    const user = userEvent.setup();
    renderDebrief();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Effort: Strong" }));
    await user.click(screen.getByRole("button", { name: "Team cohesion: OK" }));
    await user.click(screen.getByRole("button", { name: "Positional shape: OK" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Recovery after losing the ball: OK" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("autosaves 600ms after an answer changes", async () => {
    const user = userEvent.setup();
    renderDebrief();
    await user.click(screen.getByRole("button", { name: "Effort: Strong" }));

    await waitFor(() => expect(saveDebriefDraftAction).toHaveBeenCalledTimes(1), { timeout: 2000 });
    const [matchId, debriefId, payload] = saveDebriefDraftAction.mock.calls[0];
    expect(matchId).toBe("match-1");
    expect(debriefId).toBe("debrief-1");
    expect((payload as { answers: { team_execution: unknown } }).answers.team_execution).toEqual({ effort: { value: "STRONG" } });

    await waitFor(() => expect(screen.getByText("Saved automatically")).toBeInTheDocument());
  });

  it("preserves the coach's input and shows a retry message when a save fails (bundle §14)", async () => {
    saveDebriefDraftAction.mockResolvedValue({ success: false, error: "nope" });
    const user = userEvent.setup();
    renderDebrief();
    await user.click(screen.getByRole("button", { name: "Effort: Strong" }));

    await waitFor(() => expect(screen.getByText("Could not save. Retry.")).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByRole("button", { name: "Effort: Strong" })).toHaveAttribute("aria-pressed", "true");
  });

  it("walks the full required path to review and submits", async () => {
    const user = userEvent.setup();
    renderDebrief();

    await user.click(screen.getByRole("button", { name: "Effort: Strong" }));
    await user.click(screen.getByRole("button", { name: "Team cohesion: OK" }));
    await user.click(screen.getByRole("button", { name: "Positional shape: OK" }));
    await user.click(screen.getByRole("button", { name: "Recovery after losing the ball: OK" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Pressing" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Nothing to add" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "No meaningful change" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Opponent memory / player observations / anything else are all optional.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Submit debrief" }));

    await waitFor(() => expect(submitDebriefAction).toHaveBeenCalledWith("match-1", "debrief-1"));
    await waitFor(() => expect(screen.getByText("Submitted")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Submit debrief" })).not.toBeInTheDocument();
  });

  it("resumes on the first still-incomplete required step for a partially-completed draft", () => {
    renderDebrief({ initialAnswers: { version: 1, answers: { ...EMPTY_DEBRIEF_ANSWERS.answers, worked: { selected: ["NOTHING_TO_ADD"] }, needs_attention: { selected: ["NOTHING_TO_ADD"] }, match_changes: { option: "UNSURE" } } } });

    // Every required step but team_execution is already satisfied — computeInitialStep lands
    // straight there instead of restarting the wizard from step one.
    expect(screen.getByRole("heading", { name: "Team execution" })).toBeInTheDocument();
  });

  it("renders the read-only view directly when already submitted, hiding empty optional sections", () => {
    renderDebrief({
      status: "SUBMITTED",
      initialAnswers: { version: 1, answers: { ...EMPTY_DEBRIEF_ANSWERS.answers, worked: { selected: ["PRESSING"] } } },
    });

    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Pressing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.queryByText("What needs attention")).not.toBeInTheDocument();
  });
});
