import { describe, it, expect } from "vitest";
import {
  mapSelectionRoleToPathwayContext,
  mapSelectionRoleToCellStatus,
  computePathwaySummaryMetrics,
  getContextLabel,
  getCellStatusLabel,
  isDraftCell,
  isSupportCell,
  isDevelopmentCell,
} from "../pathways-helpers";
import type { PlayerPathwayRow, PathwayCell } from "../pathways-types";

describe("mapSelectionRoleToPathwayContext", () => {
  it("maps CORE to core", () => {
    expect(mapSelectionRoleToPathwayContext("CORE")).toBe("core");
  });

  it("maps SUPPORT to support", () => {
    expect(mapSelectionRoleToPathwayContext("SUPPORT")).toBe("support");
  });

  it("maps DEVELOPMENT to development", () => {
    expect(mapSelectionRoleToPathwayContext("DEVELOPMENT")).toBe("development");
  });

  it("maps BACKFILL to squad_repair", () => {
    expect(mapSelectionRoleToPathwayContext("BACKFILL")).toBe("squad_repair");
  });

  it("maps CONFIDENCE_REBUILD to development", () => {
    expect(mapSelectionRoleToPathwayContext("CONFIDENCE_REBUILD")).toBe("development");
  });

  it("maps CORE_MATCH_DROP to core_match_drop", () => {
    expect(mapSelectionRoleToPathwayContext("CORE_MATCH_DROP")).toBe("core_match_drop");
  });

  it("maps unknown role to unknown", () => {
    expect(mapSelectionRoleToPathwayContext("UNKNOWN_ROLE")).toBe("unknown");
  });
});

describe("mapSelectionRoleToCellStatus", () => {
  it("maps CORE finalized home team to core_home", () => {
    expect(mapSelectionRoleToCellStatus("CORE", false, true)).toBe("core_home");
  });

  it("maps CORE finalized away team to core_home", () => {
    expect(mapSelectionRoleToCellStatus("CORE", false, false)).toBe("core_home");
  });

  it("maps SUPPORT finalized to support_sent", () => {
    expect(mapSelectionRoleToCellStatus("SUPPORT", false, true)).toBe("support_sent");
  });

  it("maps DEVELOPMENT finalized to development_moved", () => {
    expect(mapSelectionRoleToCellStatus("DEVELOPMENT", false, true)).toBe("development_moved");
  });

  it("maps BACKFILL finalized to squad_repair_received", () => {
    expect(mapSelectionRoleToCellStatus("BACKFILL", false, true)).toBe("squad_repair_received");
  });

  it("maps CORE draft to draft_core", () => {
    expect(mapSelectionRoleToCellStatus("CORE", true, true)).toBe("draft_core");
  });

  it("maps SUPPORT draft to draft_support", () => {
    expect(mapSelectionRoleToCellStatus("SUPPORT", true, true)).toBe("draft_support");
  });

  it("maps DEVELOPMENT draft to draft_development", () => {
    expect(mapSelectionRoleToCellStatus("DEVELOPMENT", true, true)).toBe("draft_development");
  });

  it("maps CONFIDENCE_REBUILD draft to draft_development", () => {
    expect(mapSelectionRoleToCellStatus("CONFIDENCE_REBUILD", true, true)).toBe("draft_development");
  });

  it("maps CORE_MATCH_DROP finalized to core_match_drop", () => {
    expect(mapSelectionRoleToCellStatus("CORE_MATCH_DROP", false, true)).toBe("core_match_drop");
  });
});

describe("computePathwaySummaryMetrics", () => {
  const makePlayer = (
    id: string,
    name: string,
    opts: Partial<{
      supportAppearances: number;
      developmentAppearances: number;
      roundsPlayed: number;
      cells: PathwayCell[];
    }> = {},
  ): PlayerPathwayRow => ({
    playerId: id,
    playerName: name,
    coreTeamId: "team1",
    coreTeamName: "Team 1",
    roundsPlayed: opts.roundsPlayed ?? 1,
    totalSelections: 1,
    coreAppearances: 1,
    supportAppearances: opts.supportAppearances ?? 0,
    developmentAppearances: opts.developmentAppearances ?? 0,
    squadRepairAppearances: 0,
    droppedRounds: 0,
    unavailableRounds: 0,
    contextTransitions: 0,
    cells: opts.cells ?? [],
  });

  it("computes empty metrics for empty players", () => {
    const metrics = computePathwaySummaryMetrics([]);
    expect(metrics.playersShown).toBe(0);
    expect(metrics.temporarySupportAppearances).toBe(0);
    expect(metrics.playersWithNoCompletedOpportunity).toBe(0);
    expect(metrics.mostFrequentHelpers).toEqual([]);
  });

  it("counts support appearances", () => {
    const players = [
      makePlayer("p1", "Alice", { supportAppearances: 3 }),
      makePlayer("p2", "Bob", { supportAppearances: 1 }),
    ];
    const metrics = computePathwaySummaryMetrics(players);
    expect(metrics.temporarySupportAppearances).toBe(4);
    expect(metrics.mostFrequentHelpers).toHaveLength(2);
    expect(metrics.mostFrequentHelpers[0].playerId).toBe("p1");
  });

  it("counts players with no completed opportunity", () => {
    const players = [
      makePlayer("p1", "Alice", { roundsPlayed: 2 }),
      makePlayer("p2", "Bob", { roundsPlayed: 0 }),
    ];
    const metrics = computePathwaySummaryMetrics(players);
    expect(metrics.playersWithNoCompletedOpportunity).toBe(1);
  });

  it("counts players in multiple contexts", () => {
    const coreAndSupportCells: PathwayCell[] = [
      {
        matchRoundId: "r1",
        matchRoundName: "Round 1",
        matchId: "m1",
        status: "core_home",
        context: "core",
        teamId: "team1",
        teamName: "Team 1",
        role: "CORE",
        isDraft: false,
      },
      {
        matchRoundId: "r2",
        matchRoundName: "Round 2",
        matchId: "m2",
        status: "support_sent",
        context: "support",
        teamId: "team2",
        teamName: "Team 2",
        role: "SUPPORT",
        isDraft: false,
      },
    ];
    const players = [
      makePlayer("p1", "Alice", { cells: coreAndSupportCells }),
    ];
    const metrics = computePathwaySummaryMetrics(players);
    expect(metrics.playersInMultipleContexts).toBe(1);
  });

  it("limits most frequent helpers to top 5", () => {
    const players = Array.from({ length: 7 }, (_, i) =>
      makePlayer(`p${i}`, `Player ${i}`, { supportAppearances: 7 - i }),
    );
    const metrics = computePathwaySummaryMetrics(players);
    expect(metrics.mostFrequentHelpers).toHaveLength(5);
    expect(metrics.mostFrequentHelpers[0].supportCount).toBe(7);
  });
});

describe("getContextLabel", () => {
  it("returns human-readable labels for all contexts", () => {
    expect(getContextLabel("core")).toBe("Core");
    expect(getContextLabel("support")).toBe("Support");
    expect(getContextLabel("development")).toBe("Development");
    expect(getContextLabel("squad_repair")).toBe("Squad repair");
    expect(getContextLabel("core_match_drop")).toBe("Core match drop");
    expect(getContextLabel("unknown")).toBe("Unknown");
  });
});

describe("getCellStatusLabel", () => {
  it("returns labels for finalized statuses", () => {
    expect(getCellStatusLabel("core_home")).toBe("Core");
    expect(getCellStatusLabel("support_sent")).toBe("Support");
    expect(getCellStatusLabel("development_moved")).toBe("Development");
    expect(getCellStatusLabel("squad_repair_received")).toBe("Squad repair");
    expect(getCellStatusLabel("not_selected")).toBe("Not selected");
    expect(getCellStatusLabel("unavailable")).toBe("Unavailable");
  });

  it("returns labels for draft statuses", () => {
    expect(getCellStatusLabel("draft_core")).toBe("Core (draft)");
    expect(getCellStatusLabel("draft_support")).toBe("Support (draft)");
    expect(getCellStatusLabel("draft_development")).toBe("Development (draft)");
  });

  it("returns dash for no_data", () => {
    expect(getCellStatusLabel("no_data")).toBe("—");
  });
});

describe("cell classification helpers", () => {
  const draftCell: PathwayCell = {
    matchRoundId: "r1",
    matchRoundName: "Round 1",
    matchId: "m1",
    status: "draft_core",
    context: "core",
    teamId: "team1",
    teamName: "Team 1",
    role: "CORE",
    isDraft: true,
  };

  const finalizedCell: PathwayCell = {
    matchRoundId: "r2",
    matchRoundName: "Round 2",
    matchId: "m2",
    status: "support_sent",
    context: "support",
    teamId: "team2",
    teamName: "Team 2",
    role: "SUPPORT",
    isDraft: false,
  };

  it("isDraftCell identifies draft cells", () => {
    expect(isDraftCell(draftCell)).toBe(true);
    expect(isDraftCell(finalizedCell)).toBe(false);
  });

  it("isFinalizedCell identifies finalized cells", () => {
    expect(isDraftCell(finalizedCell)).toBe(false);
  });

  it("isSupportCell identifies support cells", () => {
    expect(isSupportCell(finalizedCell)).toBe(true);
    expect(isSupportCell(draftCell)).toBe(false);
  });

  it("isDevelopmentCell identifies development cells", () => {
    expect(isDevelopmentCell(finalizedCell)).toBe(false);
    expect(isDevelopmentCell(draftCell)).toBe(false);
  });
});