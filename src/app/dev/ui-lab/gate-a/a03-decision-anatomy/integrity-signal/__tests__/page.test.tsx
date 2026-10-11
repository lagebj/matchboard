import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A03IntegritySignalPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A03IntegritySignalPage />
    </ThemeProvider>,
  );
}

describe("A03-S4 integrity-signal page", () => {
  it("shows a signal that points back to the round and match", () => {
    renderPage();
    expect(screen.getByText(/Round 4 has one match with an unfilled tactical slot/)).toBeInTheDocument();
    expect(screen.getByText(/Slemmestad Rød vs Fjordvik Blå/)).toBeInTheDocument();
  });

  it("has no 'Resolve' action anywhere — never a second fairness/eligibility resolver", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /resolve/i })).not.toBeInTheDocument();
  });

  it("the Why toggle reveals the underlying fixture fact", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByTestId("signal-reason-panel")).toHaveTextContent(/RCM remains unfilled/);
  });
});
