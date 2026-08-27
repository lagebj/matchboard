import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPlayerFindFirst = vi.hoisted(() => vi.fn());
const mockSelectionFindMany = vi.hoisted(() => vi.fn());
const mockComputeRoundPlanIntegrity = vi.hoisted(() => vi.fn());
const mockAddPlayer = vi.hoisted(() => vi.fn());
const mockRemovePlayer = vi.hoisted(() => vi.fn());
const mockMatchFindFirst = vi.hoisted(() => vi.fn());
const mockSelectionFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    player: { findFirst: mockPlayerFindFirst },
    selection: {
      findMany: mockSelectionFindMany,
      findFirst: mockSelectionFindFirst,
    },
    match: { findFirst: mockMatchFindFirst },
  },
}));

vi.mock("@/lib/selection/compute-plan-integrity", () => ({
  computeRoundPlanIntegrity: mockComputeRoundPlanIntegrity,
}));

vi.mock("@/lib/selection/manual-draft-edit", () => ({
  addPlayerToDraftMatch: mockAddPlayer,
  removePlayerFromDraftMatch: mockRemovePlayer,
  changeDraftPlayerRole: vi.fn(),
}));

import { analyzeAvailabilityChangeImpact } from "../availability-impact";
import { previewManualAddImpact, previewManualRemoveImpact } from "../edit-impact-preview";

const orgFilter = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeAvailabilityChangeImpact", () => {
  it("returns null for non-existent player", async () => {
    mockPlayerFindFirst.mockResolvedValue(null);
    const result = await analyzeAvailabilityChangeImpact("nonexistent", "AVAILABLE", orgFilter);
    expect(result).toBeNull();
  });

  it("returns player info and affected rounds", async () => {
    mockPlayerFindFirst.mockResolvedValue({
      id: "player-1",
      firstName: "Test",
      lastName: "Player",
      currentAvailability: "AVAILABLE",
    });
    mockSelectionFindMany.mockResolvedValue([
      { id: "sel-1", status: "DRAFT", matchId: "match-1", match: { id: "match-1", matchRoundId: "round-1", matchRound: { id: "round-1", name: "Round 5", status: "DRAFT" } } },
    ]);
    mockComputeRoundPlanIntegrity.mockResolvedValue({ signals: [], blocked: 0, decisionRequired: 0, planningNotes: 0 });

    const result = await analyzeAvailabilityChangeImpact("player-1", "UNAVAILABLE", orgFilter);

    expect(result).not.toBeNull();
    expect(result!.playerName).toBe("Test Player");
    expect(result!.previousAvailability).toBe("AVAILABLE");
    expect(result!.newAvailability).toBe("UNAVAILABLE");
    expect(result!.affectedRounds).toHaveLength(1);
    expect(result!.affectedRounds[0].hasFinalizedSelections).toBe(false);
  });

  it("identifies rounds requiring unfinalization", async () => {
    mockPlayerFindFirst.mockResolvedValue({
      id: "player-1",
      firstName: "Test",
      lastName: "Player",
      currentAvailability: "AVAILABLE",
    });
    mockSelectionFindMany.mockResolvedValue([
      { id: "sel-1", status: "FINALIZED", matchId: "match-1", match: { id: "match-1", matchRoundId: "round-1", matchRound: { id: "round-1", name: "Round 5", status: "FINALIZED" } } },
    ]);
    mockComputeRoundPlanIntegrity.mockResolvedValue({ signals: [], blocked: 0, decisionRequired: 0, planningNotes: 0 });

    const result = await analyzeAvailabilityChangeImpact("player-1", "UNAVAILABLE", orgFilter);

    expect(result!.affectedRounds[0].wouldRequireUnfinalize).toBe(true);
    expect(result!.affectedRounds[0].impactSummary).toContain("finalized");
  });
});

describe("previewManualAddImpact", () => {
  it("returns blocked changes for non-existent match", async () => {
    mockMatchFindFirst.mockResolvedValue(null);

    const result = await previewManualAddImpact("nonexistent", "player-1", "CORE", orgFilter);

    expect(result.blockedChanges).toContain("Match not found");
  });

  it("preview add shows impact on plan integrity", async () => {
    mockMatchFindFirst.mockResolvedValue({ matchRoundId: "round-1" });
    mockComputeRoundPlanIntegrity
      .mockResolvedValueOnce({ signals: [{ ruleCode: "BELOW_TARGET", kind: "BLOCKED" as const, title: "Below target" }], blocked: 0, decisionRequired: 0, planningNotes: 1 })
      .mockResolvedValueOnce({ signals: [{ ruleCode: "SELECTED_PLAYER_UNAVAILABLE", kind: "BLOCKED" as const, title: "Player unavailable" }], blocked: 1, decisionRequired: 0, planningNotes: 0 });
    mockAddPlayer.mockResolvedValue({ success: true, selection: { id: "sel-new" }, errors: [] });
    mockRemovePlayer.mockResolvedValue({ success: true, errors: [] });

    const result = await previewManualAddImpact("match-1", "player-1", "CORE", orgFilter);

    expect(result.currentIntegrity).not.toBeNull();
    expect(result.proposedIntegrity).not.toBeNull();
    expect(result.newSignals).toContain("SELECTED_PLAYER_UNAVAILABLE");
    expect(result.resolvedSignals).toContain("BELOW_TARGET");
    expect(mockRemovePlayer).toHaveBeenCalled();
  });

  it("returns error when add fails", async () => {
    mockMatchFindFirst.mockResolvedValue({ matchRoundId: "round-1" });
    mockComputeRoundPlanIntegrity.mockResolvedValue({ signals: [], blocked: 0, decisionRequired: 0, planningNotes: 0 });
    mockAddPlayer.mockResolvedValue({ success: false, errors: ["Same-round conflict"], warnings: [] });

    const result = await previewManualAddImpact("match-1", "player-1", "CORE", orgFilter);

    expect(result.blockedChanges).toContain("Same-round conflict");
  });
});

describe("previewManualRemoveImpact", () => {
  it("returns blocked changes for non-existent match", async () => {
    mockMatchFindFirst.mockResolvedValue(null);

    const result = await previewManualRemoveImpact("nonexistent", "player-1", orgFilter);

    expect(result.blockedChanges).toContain("Match not found");
  });

  it("preview remove restores player after preview", async () => {
    mockMatchFindFirst.mockResolvedValue({ matchRoundId: "round-1" });
    mockComputeRoundPlanIntegrity
      .mockResolvedValueOnce({ signals: [], blocked: 0, decisionRequired: 0, planningNotes: 0 })
      .mockResolvedValueOnce({ signals: [{ ruleCode: "SQUAD_BELOW_MINIMUM", kind: "BLOCKED" as const, title: "Below minimum" }], blocked: 1, decisionRequired: 0, planningNotes: 0 });
    mockRemovePlayer.mockResolvedValue({ success: true, errors: [] });
    mockSelectionFindFirst.mockResolvedValue({ role: "CORE" });
    mockAddPlayer.mockResolvedValue({ success: true, selection: { id: "sel-restored" }, errors: [] });

    const result = await previewManualRemoveImpact("match-1", "player-1", orgFilter);

    expect(result.newSignals).toContain("SQUAD_BELOW_MINIMUM");
    expect(mockAddPlayer).toHaveBeenCalledWith("match-1", "player-1", "CORE");
  });
});