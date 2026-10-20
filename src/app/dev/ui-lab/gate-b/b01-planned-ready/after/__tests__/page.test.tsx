import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B01AfterPage from "../page";
import B01PlannedReadyPage from "../../page";
import { B01_OPPONENT_NAME } from "../../../shared/match-b-fixture";

function renderAfter() {
  return render(
    <ThemeProvider>
      <B01AfterPage />
    </ThemeProvider>,
  );
}

function renderBefore() {
  return render(
    <ThemeProvider>
      <B01PlannedReadyPage />
    </ThemeProvider>,
  );
}

describe("B01 AFTER page", () => {
  it("has no 'Edit lineup' button or any other mutation control — read-only, like the real completed-match Overview", () => {
    renderAfter();
    expect(screen.queryByRole("button", { name: "Edit lineup" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the real recorded result", () => {
    renderAfter();
    expect(screen.getAllByText("2-1").length).toBeGreaterThan(0);
  });

  it("renders the same opponent name as the BEFORE state — same identity visible in both captured states", () => {
    const { unmount: unmountAfter } = renderAfter();
    expect(screen.getAllByText(new RegExp(B01_OPPONENT_NAME)).length).toBeGreaterThan(0);
    unmountAfter();

    renderBefore();
    expect(screen.getAllByText(new RegExp(B01_OPPONENT_NAME)).length).toBeGreaterThan(0);
  });
});

describe("B01 BEFORE page", () => {
  it("has no report-status widget implying a report already exists", () => {
    renderBefore();
    expect(screen.queryByText(/post-match report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/continue report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view full report/i)).not.toBeInTheDocument();
  });

  it("links to the AFTER state for the before/after lifecycle comparison", () => {
    renderBefore();
    expect(screen.getByRole("link", { name: /Compare to AFTER state/i })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b01-planned-ready/after",
    );
  });
});
