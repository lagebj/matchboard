import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D03GroundedPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D03GroundedPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D03 grounded longitudinal hypothesis", () => {
  it("renders the existing development focus distinctly from the Assistant Coach hypothesis", () => {
    renderPage();
    expect(screen.getByText("Composure under pressure in the defensive third")).toBeInTheDocument();
    expect(
      screen.getByText(/This is the coach's own existing, already-confirmed development focus/),
    ).toBeInTheDocument();
    expect(screen.getByText("Assistant Coach hypotheses")).toBeInTheDocument();
  });

  it("discloses the contradicting observation rather than only showing supporting evidence", () => {
    renderPage();
    expect(screen.getByText(/Contradicting: Coach observation, 4 Oct 2026 vs Skedsmo/)).toBeInTheDocument();
  });

  it("never states the hypothesis as a confirmed fact", () => {
    renderPage();
    expect(screen.getByText(/This is an AI hypothesis, not a confirmed fact/)).toBeInTheDocument();
  });

  it("renders the full observation timeline, not just the refs the hypothesis cites", () => {
    renderPage();
    expect(screen.getByText(/Looked rushed receiving under pressure/)).toBeInTheDocument();
    // Appears twice: once in the timeline's own observation entry, once inside the (collapsed)
    // source inspector's detail for the contradicting ref — both real, not a duplicate rendering bug.
    expect(screen.getAllByText(/One giveaway under pressure in the defensive third/).length).toBeGreaterThanOrEqual(1);
  });

  it("the source inspector resolves every cited ref to real fixture detail, expandable via keyboard-accessible <details>", async () => {
    const user = userEvent.setup();
    renderPage();
    const summary = screen.getByText("Recorded defensive-third giveaways, previous 3 vs. latest 3 matches");
    await user.click(summary);
    expect(screen.getByText(/5 across the previous 3 matches/)).toBeVisible();
  });

  it("describes recorded giveaways as a count, never as an unlabelled rate, with the exposure caveat visible", () => {
    renderPage();
    expect(screen.queryByText(/giveaway rate/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not an exposure-adjusted performance rate/)).toBeInTheDocument();
  });

  it("states the correct six-week learning-cycle duration, matching the fixture's own date boundaries", () => {
    renderPage();
    expect(screen.getByText(/Based on the 6-week window 30 Aug – 11 Oct 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/five-week/)).not.toBeInTheDocument();
  });

  it("Promote is disabled until a development focus is typed, then succeeds without a real Server Action", async () => {
    const user = userEvent.setup();
    renderPage();
    const promote = screen.getByRole("button", { name: /promote to development focus/i });
    expect(promote).toBeDisabled();
    await user.type(screen.getByLabelText("Development focus to record if promoted"), "Keep tracking composure under pressure");
    expect(promote).toBeEnabled();
    await user.click(promote);
    expect(screen.queryByText(/Jonas Berg's recorded defensive-third giveaways decreased/)).not.toBeInTheDocument();
  });
});
