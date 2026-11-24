import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D07ManualEditRebasePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D07ManualEditRebasePage />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gate D W1 extension — D07 manual-edit precedence and attribute-level rebase", () => {
  it("shows the manually-edited attribute's new baseline and the preserved pre-edit history", () => {
    renderPage();
    expect(screen.getByTestId("baseline-passing")).toHaveTextContent("9");
    expect(screen.getByText(/last value 7/)).toBeInTheDocument();
  });

  it("does not yet allow automation to resume for an attribute with insufficient post-edit evidence", () => {
    renderPage();
    expect(screen.getByTestId("resume-status-passing")).toHaveTextContent(/Not yet eligible/);
  });

  it("allows automation to resume for an attribute with sufficient post-edit evidence (≥3 matches, confidence ≥0.7)", () => {
    renderPage();
    expect(screen.getByTestId("resume-status-finishing")).toHaveTextContent(/Eligible to resume/);
  });

  it("an unrelated attribute's baseline and progression are unaffected by another attribute's manual edit", () => {
    renderPage();
    expect(screen.getByTestId("baseline-speed")).toHaveTextContent("6");
    expect(screen.getByTestId("rebase-row-speed")).toHaveTextContent(/independent automatic evidence progression/);
    // Speed shows no manual-edit history at all, confirming Passing's edit did not touch it.
    expect(screen.getByTestId("rebase-row-speed")).not.toHaveTextContent(/Manually edited/);
  });

  it("a locked attribute blocks automation regardless of how much qualifying evidence exists", () => {
    renderPage();
    expect(screen.getByTestId("resume-status-workRate")).toHaveTextContent("Locked");
  });

  it("unlocking is simulated and only changes local component state, not a real persisted lock", async () => {
    renderPage();
    const unlockButton = screen.getByRole("button", { name: "Unlock (simulated)" });
    await userEvent.click(unlockButton);
    expect(screen.getByTestId("resume-status-workRate")).toHaveTextContent(/Eligible to resume/);
  });

  it("discloses that lock/unlock is simulated with no real persistence", () => {
    renderPage();
    expect(screen.getByText(/simulated: no Server Action is called/)).toBeInTheDocument();
  });

  it("makes no network request when unlocking", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Unlock (simulated)" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
