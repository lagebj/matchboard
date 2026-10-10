import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A03OpenDecisionPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A03OpenDecisionPage />
    </ThemeProvider>,
  );
}

describe("A03-S1 open-decision page", () => {
  it("names Tobias and RCM in the situation", () => {
    renderPage();
    expect(screen.getByText(/Tobias is a confirmed starter without a locked tactical slot/)).toBeInTheDocument();
  });

  it("the permitted action is a plain button, never a link, and does not navigate", () => {
    renderPage();
    const action = screen.getByRole("button", { name: "Assign Tobias to RCM" });
    expect(action.tagName).toBe("BUTTON");
    expect(screen.queryByRole("link", { name: /assign/i })).not.toBeInTheDocument();
  });

  it("clicking the action reveals the consequence panel, not a mutation", () => {
    renderPage();
    expect(screen.queryByTestId("consequence-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assign Tobias to RCM" }));
    expect(screen.getByTestId("consequence-panel")).toHaveTextContent(/design illustration/i);
  });

  it("the Why toggle reveals the inspectable reason", () => {
    renderPage();
    expect(screen.queryByTestId("reason-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByTestId("reason-panel")).toHaveTextContent(/only starter without a locked tactical slot/);
  });
});
