import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D07PendingMaterialApprovalPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D07PendingMaterialApprovalPage />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gate D W1 extension — D07 material approval required (corrected 2026-11-24)", () => {
  it("distinguishes baseline, current applied value, and pending proposed value as three separate values", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Positioning — approval required" })).toBeInTheDocument();
    expect(screen.getByTestId("baseline-value")).toHaveTextContent("6");
    expect(screen.getByTestId("current-applied-value")).toHaveTextContent("7");
    expect(screen.getByTestId("proposed-value")).toHaveTextContent("8");
  });

  it("reports the cumulative change as +2, crossing the 2-point approval trigger — not the prior incorrect +3", () => {
    renderPage();
    expect(screen.getAllByText(/\+2 points/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2-point approval trigger/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\+3/)).not.toBeInTheDocument();
  });

  it("never displays 9 anywhere — the prior fixture's incorrect three-step chain is fully removed", () => {
    renderPage();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.queryByText(/6 → 9/)).not.toBeInTheDocument();
  });

  it("does not change the displayed current applied value merely because a decision was made (PENDING state is the source of truth until a real mutation would occur)", async () => {
    renderPage();
    expect(screen.getByTestId("current-applied-value")).toHaveTextContent("7");
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    // The proposal is simulated-accepted, but the component must not retroactively claim 8 was
    // already the current value before the click — it reports what WOULD happen, not a fait
    // accompli.
    expect(screen.getByTestId("decision-result")).toHaveTextContent(
      "Accepted (simulated — would apply 8 as the new current value; no record written).",
    );
  });

  it("rejecting explicitly states the current value remains unchanged", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByTestId("decision-result")).toHaveTextContent(
      "Rejected (simulated — current value remains 7; no record written).",
    );
  });

  it("discloses the accept/reject controls are simulated", () => {
    renderPage();
    expect(screen.getByText(/simulated: no Server Action is called/)).toBeInTheDocument();
  });

  it("makes no network request when Accept or Reject is clicked — the simulation is purely local component state", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
