import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { CONFIRM_ERROR_MESSAGE } from "../fixtures";

const { default: D03DecisionFlowPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D03DecisionFlowPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D03 coach decision flow", () => {
  it("renders all three pending hypotheses in one panel", () => {
    renderPage();
    expect(screen.getAllByText("Assistant Coach hypothesis")).toHaveLength(3);
  });

  it("Promote succeeds for the confirm-demo hypothesis, with no real Server Action and no repeat confirmation possible", async () => {
    const user = userEvent.setup();
    renderPage();
    const promoteButtons = screen.getAllByRole("button", { name: /promote to development focus/i });
    const focusInputs = screen.getAllByLabelText("Development focus to record if promoted");

    await user.type(focusInputs[0]!, "Track left-midfield comfort under possession");
    await user.click(promoteButtons[0]!);

    expect(screen.queryByText(/Amir Haile's recorded minutes at left midfield/)).not.toBeInTheDocument();
    // The outcome unmounts only that one card — the other two remain pending and actionable.
    expect(screen.getAllByText("Assistant Coach hypothesis")).toHaveLength(2);
  });

  it("Dismiss succeeds for the dismiss-demo hypothesis without requiring a focus to be entered", async () => {
    const user = userEvent.setup();
    renderPage();
    const dismissButtons = screen.getAllByRole("button", { name: /^dismiss$/i });
    await user.click(dismissButtons[1]!);
    expect(screen.queryByText(/Amir Haile's event rate while trailing/)).not.toBeInTheDocument();
  });

  it("a simulated Promote failure leaves the hypothesis pending with a visible error, not silently discarded", async () => {
    const user = userEvent.setup();
    renderPage();
    const promoteButtons = screen.getAllByRole("button", { name: /promote to development focus/i });
    const focusInputs = screen.getAllByLabelText("Development focus to record if promoted");

    await user.type(focusInputs[2]!, "Track rotation pattern with Jonas");
    await user.click(promoteButtons[2]!);

    expect(await screen.findByText(CONFIRM_ERROR_MESSAGE)).toBeInTheDocument();
    // The hypothesis itself is still visible and still actionable — a failed decision did not
    // silently remove it.
    expect(screen.getByText(/Amir Haile's co-presence with Jonas Berg/)).toBeInTheDocument();
  });
});
