import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { CONFIRM_FOCUS_TEXT } from "../fixtures";

const { default: D06SourceInspectionPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D06SourceInspectionPage />
    </ThemeProvider>,
  );
}

describe("Gate D W2 — D06 source inspection + coach confirmation", () => {
  it("renders four distinct, individually expandable cited sources", () => {
    renderPage();
    const details = screen.getAllByRole("group");
    // Native <details> elements expose the implicit "group" role.
    expect(details.length).toBeGreaterThanOrEqual(4);
  });

  it("expanding one source reveals its own real detail, correctly classified by kind (derived trend, not a generic measurement)", async () => {
    const user = userEvent.setup();
    renderPage();
    const summary = screen.getByText("Centre forward role minutes, previous 3 vs. latest 3 matches");
    await user.click(summary);
    expect(screen.getByText(/15 across the previous 3 matches/)).toBeVisible();
    expect(screen.getByText("Derived trend")).toBeVisible();
  });

  it("Promote is disabled until a development focus is typed, then succeeds without a real Server Action", async () => {
    const user = userEvent.setup();
    renderPage();
    const promote = screen.getByRole("button", { name: /promote to development focus/i });
    expect(promote).toBeDisabled();
    await user.type(screen.getByLabelText("Development focus to record if promoted"), CONFIRM_FOCUS_TEXT);
    expect(promote).toBeEnabled();
    await user.click(promote);
    expect(screen.queryByText(/Sara Dahl's recorded minutes have shifted/)).not.toBeInTheDocument();
  });

  it("Dismiss succeeds without requiring a focus and without a real Server Action", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));
    expect(screen.queryByText(/Sara Dahl's recorded minutes have shifted/)).not.toBeInTheDocument();
  });
});
