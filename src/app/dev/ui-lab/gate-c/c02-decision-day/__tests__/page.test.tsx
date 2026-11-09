import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";

vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { default: C02DecisionDayPage } = await import("../page");

function renderPage() {
  return render(
    <ThemeProvider>
      <C02DecisionDayPage />
    </ThemeProvider>,
  );
}

describe("Gate C W1 — C02 Decision day", () => {
  it("renders the primary decision inline, not the quiet hero", () => {
    renderPage();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    // P2-03: the primary action IS the real Jonas selection decision (not a generic/plan-
    // integrity rendering) — proven by its real inline WHY-zone heading ("CURRENT SITUATION",
    // since this decision has no directly-actionable recommendation) rather than a duplicated
    // standalone "Why?" box (today-composition.ts deliberately returns null for this kind). The
    // secondary Noah decision shares the same heading text (it also has no recommendation), so
    // this asserts presence, not uniqueness — uniqueness of Jonas's own content is asserted below.
    expect(screen.getAllByText("CURRENT SITUATION").length).toBeGreaterThan(0);
    expect(screen.getByText("No core-team match currently needs additional players this round.")).toBeInTheDocument();
  });

  it("P2-03: does not repeat the promoted identity-colliding decision in the secondary Selection decisions list", () => {
    renderPage();
    // Jonas's own problem text appears exactly once — as the primary action — even though the
    // exact same signalKey/idempotencyKey also exists in roundPlanIntegrities and could, if the
    // real exclusion logic were broken, render a second time as a secondary Selection decision.
    expect(screen.getAllByText("Available and active, but not assigned to any match in Round 9.").length).toBe(1);
  });

  it("shows the two genuine secondary items the real cap allows (a different decision + planning)", () => {
    renderPage();
    // A genuinely different player/decision (Noah, Round 7) remains visible — proving dedup
    // suppresses only the identity collision, not every Selection decision.
    expect(screen.getByText("Available and active, but not assigned to any match in Round 7.")).toBeInTheDocument();
    expect(screen.getByText("Theodor is planned twice in Round 10")).toBeInTheDocument();
  });

  it("drops the third genuine secondary candidate once the real 2-item cap is reached", () => {
    renderPage();
    expect(screen.queryByText("Round 11 squads not yet opened")).not.toBeInTheDocument();
  });

  it("never renders InstallPwaCard", () => {
    renderPage();
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });
});
