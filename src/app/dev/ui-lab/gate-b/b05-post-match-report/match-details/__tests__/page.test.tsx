import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import B05MatchDetailsPage from "../page";

describe("B05 Match Details (B5/R5 fixture-backed navigation)", () => {
  it("links onward to both the draft and completed report states for this same match", () => {
    render(
      <ThemeProvider>
        <B05MatchDetailsPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("link", { name: /Post-match report — draft/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b05-post-match-report/draft",
    );
    expect(screen.getByRole("link", { name: /Post-match report — completed/ })).toHaveAttribute(
      "href",
      "/dev/ui-lab/gate-b/b05-post-match-report/completed",
    );
  });

  it("names the real opponent, not a placeholder", () => {
    render(
      <ThemeProvider>
        <B05MatchDetailsPage />
      </ThemeProvider>,
    );
    expect(screen.getAllByText(/Kongsberg IL/).length).toBeGreaterThan(0);
  });
});
