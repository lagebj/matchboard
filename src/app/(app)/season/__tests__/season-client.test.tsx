import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SeasonOverviewClient } from "../season-client";

/**
 * Regression coverage for ADR-0157 slice C7's Players-tab relocation (`09_SEASON_REVIEW.md`
 * required tests: "matrix remains reachable and preserves existing data semantics" / "export
 * remains available after History route convergence"). `SeasonOverviewClient` itself is
 * unmodified by this slice -- it is rendered inside Season Review's Players tab exactly as it
 * previously rendered directly on `/season` -- so this test exercises the real component rather
 * than a Season Review-specific fork.
 */

const EMPTY_MATRIX = {
  leagueSeasonId: "ls-1",
  leagueSeasonName: "Spring 2026",
  roundCount: 2,
  finalizedRoundCount: 1,
  draftRoundCount: 1,
  playersWithWarnings: 0,
  highestSupportBurden: null,
  doubleLoadCount: 0,
  players: [],
  rounds: [],
};

describe("SeasonOverviewClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/season/matrix")) return { ok: true, json: async () => EMPTY_MATRIX } as Response;
        if (url.includes("/api/season/movement-paths")) return { ok: true, json: async () => [] } as Response;
        return { ok: true, json: async () => [] } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the finalised/draft toggle and the export control reachable", async () => {
    render(
      <SeasonOverviewClient
        leagueSeasons={[{ id: "ls-1", name: "Spring 2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-06-01"), status: "OPEN", finalizedAt: null }]}
        activeLeagueSeasonId="ls-1"
      />,
    );

    await waitFor(() => expect(screen.getByText("Finalised only")).toBeInTheDocument());
    expect(screen.getByText("Include drafts")).toBeInTheDocument();

    const exportLink = screen.getByRole("link", { name: /export/i });
    expect(exportLink).toHaveAttribute("href", expect.stringContaining("/api/season/export?leagueSeasonId=ls-1"));
    expect(exportLink).toHaveAttribute("download");
  });
});
