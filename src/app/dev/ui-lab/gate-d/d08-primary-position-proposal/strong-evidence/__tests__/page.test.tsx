import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D08StrongEvidencePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D08StrongEvidencePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D08 strong evidence", () => {
  it("targets the profile role CM, never the sided exact code RCM, as the proposed primary", () => {
    renderPage();
    expect(screen.getByText("DM → CM")).toBeInTheDocument();
    expect(screen.queryByText("DM → RCM")).not.toBeInTheDocument();
  });

  it("discloses the exact recorded evidence code separately from the profile proposal", () => {
    renderPage();
    expect(
      screen.getByText((_, element) => (element?.tagName === "P" && !!element.textContent?.includes("Right Central Midfield (RCM)")) ?? false),
    ).toBeInTheDocument();
  });

  it("shows no conflicting note for this state", () => {
    renderPage();
    expect(screen.queryByText(/Conflicting note/)).not.toBeInTheDocument();
  });

  it("simulates accept without claiming a real position write", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByTestId("decision-result")).toHaveTextContent("Accepted (simulated — no record written).");
  });
});
