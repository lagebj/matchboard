import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, closedPeriod } from "../fixtures";
import { buildLeagueOperatingViewModel } from "@/lib/touchline/presentation/league-view-model";

describe("GATE-E-W1-E01-SEASON-CLOSED fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("never fabricates a CURRENT_ROUND when every round is in the past (XR-T01 reject case)", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [closedPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.focusedRound?.status).not.toBe("CURRENT_ROUND");
  });

  it("honestly falls back to the most recent round still needing closure (Round 2), not the most recent round overall (Round 3)", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [closedPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.focusedRound?.id).toBe("gate-e-w1-e01-closed-round-2");
    expect(vm.focusedRound?.status).toBe("NEEDS_CLOSURE");
    expect(vm.focusedRound?.statusLabel).toBe("Needs closure");
  });
});
