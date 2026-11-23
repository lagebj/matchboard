import { describe, it, expect } from "vitest";
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

describe("Gate D W1 extension — D07 material approval required", () => {
  it("shows the cumulative delta and evidence basis, not merely the last proposal's one-point cap", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Positioning — approval required" })).toBeInTheDocument();
    expect(screen.getByText("6 → 9")).toBeInTheDocument();
    expect(screen.getByText(/exceeds the 2-point approval trigger/)).toBeInTheDocument();
  });

  it("discloses the accept/reject controls are simulated", () => {
    renderPage();
    expect(screen.getByText(/simulated: no Server Action is called/)).toBeInTheDocument();
  });

  it("simulates accept without claiming a real record was written", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByTestId("decision-result")).toHaveTextContent("Accepted (simulated — no record written).");
  });

  it("simulates reject without claiming a real record was written", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByTestId("decision-result")).toHaveTextContent("Rejected (simulated — no record written).");
  });
});
