import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundListClient } from "../round-list-client";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("../actions", () => ({
  clearAllDraftsAction: vi.fn(),
  populateAllAction: vi.fn(),
  generateRoundAction: vi.fn(),
  regroupRoundsAction: vi.fn(),
  regenerateAllDraftsAction: vi.fn(),
  finalizeRoundFromListAction: vi.fn(),
  unfinalizeRoundFromListAction: vi.fn(),
}));

function renderWithOrg(ui: React.ReactElement) {
  return render(<OrgSlugProvider orgSlug="test-club-a">{ui}</OrgSlugProvider>);
}

describe("RoundListClient", () => {
  // Regression test: the round card link previously pointed at the unscoped legacy /rounds/[id]
  // route instead of the canonical org-scoped /o/{orgSlug}/rounds/[id] route, causing an extra
  // redirect hop (and a real E2E navigation failure) every time a coach opened a round.
  it("links each round card to the org-scoped round detail route", () => {
    renderWithOrg(
      <RoundListClient
        rounds={[{ id: "round-1", name: "Round 1", weekLabel: "W36 2026", matchCount: 1, teamNames: ["A1 Blues"], derivedStatus: "READY" }]}
        activeLeagueSeasonId="season-1"
        hasDraftRounds={false}
        hasNotGeneratedRounds={false}
        roundCount={1}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/o/test-club-a/rounds/round-1");
  });

  it("shows a non-blocking loadError indicator without hiding the round", () => {
    renderWithOrg(
      <RoundListClient
        rounds={[{
          id: "round-1",
          name: "Round 1",
          weekLabel: "W36 2026",
          matchCount: 1,
          teamNames: ["A1 Blues"],
          derivedStatus: "DRAFT",
          loadError: "Couldn't load full status for this round.",
        }]}
        activeLeagueSeasonId="season-1"
        hasDraftRounds={true}
        hasNotGeneratedRounds={false}
        roundCount={1}
      />,
    );

    expect(screen.getByText("W36 2026")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load full status for this round.")).toBeInTheDocument();
  });

  it("does not show a loadError indicator for a normally-loaded round", () => {
    renderWithOrg(
      <RoundListClient
        rounds={[{ id: "round-1", name: "Round 1", weekLabel: "W36 2026", matchCount: 1, teamNames: ["A1 Blues"], derivedStatus: "READY" }]}
        activeLeagueSeasonId="season-1"
        hasDraftRounds={false}
        hasNotGeneratedRounds={false}
        roundCount={1}
      />,
    );

    expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
  });
});
