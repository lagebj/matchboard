import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/lib/theme/theme-provider";

const { default: D08ConflictingNotePage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <D08ConflictingNotePage />
    </ThemeProvider>,
  );
}

describe("Gate D W1 extension — D08 conflicting note", () => {
  it("targets the profile role RB as the proposed primary", () => {
    renderPage();
    expect(screen.getByText("RWB → RB")).toBeInTheDocument();
  });

  it("surfaces the conflicting coach observation without suppressing the proposal", () => {
    renderPage();
    expect(screen.getByText(/Conflicting note:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer" })).toBeInTheDocument();
  });

  it("simulates defer without claiming a real position write", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Defer" }));
    expect(screen.getByTestId("decision-result")).toHaveTextContent("Deferred (simulated — no record written).");
  });
});
